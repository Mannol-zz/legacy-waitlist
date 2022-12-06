use std::collections::HashMap;

use eve_data_core::{TypeDB, TypeID};
use rocket::serde::json::Json;
use serde::Serialize;

use crate::{
    app::Application,
    core::auth::{get_access_keys, AuthenticatedAccount},
    util::{
        madness::Madness,
        types::{Character, Hull},
    },
};

#[derive(Serialize, Debug)]
struct ActivitySummaryEntry {
    hull: Hull,
    time_in_fleet: i64,
}

#[derive(Serialize, Debug)]
struct CharacterDetails {
    id: i64,
    name: String,
    role: Option<String>,
    badges: Vec<String>,
    fleet_time: Vec<ActivitySummaryEntry>,
}

#[derive(Serialize)]
pub struct ProfileData {
    main: CharacterDetails,
    alts: Vec<CharacterDetails>,
    total_fleet_time: Vec<ActivitySummaryEntry>,
}

#[get("/api/profile/<character_id>")]
async fn profile(
    account: AuthenticatedAccount,
    app: &rocket::State<Application>,
    character_id: i64,
) -> Result<Json<ProfileData>, Madness> {
    // Users must be an HQ FC to get information on other users
    if account.require_access("waitlist-tag:HQ-FC").is_err() && character_id != account.id {
        return Err(Madness::Forbidden(format!(
            "You must be an HQ FC to access this endpoint"
        )));
    }

    let main = sqlx::query_as!(
        Character,
        "SELECT `id`,`name`,`corporation_id` FROM `character` WHERE id=?",
        character_id
    )
    .fetch_optional(app.get_db())
    .await?;

    if main.is_none() {
        return Err(Madness::BadRequest(format!(
            "Character {} not found",
            character_id
        )));
    }

    let mut alt_characters = sqlx::query_as!(
        Character,
        "SELECT
            `id`,`name`,`corporation_id`
        FROM
            `character`
        JOIN
            `alt_character`AS `alt` ON (alt.alt_id=id OR alt.account_id=id)       
        WHERE
            (alt.alt_id=? OR alt.account_id=?) AND id!=?
        ORDER BY 
            `name` ASC",
        character_id,
        character_id,
        character_id
    )
    .fetch_all(app.get_db())
    .await?;

    // Merge all characters into a single Vector so we can foreach through them
    // when we do the character details lookups below
    let mut characters: Vec<Character> = vec![main.unwrap()];
    characters.append(&mut alt_characters);


    // Start fetching character details and finish with a Main character, alt character(s) and account wide fleet time
    let mut main: Option<CharacterDetails> = None;
    let mut alts = Vec::new();
    let mut account_time_by_hull = HashMap::new();
    
    for c in &characters {
        // Check if the character has an FC role
        let mut role: Option<String> = None;
        if let Some(fc) = sqlx::query!("SELECT `role` FROM `admin` WHERE character_id=?", c.id)
            .fetch_optional(app.get_db())
            .await?
        {
            let keys = get_access_keys(&fc.role).unwrap();
            if keys.contains("waitlist-tag:HQ-FC") {
                role = Some("HQ-FC".to_string());
            } else if keys.contains("waitlist-tag:TRAINEE") {
                role = Some("TRAINEE".to_string());
            }
        }

        // Get a list of badges owned by the character
        let mut badges: Vec<String> = Vec::new();
        for badge in sqlx::query!("SELECT b.name from badge_assignment AS ba INNER JOIN badge AS b on b.id=ba.BadgeId WHERE ba.CharacterId=?", c.id)
        .fetch_all(app.get_db())
        .await?
        .iter() {
            badges.push(badge.name.to_string());
        };

        // Calculate the character and account fleet time
        let activity = sqlx::query!(
            "SELECT `hull`, `first_seen`, `last_seen` FROM `fleet_activity` WHERE character_id=? ORDER BY first_seen DESC",
            c.id
        )
        .fetch_all(app.get_db())
        .await?
        .into_iter()
        .map(|row| (row.hull as TypeID, row.first_seen, row.last_seen));

        let mut time_by_hull = HashMap::new();
        for (hull, first_seen, last_seen) in activity {
            let time_span = last_seen - first_seen;
            *time_by_hull.entry(hull).or_insert(0) += time_span;
            *account_time_by_hull.entry(hull).or_insert(0) += time_span;
        }

        let mut fleet_summary = Vec::new();
        for (hull, time_in_fleet) in time_by_hull {
            fleet_summary.push(ActivitySummaryEntry {
                hull: Hull {
                    id: hull,
                    name: TypeDB::name_of(hull)?,
                },
                time_in_fleet,
            })
        }

        fleet_summary.sort_by(|a, b| b.time_in_fleet.cmp(&a.time_in_fleet));

        if c.id == character_id {
            main = Some(CharacterDetails {
                id: c.id,
                name: c.name.to_string(),
                role,
                badges,
                fleet_time: fleet_summary,
            })
        } else {
            alts.push(CharacterDetails {
                id: c.id,
                name: c.name.to_string(),
                role,
                badges,
                fleet_time: fleet_summary,
            });
        }
    }

    let mut account_fleet_summary = Vec::new();
    for (hull, time_in_fleet) in account_time_by_hull {
        account_fleet_summary.push(ActivitySummaryEntry {
            hull: Hull {
                id: hull,
                name: TypeDB::name_of(hull)?,
            },
            time_in_fleet,
        })
    }

    account_fleet_summary.sort_by(|a, b| b.time_in_fleet.cmp(&a.time_in_fleet));

    Ok(Json(ProfileData {
        main: main.unwrap(),
        alts,
        total_fleet_time: account_fleet_summary,
    }))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![
        profile,    // GET     /api/profile/:character_id?
    ]
}

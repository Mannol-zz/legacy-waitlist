import { useContext } from "react"
import {  Link, Route, useHistory, useParams } from "react-router-dom";
import { AuthContext } from "../../contexts"
import { useApi } from "../../api";
import { usePageTitle } from "../../Util/title";

import A from "../../Components/A";
import BadgeIcon, { icons } from "../../Components/Badge";
import styled from "styled-components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardCheck, faComment, faHistory, faTasks, faUsers } from "@fortawesome/free-solid-svg-icons";
import { Select } from "../../Components/Form";

const ProfileMastDOM = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 0 1em 15px 1em;

    @media (max-width: 400px) {
        flex-direction: column;
    }

    img {
        border-radius: 50%;
        margin-right: 10px;
        vertical-align: bottom;

        @media (max-width: 400px) {
            margin-right: 0px;
        }
    }

    h1 {
        font-size: 1.9em;
        margin-right: 10px;
    }

    div:first-of-type {
        display: flex;
        flex-direction: row;

        div {
            margin-right: 5px;
        }
    }
`;

const ProfileNavDom = styled.div`
    @media (min-width: 750px) {
        div.small { display: none; }
        flex-basis: 100%;
    }
    @media (max-width: 750px) {
        div.large { display: none; }
        flex-basis: unset;
    }

    div.large {
        
        padding-top: 20px;
        a { 
            display: inline-block;
            margin: 0 0 -1px;
            padding: 15px 25px;
            font-weight: 600;
            text-align: center;
            text-decoration: none;
            color: ${props => props.theme.colors.text};
            border: 2px solid transparent;

            svg { margin-right: 10px; }

            &:hover, &.active {
                cursor: pointer;
                border-top: 2px solid ${props => props.theme.colors.highlight.active};
                transition: all ease-in-out 0.3s;
            }
        }
    }
    div.small {
        select { appearance: auto; }
    }
`

const ProfilePage = () => {
    const authContext = useContext(AuthContext);
    const windowHistory = useHistory();
    let { characterId } = useParams();
    const { tabName } = useParams();

    if (!authContext) {
        return <>You must <A href="/auth/start">Login</A> to view this page.</>
    }

    if (!characterId) {
        // To keep things clean, we want to have a target characterId
        // if the value was not specified then let's set it to the users Current character
        windowHistory.push(`/profile/${authContext.current.id}`);
    }
    
    if (!authContext?.access["waitlist-tag:HQ-FC"]) {
        // if the user isn't an FC, we need to check they can view this character
        let is_allowed = authContext.characters.some(character => {
            if (character.id == characterId) {
                return true;
            }
        })

        if (!is_allowed) {
            windowHistory.push(`/profile/${authContext.current.id}${tabName ? `/${tabName}` : ''}`);
            characterId = authContext.current.id;
        }
    }
    
    return <View characterId={characterId ?? authContext.current.id} />
}

export default ProfilePage;

const ProfileMast = ({ character }) => {
    if (!character) return null;

    const Tag = ({ tag }) => {
        if (!(tag in icons)) return null;

        return (
            <div key={tag}>
                <BadgeIcon type={tag} height="30px" />
            </div>
        )
    }

    return (
        <ProfileMastDOM>
            <img src={`https://images.evetech.net/characters/${character?.id ?? 1}/portrait?size=64`} alt="Character Portrait" />
            <h1>{character.name}</h1>
            <div>
                <Tag tag={character.role} />
                { character?.badges?.map((tag) => {
                    return <Tag tag={tag} key={tag} />
                })}
            </div>
            <ProfileNav
                options={[{ icon: faUsers, text: "Characters" }, { icon: faClipboardCheck, text: "Fit Check" }, { icon: faHistory, text: "History" }, { icon: faTasks, text: "Skills" }, { icon: faComment, text: "Notes" }]}
                characterId={character?.id}
            />
        </ProfileMastDOM>
    )
}

const ProfileNav = ({ options, characterId, onChange }) => {   
    const windowHistory = useHistory();

    return (
        <ProfileNavDom>   
            <div className="large">
                {options.map((option, key) => {
                    const url = `/profile/${characterId}/${option.text.toLowerCase().replace(/ /g, '-')}`;
                    // isActive if pathname matches the TO url, OR if no page name is present in the URL and the tab is Characters
                    // expected URL pathname scheme:  /profile/:characterId/:tabName?
                    const isActive = window.location.pathname.split('/').length === 3 && key === 0 ? true : window.location.pathname == url;
                    
                    return (
                        <Link key={key} to={url} className={ isActive ? 'active' : null}>
                            <FontAwesomeIcon fixedWidth icon={option.icon} /> {option.text}
                        </Link>
                    )
                })}
            </div>

            <div className="small">
                <Select value={window.location.pathname} onChange={(e) => windowHistory.push(e.target.value)}>
                    {options.map((option, key) => {     
                        const url = `/profile/${characterId}/${option.text.toLowerCase().replace(/ /g, '-')}`;

                        return (
                            <option key={key} value={url}>
                                {option.text}
                            </option>
                        )
                    })}
                </Select>
            </div>
        </ProfileNavDom>
    );
}

const View = ({ characterId }) => {
    const [ account ] = useApi(`/api/profile/${characterId}`);
    usePageTitle(account?.main?.name ?? `Profile`);
       
    return (
        <>
            <ProfileMast character={account?.main} />   

            <div style={{ padding: "0px 16px 15px" }}>
                <Route exact path={[`/profile/:characterId(\\d+)`, `/profile/:characterId/characters`]}>
                    Characters
                </Route>

                <Route path={[`/profile/fit-check`, `/profile/:characterId/fit-check`]}>
                    Fit Check
                </Route>

                <Route path={[`/profile/history`, `/profile/:characterId/history`]}>
                    History
                </Route>

                <Route path={[`/profile/skills`, `/profile/:characterId/skills`]}>
                    Skills
                </Route>

                <Route path={[`/profile/notes`, `/profile/:characterId/notes`]}>
                    Notes
                </Route>
            </div>
        </>
    )
}
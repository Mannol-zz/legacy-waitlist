import { useContext, useEffect, useState } from "react"
import {  Route, useParams } from "react-router-dom";
import { AuthContext } from "../../contexts"
import { useApi } from "../../api";
import { usePageTitle } from "../../Util/title";

import A from "../../Components/A";
import BadgeIcon, { icons } from "../../Components/Badge";
import styled from "styled-components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardCheck, faComment, faHistory, faTasks, faUsers } from "@fortawesome/free-solid-svg-icons";
import { Label, Select } from "../../Components/Form";

const ProfileMastDOM = styled.div`
    display: flex;
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
    }
    @media (max-width: 750px) {
        div.large { display: none; }
    }

    div.large {
        input { display: none; }
        label { 
            display: inline-block;
            margin: 0 0 -1px;
            padding: 15px 25px;
            font-weight: 600;
            text-align: center;
            color: ${props => props.theme.colors.text};
            border: 2px solid transparent;

            svg { margin-right: 10px; }

            &:hover {
                cursor: pointer;
                border-top: 2px solid ${props => props.theme.colors.highlight.active};
                transition: all ease-in-out 0.3s;
            }
        }
        input:checked + label {
            color: ${props => props.theme.colors.text};
            border-top: 2px solid ${props => props.theme.colors.highlight.active};
            transition: all ease-in-out 0.3s;
        }
    }
    div.small {
        label {
            display: inline-block;
            padding-right: 20px;
        }
        select { appearance: auto; }
    }
`

const ProfilePage = () => {
    const authContext = useContext(AuthContext);
    const { characterId } = useParams();
    const { tabName } = useParams();

    if (!authContext) {
        return <>You must <A href="/auth/start">Login</A> to view this page.</>
    }

    // User does not have permissions to view this page
    if (!authContext?.access["waitlist-tag:HQ-FC"] && characterId) {
       window.location.assign(`/profile${tabName ? `/${tabName}` : ''}`);
    }

    return <View characterId={characterId !== null && Number.isInteger(characterId) ? characterId : authContext.current?.id} tabName={tabName ?? 'characters'} />
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
        </ProfileMastDOM>
    )
}

const ProfileNav = ({ options, onChange }) => {
    const [ tab, selectTab ] = useState(() => {
        let urlParts = window.location.pathname.split('/');
        if (Number.isInteger(urlParts[urlParts.length-1])) {
            return "fit-check";
        }
        return urlParts[urlParts.length-1];
    });
    

    useEffect(() => {
        onChange(tab);
    }, [tab]);

    return (
        <ProfileNavDom>   
            <div className="large">
                {options.map((option, key) => {
                    return (
                        <span key={key}>
                            <input id={key} type="radio" name="profile-nav" checked={option.text == tab} onChange={e => selectTab(option.text)}/>
                            <label htmlFor={key}>
                                <FontAwesomeIcon fixedWidth icon={option.icon} /> {option.text}
                            </label>
                        </span>
                    )
                })}
            </div>

            <div className="small">
                <Label>Page Navigation:</Label>
                <Select value={tab} onChange={e => selectTab(e.target.value)}>
                    {options.map((option, key) => {                    
                        return <option key={key}> 
                            {option.text}
                        </option>
                    })}
                </Select>
            </div>
        </ProfileNavDom>
    );
}

const View = ({ characterId, tabName }) => {
    const [ account ] = useApi(`/api/profile/${characterId}`);
    usePageTitle(account?.main?.name ?? `Profile`);
       
    return (
        <>
            <ProfileMast character={account?.main} />

            <ProfileNav
                options={[{ icon: faUsers, text: "Characters" }, { icon: faClipboardCheck, text: "Fit Check" }, { icon: faHistory, text: "History" }, { icon: faTasks, text: "Skills" }, { icon: faComment, text: "Notes" }]}
                onChange={e => console.log(e)}//window.location.assign(`/profile/${characterId}/${e?.toLowerCase().replace(/ /g, "-")}`)}
            />

            <div style={{ padding: "10px" }}>
                <Route exact path={[`/profile`, `/profile/:characterId(\\d+)`]}>
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
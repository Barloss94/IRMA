import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOrg } from "../hooks/useOrgAccess";
import { useDashboard } from "../hooks/useDashboard";
import { formatMatchDate } from "../matchDates";

export default function DashboardPage() {
  const { orgId } = useParams();
  const { role, userId, name } = useOrg();
  const coordinator = role === "coordinator" || role === "head_coordinator";
  const [revision, setRevision] = useState(0);
  const { loading, error, counts, next } = useDashboard(orgId, userId, coordinator, revision);
  const base = `/org/${orgId}`;
  const stats = [
    { title: "Komende wedstrijden", value: counts.upcoming, to: `${base}/matches` },
    { title: "Mijn komende aanstellingen", value: counts.own, to: `${base}/my-matches` },
    ...(coordinator ? [
      { title: "Zonder scheidsrechter", value: counts.unassigned, to: `${base}/matches`, attention: counts.unassigned > 0 },
      { title: "Gekoppelde personen", value: counts.members, to: `${base}/coordinator/referees` },
    ] : []),
  ];
  return <div><p className="eyebrow">{name || "Jouw vereniging"}</p><div className="page-heading"><div><h1>Dashboard</h1><p className="muted">{coordinator ? "Het actuele overzicht van je vereniging." : "Jouw aanstellingen en het wedstrijdprogramma."}</p></div><button className="secondary-button" disabled={loading} onClick={() => setRevision((n) => n + 1)}>Vernieuwen</button></div>
    {error && <div className="alert error" role="alert">{error}</div>}
    {loading ? <p role="status">Dashboard laden…</p> : !error && <><div className="stats-grid">{stats.map((stat) => <Link className={`stat-card${stat.attention ? " attention" : ""}`} to={stat.to} key={stat.title}><span>{stat.title}</span><strong>{stat.value}</strong><span className="text-link">Bekijk overzicht →</span></Link>)}</div>
    <section className="panel"><div className="page-heading"><h2>{coordinator ? "Eerstvolgende wedstrijden" : "Mijn eerstvolgende wedstrijden"}</h2><Link className="text-link" to={coordinator ? `${base}/matches` : `${base}/my-matches`}>Bekijk alles →</Link></div>
      {!next.length ? <div className="dashboard-empty"><p className="muted">{coordinator ? "Er staan nog geen komende wedstrijden gepland." : "Je bent nog niet aangesteld voor een komende wedstrijd."}</p><Link className="button-link" to={`${base}/matches`}>Naar wedstrijden</Link></div> : <ul className="dashboard-matches">{next.map((match) => <li key={match.id}><div><strong>{match.home_team || "Thuisteam"} – {match.away_team || "Uitteam"}</strong><p>{formatMatchDate(match.starts_at)} · {match.location || "Locatie nog niet ingevuld"}</p></div>{coordinator && <span className={`badge${match.assignments?.length ? "" : " warning"}`}>{match.assignments?.length ? "Aangesteld" : "Nog aanstellen"}</span>}</li>)}</ul>}
    </section></>}
    <div className="dashboard-grid"><Link className="module-card" to={`${base}/my-matches`}><h2>Mijn wedstrijden</h2><p>Bekijk alle eigen aanstellingen, inclusief afgelopen wedstrijden.</p><span className="text-link">Mijn wedstrijden →</span></Link><Link className="module-card" to={`${base}/profile`}><h2>Mijn profiel</h2><p>Wijzig je naam of stel een nieuw wachtwoord in.</p><span className="text-link">Profiel beheren →</span></Link></div>
  </div>;
}

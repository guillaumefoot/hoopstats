import type { Match } from './basket.ts'
import { clubName, teamName } from './club.ts'
import { Icon } from './Icon.tsx'
import type { IconName } from './Icon.tsx'
import { MatchList } from './MatchList.tsx'

const shortcuts: { href: string; title: string; detail: string; icon: IconName }[] = [
  { href: '#nouveau', title: 'Nouveau match', detail: 'Préparer la feuille de départ', icon: 'play' },
  { href: '#equipe', title: 'Effectif', detail: 'Gérer les joueurs du club', icon: 'team' },
  { href: '#matchs', title: 'Historique', detail: 'Retrouver les rencontres', icon: 'calendar' },
  { href: '#stats', title: 'Statistiques', detail: 'Voir le bilan de saison', icon: 'stats' },
]

export function Home({ resume, recent }: { resume?: Match; recent: Match[] }) {
  return <div className="club-home">
    <section className="club-hero" aria-labelledby="club-title">
      <svg className="hero-court" aria-hidden="true" viewBox="0 0 480 250" fill="none">
        <path d="M479 3H2v244h477zM241 3v244M1 62h80v126H1m478-126h-79v126h79M81 88a37 37 0 1 1 0 74m319-74a37 37 0 1 0 0 74" />
        <circle cx="241" cy="125" r="43" /><path d="M32 3a122 122 0 0 1 0 244m416-244a122 122 0 0 0 0 244" />
      </svg>
      <img className="club-crest" src={`${import.meta.env.BASE_URL}brignoles-basket-ball.png`} alt="" width="72" height="72" />
      <div className="club-hero-text">
        <p className="eyebrow">Espace club</p>
        <h1 id="club-title">{clubName}</h1>
        <p>Basket loisir</p>
      </div>
    </section>
    <div className="home-grid">
      <section className="home-actions" aria-labelledby="home-actions-title">
        <div className="home-section-heading"><h2 id="home-actions-title">Accès rapides</h2></div>
        {resume && <a className="resume-card" href={`#match/${resume.id}`}>
          <span className="tile-icon"><Icon name="play" /></span>
          <span><strong>Reprendre le match</strong><small>{teamName(resume.homeTeamName)} – {resume.opponentName}</small></span>
          <Icon name="chevron" size={17} />
        </a>}
        <div className="shortcut-grid">
          {shortcuts.map(({ href, title, detail, icon }, index) => <a className={`shortcut${index === 0 ? ' new-match-tile' : ''}`} href={href} key={href}>
            <span className="tile-icon"><Icon name={icon} size={23} /></span>
            <span className="shortcut-arrow"><Icon name="chevron" size={16} /></span>
            <strong>{title}</strong>
            <small>{detail}</small>
          </a>)}
        </div>
      </section>
      <section className="home-recent" aria-labelledby="home-recent-title">
        <div className="home-section-heading"><h2 id="home-recent-title">Derniers matchs</h2>
          {recent.length > 0 && <a className="text-button" href="#matchs">Tout voir <Icon name="chevron" size={14} /></a>}
        </div>
        {recent.length > 0 ? <MatchList matches={recent} /> : <div className="empty-card">
          <span className="tile-icon"><Icon name="calendar" /></span>
          <h3>Aucun match enregistré</h3>
          <p className="muted">Tes rencontres et leurs scores apparaîtront ici.</p>
        </div>}
      </section>
    </div>
  </div>
}

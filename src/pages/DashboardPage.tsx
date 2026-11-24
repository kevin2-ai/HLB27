import { ArrowUpRight, CalendarDays, Crown, Medal, Sparkles, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTasks } from '../hooks/useTasks'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useAuth } from '../hooks/useAuth'
import { currentWeek, formatDateRange, portoNovoDate } from '../lib/dates'
import { SPECIALTY_LABELS } from '../data/members'

function rankLabel(rank: number) {
  if (rank === 1) return '1er'
  if (rank === 2) return '2e'
  if (rank === 3) return '3e'
  return `${rank}e`
}

export default function DashboardPage() {
  const { profile, user } = useAuth()
  const { tasks, completions, loading, error } = useTasks()
  const { rows, teamScore, error: scoreError } = useLeaderboard()
  const today = portoNovoDate()
  const todayLabel = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Porto-Novo', dateStyle: 'medium' }).format(new Date(`${today}T12:00:00Z`))
  const week = currentWeek(today)
  const dailyTasks = tasks.filter((task) => task.kind === 'daily')
  const ownCompletions = completions.filter((item) => item.user_id === user?.id && item.cancelled_at === null)
  const ownDailyTasks = dailyTasks.filter((task) => task.week === week)
  const weekDone = ownDailyTasks.filter((task) => ownCompletions.some((item) => item.task_id === task.id)).length
  const daysDone = dailyTasks.filter((task) => ownCompletions.some((item) => item.task_id === task.id)).length
  const todayTask = dailyTasks.find((task) => task.starts_on === today)
  const todayDone = todayTask ? ownCompletions.some((item) => item.task_id === todayTask.id) : false
  const me = rows.find((row) => row.user_id === user?.id)

  return <div className="dashboard-page">
    <section className="dashboard-hero panel">
      <div className="dashboard-hero-main">
        <img className="dashboard-hero-image" src={`${import.meta.env.BASE_URL}hlb.jpg`} alt="Logo HackerLab 2027" />
        <div className="dashboard-hero-copy"><span className="eyebrow">HACKERLAB BÉNIN · 2027</span><h1 className="title-gradient">La préparation commence</h1><p>Un jour après l’autre, jusqu’au prochain CTF.</p></div>
      </div>
      <div className="hero-week"><span>SEMAINE EN COURS</span><strong>S{String(week).padStart(2, '0')} <small>/ 24</small></strong><em>{formatDateRange(week)}</em></div>
    </section>

    {(error || scoreError) && <div className="notice warning">{error ?? scoreError}</div>}
    {loading ? <div className="panel loading-card">Chargement de tes séances…</div> : <>
      <div className="stats-row">
        <article className="stat-card panel"><span>MES POINTS</span><strong>{me?.points ?? 0}</strong><small>Classement cumulé</small></article>
        <article className="stat-card panel"><span>MON RANG</span><strong>{me ? rankLabel(me.rank) : '—'}</strong><small>{rows.length ? `sur ${rows.length} membres` : 'Classement à venir'}</small></article>
        <article className="stat-card panel"><span>CETTE SEMAINE</span><strong>{weekDone}<small> / 7</small></strong><small>Séances validées</small></article>
      </div>

      <div className="dashboard-columns">
        <section className="panel daily-home-card">
          <div className="section-title"><div><span className="eyebrow">TA PRÉPARATION</span><h2>24 semaines · 168 jours</h2></div><CalendarDays size={18} /></div>
          <div className="daily-home-count"><strong>{daysDone}</strong><span>/ 168 jours validés</span></div>
          <div className="daily-progress-track"><i style={{ width: `${Math.min(100, daysDone / 168 * 100)}%` }} /></div>
          <div className={`today-status${todayDone ? ' done' : ''}`}><span>{todayTask ? `Jour ${todayTask.sort_order} · ${todayLabel}` : todayLabel}</span><strong>{todayDone ? 'Séance validée · +10 pts' : 'Séance du jour à valider'}</strong></div>
          <Link className="button-primary daily-home-link" to="/planning">Ouvrir mon planning</Link>
        </section>
        <aside className="side-stack">
          <section className="panel specialty-card"><div className="section-title compact"><div><span className="eyebrow">MES SPÉCIALITÉS</span><h2>Mes compartiments</h2></div><Sparkles size={17} /></div>
            {[profile?.main_spec, profile?.second_spec, profile?.third_spec].filter((key): key is string => Boolean(key)).map((key, index) => <div className="specialty-item" key={key}><div className="specialty-head"><strong>{SPECIALTY_LABELS[key] ?? key}</strong><span>{['Principale', 'Secondaire', 'Troisième'][index]}</span></div></div>)}
            {profile?.member_key === 'kevin' && <div className="optional-module"><Sparkles size={14} /> Module optionnel proposé : <strong>Système / pwn</strong></div>}
          </section>

          <section className="panel team-score-card"><div className="score-icon"><Trophy size={18} /></div><div><span className="eyebrow">SCORE D’ÉQUIPE</span><strong>{teamScore?.total ?? 0}</strong><small>Indépendant de tes points</small></div><ArrowUpRight size={16} /></section>
          <section className="panel mini-ranking"><div className="section-title compact"><div><span className="eyebrow">LE GROUPE</span><h2>Classement</h2></div><Medal size={18} /></div>
            {rows.slice(0, 3).map((row, index) => <div className={`ranking-line${row.user_id === user?.id ? ' mine' : ''}`} key={row.user_id}><span>{index === 0 ? <Crown size={14} /> : index + 1}</span><strong>{row.pseudo}</strong><b>{row.points} pts</b></div>)}
          </section>
        </aside>
      </div>
    </>}
  </div>
}

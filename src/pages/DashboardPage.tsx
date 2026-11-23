import { ArrowUpRight, CalendarDays, Crown, Medal, Sparkles, Trophy } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useAuth } from '../hooks/useAuth'
import TaskItem from '../components/TaskItem'
import { currentWeek, formatDateRange, portoNovoDate } from '../lib/dates'
import { SPECIALTY_LABELS } from '../data/members'
import type { CompletionRow } from '../lib/database.types'

function rankLabel(rank: number) {
  if (rank === 1) return '1er'
  if (rank === 2) return '2e'
  if (rank === 3) return '3e'
  return `${rank}e`
}

export default function DashboardPage() {
  const { profile, user } = useAuth()
  const { tasks, completions, setCompletions, loading, error } = useTasks()
  const { rows, teamScore, error: scoreError } = useLeaderboard()
  const today = portoNovoDate()
  const week = currentWeek(today)
  const ownTasks = tasks.filter((task) => task.week === week && (!task.owner_member || task.owner_member === profile?.member_key))
  const ownCompletions = completions.filter((item) => item.user_id === user?.id && item.cancelled_at === null)
  const weekDone = ownTasks.filter((task) => ownCompletions.some((item) => item.task_id === task.id)).length
  const me = rows.find((row) => row.user_id === user?.id)
  const nextTeam = tasks.find((task) => task.kind === 'team' && task.ends_on >= today)
  const nextPresentation = tasks.find((task) => task.presenter_member === profile?.member_key && task.ends_on >= today)

  function changeCompletion(taskId: string, completion: CompletionRow | null) {
    setCompletions((current) => {
      const existing = current.filter((item) => !(item.user_id === user?.id && item.task_id === taskId))
      return completion ? [...existing, completion] : existing
    })
  }

  function specialtyProgress(key: string) {
    return [1, 2, 3].map((level) => {
      const levelTasks = tasks.filter((task) => task.kind === 'individual' && task.owner_member === profile?.member_key && task.topic === key && task.level === level)
      const done = levelTasks.filter((task) => ownCompletions.some((item) => item.task_id === task.id)).length
      return { level, done, total: levelTasks.length }
    })
  }

  return <div className="dashboard-page">
    <section className="dashboard-hero panel">
      <div><span className="eyebrow">HACKERLAB BÉNIN · 2027</span><h1 className="title-gradient">La préparation commence</h1><p>Chaque séance nous rapproche du prochain CTF.</p></div>
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
        <section className="section-block">
          <div className="section-title"><div><span className="eyebrow">TON PROGRAMME</span><h2>Cette semaine</h2></div><span className="section-date">{formatDateRange(week)}</span></div>
          {ownTasks.length ? <div className="task-list">{ownTasks.map((task) => <TaskItem key={task.id} task={task} completion={completions.find((item) => item.user_id === user?.id && item.task_id === task.id)} onCompletionChange={(completion) => changeCompletion(task.id, completion)} />)}</div> : <div className="panel empty-inline">{loading ? 'Chargement…' : 'Le planning n’est pas encore installé dans Supabase.'}</div>}
        </section>

        <aside className="side-stack">
          <section className="panel specialty-card"><div className="section-title compact"><div><span className="eyebrow">MES SPÉCIALITÉS</span><h2>Mes compartiments</h2></div><Sparkles size={17} /></div>
            {[profile?.main_spec, profile?.second_spec].filter((key): key is string => Boolean(key)).map((key, index) => <div className="specialty-item" key={key}><div className="specialty-head"><strong>{SPECIALTY_LABELS[key] ?? key}</strong><span>{index === 0 ? 'Principale' : 'Secondaire'}</span></div><div className="level-grid">{specialtyProgress(key).map((progress) => <div key={progress.level}><small>N{progress.level}</small><strong>{progress.done}<i>/{progress.total}</i></strong></div>)}</div></div>)}
            {profile?.member_key === 'kevin' && <div className="optional-module"><Sparkles size={14} /> Module optionnel proposé : <strong>Système / pwn</strong></div>}
          </section>

          <section className="panel next-card"><span className="eyebrow">À VENIR</span><h2><CalendarDays size={17} /> Prochaine séance d’équipe</h2><p>{nextTeam ? nextTeam.title : 'Les séances seront bientôt disponibles.'}</p>{nextTeam && <small>{nextTeam.starts_on} · S{String(nextTeam.week).padStart(2, '0')}</small>}</section>
          <section className="panel next-card"><span className="eyebrow">TON TOUR DE PRÉSENTER</span><h2><Sparkles size={17} /> Ma prochaine présentation</h2><p>{nextPresentation ? nextPresentation.title : 'Aucune présentation à venir.'}</p>{nextPresentation && <small>{nextPresentation.starts_on} · S{String(nextPresentation.week).padStart(2, '0')}</small>}</section>

          <section className="panel team-score-card"><div className="score-icon"><Trophy size={18} /></div><div><span className="eyebrow">SCORE D’ÉQUIPE</span><strong>{teamScore?.total ?? 0}</strong><small>Indépendant de tes points</small></div><ArrowUpRight size={16} /></section>
          <section className="panel mini-ranking"><div className="section-title compact"><div><span className="eyebrow">LE GROUPE</span><h2>Classement</h2></div><Medal size={18} /></div>
            {rows.slice(0, 3).map((row, index) => <div className={`ranking-line${row.user_id === user?.id ? ' mine' : ''}`} key={row.user_id}><span>{index === 0 ? <Crown size={14} /> : index + 1}</span><strong>{row.pseudo}</strong><b>{row.points} pts</b></div>)}
          </section>
        </aside>
      </div>
    </>}
  </div>
}

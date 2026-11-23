import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Crown, Medal, Trophy } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { MEMBERS } from '../data/members'
import { CONFIG } from '../config'
import { formatPortoDateTime } from '../lib/dates'

type Adjustment = { id: number; user_id: string; delta: number; reason: string; created_at: string }
type TeamEvent = { id: number; points: number; reason: string; created_at: string }

function dateLabel(value: string) {
  return formatPortoDateTime(value)
}

export default function TeamPage() {
  const { user } = useAuth()
  const { tasks, completions, profiles, loading: taskLoading, error: taskError } = useTasks()
  const { rows, teamScore, loading: scoreLoading, error: scoreError } = useLeaderboard()
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [events, setEvents] = useState<TeamEvent[]>([])
  const [historyError, setHistoryError] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!supabase) return
    Promise.all([
      supabase.from('point_adjustments').select('id,user_id,delta,reason,created_at').order('created_at', { ascending: false }).limit(10),
      supabase.from('team_score_events').select('id,points,reason,created_at').order('created_at', { ascending: false }).limit(10),
    ]).then(([adjustmentResult, eventResult]) => {
      if (adjustmentResult.error || eventResult.error) setHistoryError('L’historique est temporairement indisponible.')
      else {
        setAdjustments(adjustmentResult.data ?? [])
        setEvents(eventResult.data ?? [])
        const latestId = eventResult.data?.[0]?.id
        if (latestId !== undefined) {
          const key = 'hackerlab:last-seen-team-event'
          const previousId = window.localStorage.getItem(key)
          if (previousId && previousId !== String(latestId) && !reduceMotion) {
            setShowConfetti(true)
            window.setTimeout(() => setShowConfetti(false), 900)
          }
          window.localStorage.setItem(key, String(latestId))
        }
      }
    })
  }, [reduceMotion])

  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles])
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const progressCounts = useMemo(() => {
    const counts = new Map<string, number>()
    completions.forEach((completion) => {
      if (completion.cancelled_at !== null) return
      const week = taskById.get(completion.task_id)?.week
      if (week === undefined) return
      const key = `${completion.user_id}:${week}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return counts
  }, [completions, taskById])
  const activity = useMemo(() => [
    ...completions.filter((item) => item.cancelled_at === null).map((item) => ({
      key: `c-${item.id}`, date: item.completed_at, kind: 'session',
      description: `${profileById.get(item.user_id)?.pseudo ?? 'Un membre'} a terminé ${taskById.get(item.task_id)?.title ?? 'une séance'}`,
    })),
    ...adjustments.map((item) => ({
      key: `a-${item.id}`, date: item.created_at, kind: 'adjustment',
      description: `${profileById.get(item.user_id)?.pseudo ?? 'Un membre'} : ajustement de ${item.delta > 0 ? '+' : ''}${item.delta} points · ${item.reason}`,
    })),
    ...events.map((item) => ({ key: `t-${item.id}`, date: item.created_at, kind: 'team', description: `Score d’équipe +${item.points} · ${item.reason}` })),
  ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 12), [adjustments, completions, events, profileById, taskById])

  const isLoading = taskLoading || scoreLoading
  return <div className="team-page">
    {showConfetti && <div className="confetti-layer" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} style={{ left: `${5 + (index * 17) % 91}%`, animationDelay: `${(index % 6) * 55}ms`, rotate: `${(index * 37) % 180}deg` }} />)}</div>}
    <header className="page-heading"><span className="eyebrow">SUIVI COLLECTIF</span><h1 className="title-gradient">Espace équipe</h1><p>Les progrès de chacun, le chemin de toute l’équipe.</p></header>
    {(taskError || scoreError || historyError) && <div className="notice warning">{taskError ?? scoreError ?? historyError}</div>}
    {isLoading ? <div className="panel loading-card">Chargement des scores…</div> : <>
      <section className="team-score-hero panel"><div className="team-trophy"><Trophy size={24} /></div><div><span className="eyebrow">SCORE D’ÉQUIPE</span><strong>{teamScore?.total ?? 0}</strong><p>Indépendant des scores individuels</p></div><span className="score-event-count">{teamScore?.events ?? 0} événement{teamScore?.events === 1 ? '' : 's'}</span></section>
      <div className="team-columns">
        <section className="panel leaderboard-panel"><div className="section-title"><div><span className="eyebrow">CLASSEMENT GÉNÉRAL</span><h2>Points individuels</h2></div><Medal size={19} /></div>
          {rows.map((row) => <div className={`leaderboard-row${row.user_id === user?.id ? ' mine' : ''}${row.rank <= 3 ? ` podium podium-${row.rank}` : ''}`} key={row.user_id}>
            <span className="leaderboard-rank">{row.rank === 1 ? <Crown size={17} /> : row.rank}</span><span className="leaderboard-name">{row.pseudo}{row.user_id === user?.id && <small>Toi</small>}</span><span className="leaderboard-sessions">{row.sessions_done} séance{row.sessions_done === 1 ? '' : 's'}</span><strong>{row.points}<small> pts</small></strong>
          </div>)}
          {!rows.length && <p className="muted-copy">Le classement s’affichera dès la création des premiers comptes.</p>}
        </section>
        <section className="panel wins-panel"><div className="section-title"><div><span className="eyebrow">VICTOIRES CTF</span><h2>Score d’équipe</h2></div><Trophy size={18} /></div>
          {!events.length && <p className="muted-copy">Les événements ajoutés par Kevin apparaîtront ici.</p>}
          {events.map((event) => <article className="win-event" key={event.id}><div><strong>{event.reason}</strong><small>{dateLabel(event.created_at)}</small></div><b>+{event.points}</b></article>)}
        </section>
      </div>

      <section className="panel activity-panel"><div className="section-title"><div><span className="eyebrow">DERNIÈRES ACTIVITÉS</span><h2>Le fil de l’équipe</h2></div></div>
        {!activity.length && <p className="muted-copy">Les séances terminées et les points ajoutés apparaîtront ici.</p>}
        {activity.map((item) => <div className={`activity-row activity-${item.kind}`} key={item.key}><span className="activity-dot" /><p>{item.description}</p><time>{dateLabel(item.date)}</time></div>)}
      </section>

      <section className="panel progress-panel"><div className="section-title"><div><span className="eyebrow">VUE EN LECTURE SEULE</span><h2>Progression sur 24 semaines</h2></div></div>
        <div className="progress-legend"><span><i className="tile-empty" /> aucune</span><span><i className="tile-some" /> séances cochées</span><span><i className="tile-full" /> 7 séances</span></div>
        <div className="progress-scroll"><div className="progress-grid">
          <div className="progress-member-head" />{Array.from({ length: CONFIG.TOTAL_WEEKS }, (_, i) => <span className="progress-week-head" key={i}>S{i + 1}</span>)}
          {MEMBERS.map((member) => {
            const memberId = profiles.find((profile) => profile.member_key === member.key)?.id
            return <div className="progress-member-row" key={member.key}>
              <strong>{member.pseudo}</strong>
              {Array.from({ length: CONFIG.TOTAL_WEEKS }, (_, i) => {
                const count = memberId ? progressCounts.get(`${memberId}:${i + 1}`) ?? 0 : 0
                const tone = count === 0 ? 'tile-empty' : count >= 7 ? 'tile-full' : 'tile-some'
                return <span key={i} className={`progress-tile ${tone}`} title={`${member.pseudo} · S${i + 1} · ${count} séance${count === 1 ? '' : 's'}`} aria-label={`${member.pseudo}, semaine ${i + 1}, ${count} séances`} />
              })}
            </div>
          })}
        </div></div>
      </section>
    </>}
  </div>
}

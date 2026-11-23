import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react'
import TaskItem from '../components/TaskItem'
import { useTasks } from '../hooks/useTasks'
import { useAuth } from '../hooks/useAuth'
import { currentWeek, formatDateRange } from '../lib/dates'
import type { CompletionRow } from '../lib/database.types'
import compartments from '../data/compartments.json'

const periods = [
  { start: 1, end: 1, name: 'Mise en place' },
  { start: 2, end: 7, name: 'Cycle 1 · Niveau 1' },
  { start: 8, end: 13, name: 'Cycle 2 · Niveau 2' },
  { start: 14, end: 19, name: 'Cycle 3 · Niveau 3' },
  { start: 20, end: 23, name: 'Simulations' },
  { start: 24, end: 24, name: 'Affûtage' },
]

export default function PlanningPage() {
  const { profile, user } = useAuth()
  const { tasks, completions, setCompletions, profiles, loading, error } = useTasks()
  const activeWeek = currentWeek()
  const [openWeek, setOpenWeek] = useState(activeWeek)
  const [filter, setFilter] = useState<'mine' | 'all'>('mine')
  const weeks = useMemo(() => Array.from({ length: 24 }, (_, index) => index + 1), [])

  function changeCompletion(taskId: string, completion: CompletionRow | null) {
    setCompletions((current) => {
      const existing = current.filter((item) => !(item.user_id === user?.id && item.task_id === taskId))
      return completion ? [...existing, completion] : existing
    })
  }

  return <div className="planning-page">
    <header className="page-heading"><span className="eyebrow">23 NOV. 2026 — 9 MAI 2027</span><h1 className="title-gradient">Planning</h1><p>24 semaines de pratique, de partage et de préparation au CTF.</p></header>
    <div className="planning-toolbar"><div className="filter-tabs" aria-label="Filtrer les séances"><button className={filter === 'mine' ? 'selected' : ''} onClick={() => setFilter('mine')}>Mes séances</button><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Toutes les séances</button></div><span><SlidersHorizontal size={14} /> {filter === 'mine' ? 'Séances collectives et personnelles' : 'Lecture seule pour les autres membres'}</span></div>
    {error && <div className="notice warning">{error}</div>}
    {loading && <div className="panel loading-card">Chargement des 24 semaines…</div>}
    {!loading && !tasks.length && <div className="panel empty-inline">Le planning n’est pas encore installé dans Supabase. Exécute `supabase/seed_tasks.sql` pour le charger.</div>}
    {!loading && weeks.map((week) => {
      const period = periods.find((item) => week >= item.start && week <= item.end)?.name ?? ''
      const weeklyTasks = tasks.filter((task) => task.week === week && (filter === 'all' || !task.owner_member || task.owner_member === profile?.member_key))
      const doneCount = weeklyTasks.filter((task) => completions.some((item) => item.user_id === user?.id && item.task_id === task.id && item.cancelled_at === null)).length
      const isOpen = week === openWeek
      return <section className={`week-accordion panel${week === activeWeek ? ' current-week' : ''}`} key={week}>
        <button className="week-accordion-head" aria-expanded={isOpen} onClick={() => setOpenWeek(isOpen ? 0 : week)}>
          <span className="week-number">S{String(week).padStart(2, '0')}</span><span className="week-head-copy"><strong>{period}</strong><small>{formatDateRange(week)} · {doneCount} séance{doneCount === 1 ? '' : 's'} cochée{doneCount === 1 ? '' : 's'}</small></span>{week === activeWeek && <span className="current-pill">EN COURS</span>}{isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {isOpen && <div className="week-accordion-content">
          {weeklyTasks.map((task) => {
            const ownerProfile = task.owner_member ? profiles.find((item) => item.member_key === task.owner_member) : undefined
            const completionOwnerId = task.owner_member ? ownerProfile?.id : user?.id
            const completion = completions.find((item) => item.user_id === completionOwnerId && item.task_id === task.id)
            const readOnly = Boolean(task.owner_member && task.owner_member !== profile?.member_key)
            return <TaskItem key={task.id} task={task} completion={completion} readOnly={readOnly} ownerLabel={ownerProfile?.pseudo} onCompletionChange={(next) => changeCompletion(task.id, next)} />
          })}
          {!weeklyTasks.length && <p className="muted-copy">Aucune séance à afficher pour cette semaine.</p>}
        </div>}
      </section>
    })}
    <section className="resources-directory"><div className="resources-intro"><span className="eyebrow">RESSOURCES</span><h2>Compartiments de spécialité</h2><p>Objectifs et liens de travail, classés par domaine et par niveau.</p></div>
      {Object.entries(compartments).map(([key, compartment]) => <details className="panel resource-compartment" key={key}>
        <summary><strong>{compartment.name}</strong>{'optional' in compartment && compartment.optional && <span className="optional-tag">Optionnel · à confirmer</span>}</summary>
        <div className="resource-levels">{Object.entries(compartment.levels).map(([level, data]) => <section className="resource-level" key={level}><h3>Niveau {level} · {data.label}</h3><ul>{data.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul><div className="resource-links">{data.resources.map((resource) => <a key={resource.url} href={resource.url} target="_blank" rel="noopener noreferrer">{resource.name}</a>)}</div></section>)}</div>
      </details>)}
    </section>
  </div>
}

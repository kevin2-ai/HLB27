import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, ChevronUp, Clock3, ExternalLink, LockKeyhole, RotateCcw } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { CompletionRow, TaskRow } from '../lib/database.types'
import { portoNovoDate } from '../lib/dates'
import { notifyScoresChanged } from '../lib/events'

type Resource = { name: string; url: string }
type TaskDetail = { objectives?: string[]; resources?: Resource[] }

function serverMessage(message: string) {
  if (message.includes('autre membre')) return message
  if (message.includes('pas encore ouverte')) return 'Cette séance n’est pas encore ouverte.'
  if (message.includes('impossible de la rattraper')) return 'La semaine est terminée : cette séance ne peut plus être cochée.'
  if (message.includes('duplicate key')) return 'Cette séance est déjà cochée.'
  return 'La validation a échoué. Vérifie ta connexion et réessaie.'
}

export default function TaskItem({ task, completion, onCompletionChange, readOnly = false, ownerLabel }: {
  task: TaskRow
  completion?: CompletionRow
  onCompletionChange: (completion: CompletionRow | null) => void
  readOnly?: boolean
  ownerLabel?: string
}) {
  const { user, profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const [optimistic, setOptimistic] = useState(false)
  const [showPoints, setShowPoints] = useState(false)
  const reduceMotion = useReducedMotion()
  const today = portoNovoDate()
  const isCompleted = completion ? completion.cancelled_at === null : optimistic
  const cancelled = Boolean(completion?.cancelled_at)
  const locked = today < task.starts_on || today > task.ends_on
  const score = task.presenter_member && task.presenter_member === profile?.member_key ? 15 : 10
  const detail = useMemo<TaskDetail | null>(() => {
    if (!task.description?.startsWith('{')) return null
    try { return JSON.parse(task.description) as TaskDetail } catch { return null }
  }, [task.description])

  async function toggle() {
    if (!supabase || !user || busy || locked || cancelled) return
    setBusy(true)
    setError('')
    if (isCompleted && completion) {
      onCompletionChange(null)
      const { error: deleteError } = await supabase.from('completions').delete().eq('id', completion.id)
      if (deleteError) {
        onCompletionChange(completion)
        setError(serverMessage(deleteError.message))
      } else notifyScoresChanged()
    } else {
      setOptimistic(true)
      const { data, error: insertError } = await supabase.from('completions').insert({ user_id: user.id, task_id: task.id }).select('*').single()
      if (insertError) {
        setOptimistic(false)
        setError(serverMessage(insertError.message))
      } else if (data) {
        setOptimistic(false)
        onCompletionChange(data)
        notifyScoresChanged()
        setShowPoints(true)
        window.setTimeout(() => setShowPoints(false), 580)
      }
    }
    setBusy(false)
  }

  return (
    <motion.article className={`task-card${isCompleted ? ' task-done' : ''}${cancelled ? ' task-cancelled' : ''}`} initial={reduceMotion ? false : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }}>
      <button className="task-check" type="button" role="checkbox" aria-checked={isCompleted} aria-label={`${isCompleted ? 'Décocher' : 'Cocher'} ${task.title}`} disabled={readOnly || locked || cancelled || busy} onClick={() => void toggle()}>
        {isCompleted && <Check size={16} strokeWidth={3} />}
        {busy && <span className="spinner" />}
        {showPoints && !reduceMotion && <span className="points-float">+{score}</span>}
      </button>
      <div className="task-body">
        <div className="task-heading">
          <span className={`task-kind kind-${task.kind}`}>{task.kind === 'general' ? 'Générale' : task.kind === 'team' ? 'Équipe' : 'Individuelle'}</span>
          {task.level && <span className="task-level">Niveau {task.level}</span>}
          <span className="task-points">+{score}</span>
        </div>
        <h3>{task.title}</h3>
        {task.presenter_member === profile?.member_key && <span className="presenter-badge">Tu présentes ! · +5</span>}
        {cancelled && <p className="task-state error-text">Annulée par l’admin : {completion?.cancel_reason}</p>}
        {!cancelled && locked && <p className="task-state"><LockKeyhole size={13} /> {today < task.starts_on ? `Ouverture le ${task.starts_on}` : 'Semaine terminée — séance verrouillée'}</p>}
        {error && <p className="task-state error-text" role="alert">{error}</p>}
        {task.topic && <p className="task-topic">{task.topic}</p>}
        {readOnly && <p className="task-state">Lecture seule · tâche attribuée à {ownerLabel ?? task.owner_member}</p>}
        {task.description && !detail && <p className="task-description">{task.description}</p>}
        {detail && <button className="detail-toggle" type="button" onClick={() => setShowDetail((current) => !current)}>{showDetail ? 'Masquer le détail' : 'Voir le détail'} {showDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}
        {showDetail && detail && <div className="task-detail">
          {!!detail.objectives?.length && <><strong>Objectifs</strong><ul>{detail.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul></>}
          {!!detail.resources?.length && <><strong>Ressources</strong><ul>{detail.resources.map((resource) => <li key={resource.url}><a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.name}<ExternalLink size={12} /></a></li>)}</ul></>}
        </div>}
        {completion && !cancelled && !locked && <span className="task-state"><RotateCcw size={12} /> Tu peux encore décocher avant dimanche.</span>}
        {locked && <span className="sr-only"><Clock3 size={1} /> Validation indisponible</span>}
      </div>
    </motion.article>
  )
}

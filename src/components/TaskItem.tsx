import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, ChevronUp, ExternalLink, RotateCcw, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { CompletionRow, TaskRow } from '../lib/database.types'
import { notifyScoresChanged } from '../lib/events'
import { verifyGitHubWriteup } from '../lib/githubWriteup'

type Resource = { name: string; url: string }
type TaskDetail = { objectives?: string[]; resources?: Resource[] }

function serverMessage(message: string) {
  if (message.includes('autre membre')) return message
  if (message.includes('duplicate key')) return 'Cette séance est déjà cochée.'
  if (message.toLowerCase().includes('writeup') || message.toLowerCase().includes('markdown')) return 'Ajoute un lien GitHub vers un fichier Markdown pour valider cette séance.'
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
  const [showWriteupDialog, setShowWriteupDialog] = useState(false)
  const [writeupDraft, setWriteupDraft] = useState('')
  const [optimistic, setOptimistic] = useState(false)
  const [showPoints, setShowPoints] = useState(false)
  const reduceMotion = useReducedMotion()
  const isCompleted = completion ? completion.cancelled_at === null : optimistic
  const cancelled = Boolean(completion?.cancelled_at)
  const requiresWriteup = task.kind === 'individual' && task.week >= 2
  const score = task.presenter_member && task.presenter_member === profile?.member_key ? 15 : 10
  const detail = useMemo<TaskDetail | null>(() => {
    if (!task.description?.startsWith('{')) return null
    try { return JSON.parse(task.description) as TaskDetail } catch { return null }
  }, [task.description])

  async function toggle(submittedWriteup?: string) {
    if (!supabase || !user || busy || cancelled) return
    if (!isCompleted && requiresWriteup && submittedWriteup === undefined) {
      setError('')
      setWriteupDraft('')
      setShowWriteupDialog(true)
      return
    }
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
      let verifiedWriteup: string | null = null
      if (requiresWriteup && submittedWriteup) {
        const result = await verifyGitHubWriteup(submittedWriteup)
        if (!result.ok) {
          setError(result.message)
          setBusy(false)
          return
        }
        verifiedWriteup = result.url
      }
      setOptimistic(true)
      const { data, error: insertError } = await supabase.from('completions').insert({ user_id: user.id, task_id: task.id, writeup_url: verifiedWriteup }).select('*').single()
      if (insertError) {
        setOptimistic(false)
        setError(serverMessage(insertError.message))
      } else if (data) {
        setOptimistic(false)
        setShowWriteupDialog(false)
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
      <button className="task-check" type="button" role="checkbox" aria-checked={isCompleted} aria-label={`${isCompleted ? 'Décocher' : 'Cocher'} ${task.title}`} disabled={readOnly || cancelled || busy} onClick={() => void toggle()}>
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
        {requiresWriteup && !isCompleted && !cancelled && <span className="task-state writeup-required">Write-up GitHub requis pour valider.</span>}
        {cancelled && <p className="task-state error-text">Annulée par l’admin : {completion?.cancel_reason}</p>}
        {error && <p className="task-state error-text" role="alert">{error}</p>}
        {completion?.writeup_url && !cancelled && <a className="task-writeup-link" href={completion.writeup_url} target="_blank" rel="noopener noreferrer">Voir le write-up <ExternalLink size={13} /></a>}
        {task.topic && <p className="task-topic">{task.topic}</p>}
        {readOnly && <p className="task-state">Lecture seule · tâche attribuée à {ownerLabel ?? task.owner_member}</p>}
        {task.description && !detail && <p className="task-description">{task.description}</p>}
        {detail && <button className="detail-toggle" type="button" onClick={() => setShowDetail((current) => !current)}>{showDetail ? 'Masquer le détail' : 'Voir le détail'} {showDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}
        {showDetail && detail && <div className="task-detail">
          {!!detail.objectives?.length && <><strong>Objectifs</strong><ul>{detail.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul></>}
          {!!detail.resources?.length && <><strong>Ressources</strong><ul>{detail.resources.map((resource) => <li key={resource.url}><a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.name}<ExternalLink size={12} /></a></li>)}</ul></>}
        </div>}
        {completion && !cancelled && <span className="task-state"><RotateCcw size={12} /> Tu peux décocher cette séance à tout moment.</span>}
      </div>
      {showWriteupDialog && <div className="dialog-backdrop writeup-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setShowWriteupDialog(false) }}>
        <section className="panel writeup-dialog" role="dialog" aria-modal="true" aria-labelledby={`writeup-title-${task.id}`}>
          <button className="icon-button writeup-close" type="button" onClick={() => setShowWriteupDialog(false)} disabled={busy} aria-label="Fermer"><X size={17} /></button>
          <span className="eyebrow">PREUVE DE TRAVAIL</span>
          <h3 id={`writeup-title-${task.id}`}>Ajoute ton write-up</h3>
          <p>Colle le lien public vers le fichier Markdown (.md) de ton write-up dans GitHub. Le dépôt et le fichier seront vérifiés avant la validation.</p>
          <form className="writeup-form" onSubmit={(event) => { event.preventDefault(); void toggle(writeupDraft) }}>
            <label htmlFor={`writeup-url-${task.id}`}>Lien GitHub du write-up</label>
            <input id={`writeup-url-${task.id}`} type="url" required value={writeupDraft} onChange={(event) => setWriteupDraft(event.target.value)} placeholder="https://github.com/nom/depot/blob/main/writeups/solution.md" />
            {error && <p className="error-text" role="alert">{error}</p>}
            <div className="dialog-actions"><button className="button-outline" type="button" disabled={busy} onClick={() => setShowWriteupDialog(false)}>Annuler</button><button className="button-primary" type="submit" disabled={busy}>{busy ? 'Vérification GitHub…' : 'Vérifier et valider'}</button></div>
          </form>
        </section>
      </div>}
    </motion.article>
  )
}

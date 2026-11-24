import { useMemo, useState, type FormEvent } from 'react'
import { Check, LockKeyhole, X } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { useAuth } from '../hooks/useAuth'
import { CONFIG } from '../config'
import { portoNovoDate } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { notifyScoresChanged } from '../lib/events'
import { verifyGitHubWriteup } from '../lib/githubWriteup'
import type { CompletionRow, TaskRow } from '../lib/database.types'

type ConfirmStep = 'confirm' | 'faith' | 'sticker' | 'writeup' | 'rejected'

function shortDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: CONFIG.TIMEZONE, day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00Z`))
}

function weekday(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: CONFIG.TIMEZONE, weekday: 'short' }).format(new Date(`${value}T12:00:00Z`))
}

export default function PlanningPage() {
  const { user } = useAuth()
  const { tasks, completions, setCompletions, loading, error } = useTasks()
  const today = portoNovoDate()
  const [activeTask, setActiveTask] = useState<TaskRow | null>(null)
  const [step, setStep] = useState<ConfirmStep>('confirm')
  const [writeup, setWriteup] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const dailyTasks = useMemo(() => tasks.filter((task) => task.kind === 'daily').sort((a, b) => a.week - b.week), [tasks])
  const completionByTask = useMemo(() => new Map(completions.filter((item) => item.user_id === user?.id).map((item) => [item.task_id, item])), [completions, user?.id])
  const doneCount = dailyTasks.filter((task) => completionByTask.get(task.id)?.cancelled_at === null).length
  const currentTask = dailyTasks.find((task) => task.starts_on === today)

  function closeFlow() {
    if (busy) return
    setActiveTask(null)
    setWriteup('')
    setActionError('')
    setStep('confirm')
  }

  function rejectFlow() {
    setActionError('')
    setStep('rejected')
  }

  async function uncheckToday(task: TaskRow, completion: CompletionRow) {
    if (!supabase || busy || task.starts_on !== today || completion.cancelled_at !== null) return
    setBusy(true)
    setCompletions((current) => current.filter((item) => item.id !== completion.id))
    const { error: deleteError } = await supabase.from('completions').delete().eq('id', completion.id)
    if (deleteError) {
      setCompletions((current) => [...current, completion])
      setActionError('Impossible de retirer la validation. Réessaie.')
    } else notifyScoresChanged()
    setBusy(false)
  }

  async function submitWriteup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !user || !activeTask || busy) return
    setBusy(true)
    setActionError('')
    const result = await verifyGitHubWriteup(writeup)
    if (!result.ok) {
      setActionError(result.message)
      setBusy(false)
      return
    }
    const { data, error: insertError } = await supabase.from('completions')
      .insert({ user_id: user.id, task_id: activeTask.id, writeup_url: result.url })
      .select('*').single()
    if (insertError || !data) {
      setActionError(insertError?.message.toLowerCase().includes('seule la case')
        ? 'Seule la case du jour actuel peut être validée.'
        : 'La validation a échoué. Vérifie le lien puis réessaie.')
      setBusy(false)
      return
    }
    setCompletions((current) => [...current.filter((item) => item.id !== data.id), data])
    notifyScoresChanged()
    setBusy(false)
    setActiveTask(null)
    setWriteup('')
    setActionError('')
    setStep('confirm')
  }

  return <div className="planning-page">
    <header className="page-heading"><span className="eyebrow">23 NOV. 2026 — 9 MAI 2027</span><h1 className="title-gradient">Progression quotidienne</h1><p>168 jours pour avancer à ton rythme, une séance par jour.</p></header>
    {(error || (actionError && !activeTask)) && <div className="notice warning">{error ?? actionError}</div>}
    {loading ? <div className="panel loading-card">Chargement des 168 jours…</div> : !dailyTasks.length ? <div className="panel empty-inline">Le nouveau planning n’est pas encore installé. L’administrateur doit exécuter la migration journalière dans Supabase.</div> : <>
      <section className="panel daily-progress-summary">
        <div><span className="eyebrow">TA PROGRESSION</span><strong>{doneCount}<small> / 168 jours</small></strong></div>
        <div className="daily-progress-track"><i style={{ width: `${Math.min(100, doneCount / 168 * 100)}%` }} /></div>
        <p>{currentTask ? `Aujourd’hui : jour ${currentTask.sort_order} · ${shortDate(currentTask.starts_on)}` : 'La période de préparation est terminée.'} Chaque validation rapporte 10 points.</p>
      </section>
      <div className="daily-weeks">
        {Array.from({ length: CONFIG.TOTAL_WEEKS }, (_, weekIndex) => {
          const weekNumber = weekIndex + 1
          const weekTasks = dailyTasks.filter((task) => task.week === weekNumber)
          if (!weekTasks.length) return null
          const weekDone = weekTasks.filter((task) => completionByTask.get(task.id)?.cancelled_at === null).length
          return <section className="panel daily-week" key={weekNumber}>
            <header><div><span className="eyebrow">SEMAINE {String(weekNumber).padStart(2, '0')}</span><strong>{weekDone} / 7 jours</strong></div>{weekNumber === currentTask?.week && <span className="current-pill">EN COURS</span>}</header>
            <div className="daily-grid">{weekTasks.map((task) => {
              const completion = completionByTask.get(task.id)
              const completed = Boolean(completion && completion.cancelled_at === null)
              const cancelled = Boolean(completion?.cancelled_at)
              const isToday = task.starts_on === today
              const isFuture = task.starts_on > today
              const className = `daily-day${completed ? ' completed' : ''}${cancelled ? ' admin-cancelled' : ''}${isToday ? ' today' : ''}${isFuture ? ' future' : ''}`
              return <div className={className} key={task.id}>
                <span className="daily-date-label">Jour {task.sort_order}</span>
                <span className="daily-weekday">{weekday(task.starts_on)}</span>
                <button type="button" className="daily-check" aria-label={`${isToday ? (completed ? 'Décocher' : 'Valider') : 'Verrouillé'} le ${shortDate(task.starts_on)}`} aria-pressed={completed} disabled={!isToday || busy || cancelled || !user} onClick={() => {
                  if (completed && completion) void uncheckToday(task, completion)
                  else { setActiveTask(task); setWriteup(''); setActionError(''); setStep('confirm') }
                }}>
                  {completed ? <Check size={20} strokeWidth={3} /> : isFuture ? <LockKeyhole size={15} /> : isToday ? <span className="daily-today-dot" /> : <span>{shortDate(task.starts_on)}</span>}
                </button>
                <span className="daily-date-full">{shortDate(task.starts_on)}</span>
                {cancelled && <small className="daily-cancelled-label">Annulée par l’admin</small>}
              </div>
            })}</div>
          </section>
        })}
      </div>
    </>}

    {activeTask && <div className="dialog-backdrop daily-flow-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeFlow() }}>
      <section className="panel daily-flow-dialog" role="dialog" aria-modal="true" aria-labelledby="daily-flow-title">
        <button className="icon-button daily-flow-close" type="button" onClick={closeFlow} disabled={busy} aria-label="Fermer"><X size={17} /></button>
        {step === 'confirm' && <>
          <span className="eyebrow">JOUR {activeTask.sort_order} · {shortDate(activeTask.starts_on)}</span>
          <h2 id="daily-flow-title">Tu es sûr que tu as vraiment fait ta séance ?</h2>
          <div className="dialog-actions"><button className="button-outline" type="button" onClick={rejectFlow}>Non</button><button className="button-primary" type="button" onClick={() => setStep('faith')}>Oui</button></div>
        </>}
        {step === 'faith' && <>
          <span className="eyebrow">DERNIÈRE QUESTION</span><h2 id="daily-flow-title">Dieu te voit bro</h2>
          <div className="dialog-actions"><button className="button-outline" type="button" onClick={rejectFlow}>Non</button><button className="button-primary" type="button" onClick={() => setStep('sticker')}>Oui</button></div>
        </>}
        {step === 'sticker' && <>
          <span className="eyebrow">TU ES SÛR DE TOI</span><img className="daily-sticker" src={`${import.meta.env.BASE_URL}hlb3.png`} alt="Sticker HackerLab" />
          <h2 id="daily-flow-title">Prêt à valider ta séance ?</h2>
          <div className="dialog-actions"><button className="button-outline" type="button" onClick={rejectFlow}>Non</button><button className="button-primary" type="button" onClick={() => setStep('writeup')}>Je valide</button></div>
        </>}
        {step === 'writeup' && <>
          <span className="eyebrow">PREUVE DE TRAVAIL · +10 POINTS</span><h2 id="daily-flow-title">Ajoute ton write-up GitHub</h2>
          <p>Le lien doit pointer vers un fichier Markdown public et existant dans un dépôt GitHub.</p>
          <form className="writeup-form" onSubmit={(event) => void submitWriteup(event)}>
            <label htmlFor="daily-writeup">Lien du fichier .md</label><input id="daily-writeup" type="url" required value={writeup} onChange={(event) => setWriteup(event.target.value)} placeholder="https://github.com/nom/depot/blob/main/writeups/jour-24.md" />
            {actionError && <p className="error-text" role="alert">{actionError}</p>}
            <div className="dialog-actions"><button className="button-outline" type="button" disabled={busy} onClick={() => setStep('sticker')}>Retour</button><button className="button-primary" type="submit" disabled={busy}>{busy ? 'Vérification…' : 'Vérifier et valider'}</button></div>
          </form>
        </>}
        {step === 'rejected' && <>
          <span className="eyebrow">ON SE RETROUVE DEMAIN</span><img className="daily-sticker" src={`${import.meta.env.BASE_URL}hlb4.png`} alt="Sticker HackerLab" />
          <h2 id="daily-flow-title">Validation annulée</h2><div className="dialog-actions"><button className="button-primary" type="button" onClick={closeFlow}>Compris</button></div>
        </>}
        {actionError && step !== 'writeup' && <p className="error-text daily-flow-error" role="alert">{actionError}</p>}
      </section>
    </div>}
  </div>
}

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Crown, Download, MailPlus, Minus, Plus, Trophy, Undo2, UsersRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTasks } from '../hooks/useTasks'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { SPECIALTY_LABELS } from '../data/members'
import type { CompletionRow, TeamMemberRow, TeamRow } from '../lib/database.types'
import { formatPortoDateTime } from '../lib/dates'
import { notifyScoresChanged } from '../lib/events'

type InvitationRow = { email: string; member_key: string; pseudo: string; main_spec: string | null; second_spec: string | null; role: 'member' | 'admin'; created_at: string }
type AdjustmentRow = { id: number; user_id: string; delta: number; reason: string; created_at: string }
type TeamEventRow = { id: number; points: number; reason: string; created_at: string; team_id: string | null }

function csvCell(value: unknown) {
  const raw = String(value ?? '')
  const text = typeof value === 'string' && /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw
  return `"${text.replaceAll('"', '""')}"`
}

function downloadCsv(name: string, headers: string[], rows: Array<Array<unknown>>) {
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function AdminPage() {
  const { user } = useAuth()
  const { tasks, completions, setCompletions, profiles, loading, error: taskError } = useTasks()
  const { rows: leaderboard } = useLeaderboard()
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([])
  const [teamEvents, setTeamEvents] = useState<TeamEventRow[]>([])
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([])
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<CompletionRow | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [completionQuery, setCompletionQuery] = useState('')
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles])

  useEffect(() => {
    if (!supabase) return
    Promise.all([
      supabase.from('invitations').select('*').order('created_at', { ascending: false }),
      supabase.from('point_adjustments').select('*').order('created_at', { ascending: false }),
      supabase.from('team_score_events').select('*').order('created_at', { ascending: false }),
      supabase.from('teams').select('*').order('name'),
      supabase.from('team_members').select('*'),
    ]).then(([invites, points, scores, teamResult, rosterResult]) => {
      if (invites.error || points.error || scores.error || teamResult.error || rosterResult.error) setFeedback('Impossible de charger toutes les données admin. Vérifie que la migration équipes a été exécutée dans Supabase.')
      else {
        setInvitations(invites.data ?? [])
        setAdjustments(points.data ?? [])
        setTeamEvents(scores.data ?? [])
        setTeams(teamResult.data ?? [])
        setTeamMembers(rosterResult.data ?? [])
      }
    })
  }, [])

  async function submitAction(event: FormEvent<HTMLFormElement>, action: 'invite' | 'adjust' | 'team' | 'create-team') {
    event.preventDefault()
    if (!supabase || !user || busy) return
    const form = new FormData(event.currentTarget)
    const formElement = event.currentTarget
    setBusy(true)
    setFeedback('')
    let error: string | null = null

    if (action === 'invite') {
      const memberKey = String(form.get('member_key'))
      const { error: result } = await supabase.from('invitations').insert({
        email: String(form.get('email')).trim().toLowerCase(), member_key: memberKey,
        pseudo: String(form.get('pseudo')).trim(), main_spec: String(form.get('main_spec')) || null,
        second_spec: String(form.get('second_spec')) || null, role: 'member',
      })
      error = result?.message ?? null
      if (!error) setInvitations((current) => [{ email: String(form.get('email')).trim().toLowerCase(), member_key: memberKey, pseudo: String(form.get('pseudo')).trim(), main_spec: String(form.get('main_spec')) || null, second_spec: String(form.get('second_spec')) || null, role: 'member', created_at: new Date().toISOString() }, ...current])
    } else if (action === 'adjust') {
      const { error: result } = await supabase.from('point_adjustments').insert({
        user_id: String(form.get('user_id')), delta: Number(form.get('delta')), reason: String(form.get('reason')).trim(), created_by: user.id,
      })
      error = result?.message ?? null
      if (!error) {
        notifyScoresChanged()
        const { data } = await supabase.from('point_adjustments').select('*').order('created_at', { ascending: false })
        setAdjustments(data ?? [])
      }
    } else if (action === 'team') {
      const { error: result } = await supabase.from('team_score_events').insert({
        team_id: String(form.get('team_id')), points: Number(form.get('points')), reason: String(form.get('reason')).trim(), created_by: user.id,
      })
      error = result?.message ?? null
      if (!error) {
        notifyScoresChanged()
        const { data } = await supabase.from('team_score_events').select('*').order('created_at', { ascending: false })
        setTeamEvents(data ?? [])
      }
    } else {
      const captainId = String(form.get('captain_id'))
      const memberIds = form.getAll('member_ids').map(String).filter((id) => id !== captainId)
      const { error: result } = await supabase.rpc('admin_create_team', {
        p_name: String(form.get('team_name')).trim(), p_captain_id: captainId, p_member_ids: memberIds,
      })
      error = result?.message ?? null
      if (!error) {
        const [teamResult, rosterResult] = await Promise.all([
          supabase.from('teams').select('*').order('name'),
          supabase.from('team_members').select('*'),
        ])
        setTeams(teamResult.data ?? [])
        setTeamMembers(rosterResult.data ?? [])
      }
    }
    setBusy(false)
    setFeedback(error ? 'Action refusée par Supabase. Vérifie les champs, les migrations et les autorisations.' : action === 'create-team' ? 'Équipe créée avec son capitaine et ses membres.' : 'Action enregistrée.')
    if (!error) formElement.reset()
  }

  async function cancelCompletion() {
    if (!supabase || !cancelTarget || cancelReason.trim().length < 3) return
    setBusy(true)
    const { error: result } = await supabase.rpc('admin_cancel_completion', { p_id: cancelTarget.id, p_reason: cancelReason.trim() })
    setBusy(false)
    if (result) setFeedback('Impossible d’annuler cette coche. Vérifie ton rôle admin et réessaie.')
    else {
      setCompletions((current) => current.map((item) => item.id === cancelTarget.id ? { ...item, cancelled_at: new Date().toISOString(), cancelled_by: user?.id ?? null, cancel_reason: cancelReason.trim() } : item))
      notifyScoresChanged()
      setFeedback('Coche annulée ; les points sont recalculés par la vue du classement.')
      setCancelTarget(null)
      setCancelReason('')
    }
  }

  async function restoreCompletion(completion: CompletionRow) {
    if (!supabase) return
    const { error: result } = await supabase.rpc('admin_restore_completion', { p_id: completion.id })
    if (result) setFeedback('Impossible de restaurer cette coche.')
    else {
      setCompletions((current) => current.map((item) => item.id === completion.id ? { ...item, cancelled_at: null, cancelled_by: null, cancel_reason: null } : item))
      notifyScoresChanged()
      setFeedback('Coche restaurée ; les points sont recalculés par la vue du classement.')
    }
  }

  const pendingCount = invitations.filter((invitation) => !profiles.some((profile) => profile.member_key === invitation.member_key)).length
  const visibleCompletions = completions
    .slice()
    .sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at))
    .filter((completion) => {
      if (!completionQuery.trim()) return true
      const taskTitle = tasks.find((task) => task.id === completion.task_id)?.title ?? completion.task_id
      const member = profileById.get(completion.user_id)?.pseudo ?? ''
      return `${member} ${taskTitle} ${completion.cancel_reason ?? ''}`.toLowerCase().includes(completionQuery.toLowerCase())
    })
    .slice(0, completionQuery ? 100 : 30)
  return <div className="admin-page">
    <header className="page-heading"><span className="eyebrow">GESTION DE L’ÉQUIPE</span><h1 className="title-gradient">Administration</h1><p>Invitations, ajustements et suivi des validations.</p></header>
    {feedback && <div className="notice" role="status">{feedback}</div>}
    {taskError && <div className="notice warning">{taskError}</div>}
    {loading && <div className="panel loading-card">Chargement des données…</div>}

    <section className="admin-grid">
      <article className="panel admin-card"><div className="section-title compact"><div><span className="eyebrow">NOUVEAU MEMBRE</span><h2>Envoyer une invitation</h2></div><MailPlus size={17} /></div>
        <form className="admin-form" onSubmit={(event) => void submitAction(event, 'invite')}>
          <label>Email<input name="email" type="email" required placeholder="membre@exemple.com" /></label>
          <label>Pseudo<input name="pseudo" required maxLength={50} placeholder="Pseudo affiché" /></label>
          <label>Clé membre<input name="member_key" required pattern="[a-z0-9_-]+" placeholder="ex. fatou" /></label>
          <label>Spécialité principale<select name="main_spec" defaultValue=""><option value="">Aucune</option>{Object.entries(SPECIALTY_LABELS).filter(([key]) => key !== 'pwn').map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
          <label>Spécialité secondaire<select name="second_spec" defaultValue=""><option value="">Aucune</option>{Object.entries(SPECIALTY_LABELS).filter(([key]) => key !== 'pwn').map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
          <button className="button-primary" disabled={busy}><MailPlus size={15} /> Ajouter l’invitation</button>
        </form>
      </article>

      <article className="panel admin-card"><div className="section-title compact"><div><span className="eyebrow">POINTS INDIVIDUELS</span><h2>Ajuster un score</h2></div><Plus size={17} /></div>
        <form className="admin-form" onSubmit={(event) => void submitAction(event, 'adjust')}>
          <label>Membre<select name="user_id" required defaultValue=""><option value="" disabled>Choisir un membre</option>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.pseudo}</option>)}</select></label>
          <label>Points à ajouter ou retirer<input name="delta" type="number" min="-500" max="500" step="1" defaultValue="20" required /></label>
          <label>Motif obligatoire<input name="reason" minLength={3} required placeholder="Ex. 1er au CTF X" /></label>
          <button className="button-primary" disabled={busy}><Plus size={15} /><Minus size={15} /> Enregistrer l’ajustement</button>
        </form>
        <div className="admin-history">{adjustments.slice(0, 8).map((item) => <div className="admin-history-row" key={item.id}><strong>{profileById.get(item.user_id)?.pseudo}</strong><span className={item.delta < 0 ? 'negative' : ''}>{item.delta > 0 ? '+' : ''}{item.delta}</span><small>{item.reason}</small></div>)}</div>
      </article>

      <article className="panel admin-card"><div className="section-title compact"><div><span className="eyebrow">NOUVELLE ÉQUIPE</span><h2>Créer une équipe</h2></div><UsersRound size={17} /></div>
        <form className="admin-form" onSubmit={(event) => void submitAction(event, 'create-team')}>
          <label>Nom de l’équipe<input name="team_name" required minLength={2} maxLength={40} placeholder="Ex. Les Cyber-lions" /></label>
          <label>Capitaine<select name="captain_id" required defaultValue=""><option value="" disabled>Choisir le capitaine</option>{profiles.filter((profile) => !teamMembers.some((member) => member.profile_id === profile.id)).map((profile) => <option value={profile.id} key={profile.id}>{profile.pseudo}</option>)}</select></label>
          <fieldset className="team-member-picks"><legend>Membres à ajouter</legend>{profiles.filter((profile) => !teamMembers.some((member) => member.profile_id === profile.id)).map((profile) => <label key={profile.id}><input type="checkbox" name="member_ids" value={profile.id} /><span>{profile.pseudo}</span></label>)}</fieldset>
          <small className="field-help">Le capitaine sera automatiquement ajouté à son équipe.</small>
          <button className="button-primary" disabled={busy || !profiles.length}><UsersRound size={15} /> Créer l’équipe</button>
        </form>
      </article>

      <article className="panel admin-card"><div className="section-title compact"><div><span className="eyebrow">SCORE D’ÉQUIPE</span><h2>Ajouter après une victoire</h2></div><Trophy size={17} /></div>
        <form className="admin-form" onSubmit={(event) => void submitAction(event, 'team')}>
          <label>Équipe gagnante<select name="team_id" required defaultValue=""><option value="" disabled>Choisir une équipe</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
          <label>Points d’équipe<input name="points" type="number" min="-5000" max="5000" step="1" placeholder="Ex. 100" required /></label>
          <label>CTF et motif obligatoire<input name="reason" minLength={3} required placeholder="Victoire au CTF X" /></label>
          <button className="button-primary" disabled={busy || !teams.length}><Trophy size={15} /> Ajouter au score d’équipe</button>
        </form>
        <div className="admin-history">{teamEvents.slice(0, 8).map((event) => <div className="admin-history-row" key={event.id}><strong>{teams.find((team) => team.id === event.team_id)?.name ?? 'Score historique'} · {event.reason}</strong><span className={event.points < 0 ? 'negative' : ''}>{event.points > 0 ? '+' : ''}{event.points}</span><small>{formatPortoDateTime(event.created_at)}</small></div>)}</div>
      </article>

      <article className="panel admin-card"><div className="section-title compact"><div><span className="eyebrow">INVITATIONS</span><h2>Suivi des membres</h2></div><span className="count-pill">{pendingCount} en attente</span></div>
        <div className="admin-history">{invitations.map((invitation) => { const registered = profiles.some((profile) => profile.member_key === invitation.member_key); return <div className="invitation-row" key={invitation.member_key}><div><strong>{invitation.pseudo}</strong><small>{invitation.email}</small></div><span className={registered ? 'status-registered' : 'status-pending'}>{registered ? 'Inscrit' : 'En attente'}</span></div> })}</div>
      </article>
    </section>

    <section className="admin-team-list">
      {teams.map((team) => <article className="panel admin-card" key={team.id}><div className="section-title compact"><div><span className="eyebrow">ÉQUIPE</span><h2>{team.name}</h2></div><UsersRound size={17} /></div><div className="team-roster">{teamMembers.filter((member) => member.team_id === team.id).map((member) => <span key={member.profile_id}>{profileById.get(member.profile_id)?.pseudo ?? 'Membre'}{member.profile_id === team.captain_id && <span title="Capitaine"><Crown size={14} aria-label="Capitaine" /></span>}</span>)}</div></article>)}
    </section>

    <section className="panel admin-card completion-admin"><div className="section-title compact"><div><span className="eyebrow">VALIDATIONS</span><h2>Annuler ou restaurer une coche</h2></div><Undo2 size={17} /></div>
      <label className="completion-search">Rechercher un membre, une séance ou un motif<input value={completionQuery} onChange={(event) => setCompletionQuery(event.target.value)} placeholder="Pseudo ou titre de séance" /></label>
      <div className="admin-history">{visibleCompletions.map((completion) => {
        const task = tasks.find((item) => item.id === completion.task_id)
        return <div className="completion-admin-row" key={completion.id}><div><strong>{profileById.get(completion.user_id)?.pseudo ?? 'Membre'} · {task?.title ?? completion.task_id}</strong><small>{formatPortoDateTime(completion.completed_at)}{completion.cancel_reason ? ` · ${completion.cancel_reason}` : ''}</small></div>{completion.cancelled_at ? <button className="button-outline" onClick={() => void restoreCompletion(completion)}>Restaurer</button> : <button className="button-danger" onClick={() => { setCancelTarget(completion); setCancelReason('') }}>Annuler</button>}</div>
      })}</div>
    </section>

    <section className="panel admin-card exports-card"><div className="section-title compact"><div><span className="eyebrow">SAUVEGARDE MANUELLE</span><h2>Exporter les données CSV</h2></div><Download size={17} /></div>
      <div className="export-buttons">
        <button className="button-outline" onClick={() => downloadCsv('coches.csv', ['membre', 'tache', 'terminee_le', 'annulee_le', 'motif'], completions.map((item) => [profileById.get(item.user_id)?.pseudo, tasks.find((task) => task.id === item.task_id)?.title, item.completed_at, item.cancelled_at, item.cancel_reason]))}><Download size={14} /> Coches</button>
        <button className="button-outline" onClick={() => downloadCsv('ajustements.csv', ['membre', 'points', 'motif', 'date'], adjustments.map((item) => [profileById.get(item.user_id)?.pseudo, item.delta, item.reason, item.created_at]))}><Download size={14} /> Ajustements</button>
        <button className="button-outline" onClick={() => downloadCsv('score-equipe.csv', ['equipe', 'points', 'motif', 'date'], teamEvents.map((item) => [teams.find((team) => team.id === item.team_id)?.name, item.points, item.reason, item.created_at]))}><Download size={14} /> Score d’équipe</button>
        <button className="button-outline" onClick={() => downloadCsv('classement.csv', ['rang', 'pseudo', 'points', 'seances_terminees'], leaderboard.map((item) => [item.rank, item.pseudo, item.points, item.sessions_done]))}><Download size={14} /> Classement</button>
      </div>
    </section>

    {cancelTarget && <div className="dialog-backdrop" role="presentation"><section className="panel cancel-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-title"><h2 id="cancel-title">Annuler cette coche</h2><p>Les points correspondants seront retirés du classement.</p><label htmlFor="cancel-reason">Motif obligatoire (3 caractères minimum)</label><input id="cancel-reason" value={cancelReason} minLength={3} onChange={(event) => setCancelReason(event.target.value)} autoFocus /><div className="dialog-actions"><button className="button-outline" onClick={() => setCancelTarget(null)}>Retour</button><button className="button-danger" disabled={busy || cancelReason.trim().length < 3} onClick={() => void cancelCompletion()}>Confirmer l’annulation</button></div></section></div>}
  </div>
}

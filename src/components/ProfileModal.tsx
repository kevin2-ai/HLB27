import { useEffect, useState, type FormEvent } from 'react'
import { Check, Pencil, UserRound, X } from 'lucide-react'
import { MEMBERS, SPECIALTY_LABELS } from '../data/members'
import { useAuth } from '../hooks/useAuth'

function getDisplayName(memberKey: string) {
  const knownMember = MEMBERS.find((member) => member.key === memberKey)
  if (knownMember) return knownMember.name
  return memberKey.replace(/[-_]/g, ' ').split(/\s+/).map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1)).join(' ')
}

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { profile, updatePseudo } = useAuth()
  const name = profile ? getDisplayName(profile.member_key) : ''
  const currentPseudo = profile?.pseudo ?? ''
  const hasCustomPseudo = currentPseudo.trim().toLocaleLowerCase() !== name.trim().toLocaleLowerCase()
  const [editing, setEditing] = useState(!hasCustomPseudo)
  const [draft, setDraft] = useState(hasCustomPseudo ? currentPseudo : '')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  async function savePseudo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setFeedback('')
    const error = await updatePseudo(draft)
    setBusy(false)
    if (error) setFeedback(error)
    else {
      setFeedback('Pseudo enregistré.')
      setEditing(false)
    }
  }

  return <div className="dialog-backdrop profile-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="panel profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title">
      <button className="icon-button profile-close" type="button" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
      <div className="profile-avatar-large" aria-hidden="true">{name.charAt(0).toLocaleUpperCase()}</div>
      <span className="eyebrow">MON PROFIL MEMBRE</span>
      <h2 id="profile-title">{name}</h2>

      <div className="profile-detail"><span>Nom</span><strong>{name}</strong></div>
      <div className="profile-detail profile-pseudo-detail">
        <span>Pseudo</span>
        {editing ? <form className="profile-pseudo-form" onSubmit={(event) => void savePseudo(event)}>
          <input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} minLength={2} maxLength={24} required placeholder="Choisis ton pseudo" aria-label="Pseudo" />
          <button className="button-primary" type="submit" disabled={busy || draft.trim().length < 2}><Check size={15} />{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
          {hasCustomPseudo && <button className="button-outline" type="button" onClick={() => { setDraft(currentPseudo); setEditing(false); setFeedback('') }}>Annuler</button>}
        </form> : <div className="profile-pseudo-value"><strong>{currentPseudo}</strong><button className="button-outline" type="button" onClick={() => { setDraft(currentPseudo); setEditing(true); setFeedback('') }}><Pencil size={14} /> Modifier</button></div>}
      </div>
      {feedback && <div className="notice profile-feedback" role="status">{feedback}</div>}

      <div className="profile-detail"><span>Spécialités</span><div className="profile-specialties">
        {[profile?.main_spec, profile?.second_spec].filter((key): key is string => Boolean(key)).map((key, index) => <div className="profile-specialty" key={key}><UserRound size={15} /><div><small>{index === 0 ? 'Principale' : 'Secondaire'}</small><strong>{SPECIALTY_LABELS[key] ?? key}</strong></div></div>)}
      </div></div>
    </section>
  </div>
}

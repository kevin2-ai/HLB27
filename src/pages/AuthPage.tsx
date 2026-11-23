import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { SPECIALTY_LABELS } from '../data/members'

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset'

const copy = {
  login: { eyebrow: 'ACCÈS MEMBRE', title: 'Content de te revoir.', subtitle: 'Connecte-toi pour retrouver ta préparation.', action: 'Se connecter' },
  signup: { eyebrow: 'ÉQUIPE SUR INVITATION', title: 'Rejoins le HackerLab.', subtitle: 'Utilise l’adresse email que Kevin a invitée.', action: 'Créer mon compte' },
  forgot: { eyebrow: 'RÉCUPÉRATION', title: 'Nouveau départ.', subtitle: 'On t’envoie un lien de récupération par email.', action: 'Envoyer le lien' },
  reset: { eyebrow: 'NOUVEAU MOT DE PASSE', title: 'Choisis un nouveau mot de passe.', subtitle: 'Ton nouveau mot de passe doit contenir au moins 8 caractères.', action: 'Enregistrer le mot de passe' },
} satisfies Record<AuthMode, { eyebrow: string; title: string; subtitle: string; action: string }>

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const { user, configured, signIn, signUp, resetPassword, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [mainSpec, setMainSpec] = useState('')
  const [secondSpec, setSecondSpec] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const text = copy[mode]

  if (user && mode !== 'reset') return <Navigate to="/" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setFeedback('')
    let error: string | null
    if (mode === 'reset') {
      if (password !== passwordConfirm) error = 'Les deux mots de passe ne correspondent pas.'
      else error = await updatePassword(password)
    } else if (mode === 'login') error = await signIn(email, password)
    else if (mode === 'signup') error = await signUp(email, password, mainSpec, secondSpec)
    else error = await resetPassword(email)
    setBusy(false)
    if (error) setFeedback(error)
    else if (mode === 'signup') setFeedback('Compte créé. Tu peux te connecter avec ton email et ton mot de passe.')
    else if (mode === 'forgot') setFeedback('Si cette adresse correspond à un compte, un lien de récupération va arriver.')
    else if (mode === 'reset') navigate('/', { replace: true })
    else navigate('/', { replace: true })
  }

  return (
    <main className="auth-screen">
      <section className="auth-card panel">
        <Link className="auth-brand" to="/"><span className="brand-mark">H<span>27</span></span><span>HackerLab <small>BÉNIN · 2027</small></span></Link>
        <div className="auth-heading"><span className="eyebrow">{text.eyebrow}</span><h1 className="title-gradient">{text.title}</h1><p>{text.subtitle}</p></div>
        {!configured && <div className="notice warning"><KeyRound size={17} /> Le service Supabase sera disponible après configuration des variables d’environnement.</div>}
        <form className="auth-form" onSubmit={submit}>
          {mode !== 'reset' && <><label htmlFor="email">Adresse email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="toi@exemple.com" /></>}
          {mode === 'signup' && <>
            <label htmlFor="main-specialty">Spécialité principale</label>
            <select id="main-specialty" value={mainSpec} required onChange={(event) => { setMainSpec(event.target.value); if (event.target.value === secondSpec) setSecondSpec('') }}>
              <option value="">Choisir une spécialité</option>{Object.entries(SPECIALTY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <label htmlFor="second-specialty">Spécialité secondaire</label>
            <select id="second-specialty" value={secondSpec} required onChange={(event) => setSecondSpec(event.target.value)}>
              <option value="">Choisir une spécialité</option>{Object.entries(SPECIALTY_LABELS).filter(([key]) => key !== mainSpec).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <p className="field-help">Ces deux spécialités détermineront tes tâches individuelles.</p>
          </>}
          {mode !== 'forgot' && <><label htmlFor="password">Mot de passe</label><input id="password" type="password" minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères minimum" /></>}
          {mode === 'reset' && <><label htmlFor="password-confirm">Confirmer le nouveau mot de passe</label><input id="password-confirm" type="password" minLength={8} autoComplete="new-password" required value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="Répète le mot de passe" /></>}
          {feedback && <div className="notice" role="status"><ShieldCheck size={17} /><span>{feedback}</span></div>}
          <button className="button-primary" type="submit" disabled={busy || !configured}>{busy ? 'Un instant…' : text.action}</button>
        </form>
        <div className="auth-links">
          {mode === 'login' && <><Link to="/forgot-password">Mot de passe oublié ?</Link><span>Pas encore de compte ? <Link to="/signup">Créer un compte</Link></span></>}
          {mode === 'signup' && <span>Déjà un compte ? <Link to="/login">Se connecter</Link></span>}
          {mode === 'forgot' && <Link to="/login">Retour à la connexion</Link>}
          {mode === 'reset' && <span>La récupération ne fonctionne pas ? <Link to="/forgot-password">Demander un nouveau lien</Link></span>}
        </div>
      </section>
      <p className="auth-footnote">Accès réservé aux membres invités · Porto-Novo, Bénin</p>
    </main>
  )
}

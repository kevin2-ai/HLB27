import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'

export type Profile = {
  id: string
  member_key: string
  pseudo: string
  main_spec: string | null
  second_spec: string | null
  role: 'member' | 'admin'
}

type AuthContextValue = {
  loading: boolean
  user: User | null
  profile: Profile | null
  configured: boolean
  recovery: boolean
  message: string | null
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, mainSpec: string, secondSpec: string) => Promise<string | null>
  updatePseudo: (pseudo: string) => Promise<string | null>
  resetPassword: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function authError(error: string) {
  const normalized = error.toLowerCase()
  if (normalized.includes('inscription sur invitation')) return 'Inscription sur invitation uniquement. Demande à Kevin.'
  if (normalized.includes('deux spécialités')) return 'Choisis deux spécialités différentes.'
  if (normalized.includes('spécialité')) return 'L’une des spécialités choisies n’est pas valide.'
  if (normalized.includes('invalid login credentials')) return 'Adresse email ou mot de passe incorrect.'
  if (normalized.includes('user already registered')) return 'Cette adresse email possède déjà un compte.'
  if (normalized.includes('email_address_not_authorized') || normalized.includes('email address not authorized')) return 'Cette adresse est valide, mais Supabase ne peut pas lui envoyer de confirmation avec le service email par défaut. Configure un SMTP personnalisé ou désactive la confirmation email.'
  if (normalized.includes('over_email_send_rate_limit') || normalized.includes('email rate limit exceeded')) return 'La limite d’envoi des emails est atteinte. Réessaie plus tard ou configure un SMTP personnalisé.'
  if (normalized.includes('email_not_confirmed') || normalized.includes('email not confirmed')) return 'Confirme ton adresse depuis le lien reçu par email avant de te connecter.'
  if (normalized.includes('email_address_invalid') || normalized.includes('invalid email')) return 'Vérifie le format de ton adresse email.'
  if (normalized.includes('password')) return 'Le mot de passe doit contenir au moins 8 caractères.'
  return 'Une erreur est survenue. Vérifie ta connexion puis réessaie.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    let active = true
    const client = supabase
    if (!client) {
      setLoading(false)
      return () => { active = false }
    }

    const loadProfile = async (current: Session | null) => {
      if (!active) return
      setSession(current)
      if (!current) {
        setProfile(null)
        setLoading(false)
        return
      }
      const { data, error } = await client.from('profiles').select('id, member_key, pseudo, main_spec, second_spec, role').eq('id', current.user.id).maybeSingle()
      if (!active) return
      setProfile(data as Profile | null)
      setMessage(error ? 'Impossible de charger ton profil. Réessaie dans un instant.' : null)
      setLoading(false)
    }

    client.auth.getSession().then(({ data }) => loadProfile(data.session))
    const { data: { subscription } } = client.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      void loadProfile(nextSession)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const actions = useMemo<AuthContextValue>(() => ({
    loading,
    user: session?.user ?? null,
    profile,
    configured: supabaseConfigured,
    recovery,
    message,
    signIn: async (email, password) => {
      if (!supabase) return 'Le service de connexion n’est pas encore configuré.'
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      return error ? authError(error.message) : null
    },
    signUp: async (email, password, mainSpec, secondSpec) => {
      if (!supabase) return 'Le service de connexion n’est pas encore configuré.'
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { specialties_selected: true, main_spec: mainSpec, second_spec: secondSpec } },
      })
      if (!error) return null
      if (error.message.toLowerCase().includes('database error saving new user')) {
        return 'Inscription sur invitation uniquement. Demande à Kevin.'
      }
      return authError(error.message)
    },
    updatePseudo: async (pseudo) => {
      if (!supabase) return 'Le service de connexion n’est pas encore configuré.'
      const { data, error } = await supabase.rpc('update_my_pseudo', { p_pseudo: pseudo.trim() })
      if (error) return error.message.toLowerCase().includes('pseudo') ? 'Le pseudo doit contenir entre 2 et 24 caractères.' : 'Impossible d’enregistrer le pseudo. Réessaie.'
      if (data) setProfile((current) => current ? { ...current, pseudo: data } : current)
      return null
    },
    resetPassword: async (email) => {
      if (!supabase) return 'Le service de connexion n’est pas encore configuré.'
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      })
      return error ? authError(error.message) : null
    },
    updatePassword: async (password) => {
      if (!supabase) return 'Le service de connexion n’est pas encore configuré.'
      const { error } = await supabase.auth.updateUser({ password })
      if (error) return authError(error.message)
      setRecovery(false)
      return null
    },
    signOut: async () => {
      if (!supabase) return
      await supabase.auth.signOut()
    },
  }), [loading, session, profile, message, recovery])

  return <AuthContext.Provider value={actions}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return context
}

import { lazy, Suspense, useState, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { CalendarDays, Home, LogOut, Shield, Trophy } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import ProfileModal from './components/ProfileModal'

const AuthPage = lazy(() => import('./pages/AuthPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const PlanningPage = lazy(() => import('./pages/PlanningPage'))
const TeamPage = lazy(() => import('./pages/TeamPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

const navigation = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/planning', label: 'Planning', icon: CalendarDays },
  { to: '/equipe', label: 'Équipe', icon: Trophy },
  { to: '/admin', label: 'Admin', icon: Shield },
]

function ProtectedRoute({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { loading, user, profile } = useAuth()
  if (loading) return <main className="auth-screen"><div className="loading-card panel">Chargement de ta session…</div></main>
  if (!user) return <Navigate to="/login" replace />
  if (admin && profile?.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { profile, signOut, recovery } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  if (recovery) return <Suspense fallback={<main className="auth-screen"><div className="loading-card panel">Chargement…</div></main>}><AuthPage mode="reset" /></Suspense>
  return (
    <Suspense fallback={<main className="auth-screen"><div className="loading-card panel">Chargement…</div></main>}><Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
      <Route path="*" element={
        <ProtectedRoute><div className="app-shell min-h-screen">
          <aside className="sidebar">
            <div className="sidebar-brand">
              <img className="sidebar-brand-image" src={`${import.meta.env.BASE_URL}hlb2.jpg`} alt="" />
              <span className="sidebar-brand-text"><strong>HACKER</strong><strong>LAB</strong></span>
            </div>
            <nav aria-label="Navigation principale">
              {navigation.filter((item) => item.to !== '/admin' || profile?.role === 'admin').map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <Icon size={19} strokeWidth={1.8} /><span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-note"><span className="online-dot" />Préparation · 24 semaines</div>
          </aside>

          <main className="main-content">
            <header className="topbar">
              <div><span className="eyebrow">ESPACE DE PRÉPARATION</span><p>{profile?.pseudo ? `Bonjour, ${profile.pseudo}` : 'Une équipe. Un objectif.'}</p></div>
              <div className="topbar-actions"><button className="profile-avatar" type="button" onClick={() => setProfileOpen(true)} aria-label="Ouvrir mon profil" title="Mon profil">{profile?.member_key.charAt(0).toLocaleUpperCase() ?? 'M'}</button><span className="season-pill">SAISON 2026—27</span><button className="icon-button" onClick={() => void signOut()} aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={17} /></button></div>
            </header>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/equipe" element={<TeamPage />} />
              <Route path="/admin" element={<ProtectedRoute admin><AdminPage /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <footer>HackerLab Bénin 2027 <span>·</span> Porto-Novo, Bénin</footer>
          </main>

          <nav className="mobile-nav" aria-label="Navigation mobile">
            {navigation.filter((item) => item.to !== '/admin' || profile?.role === 'admin').map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `mobile-link${isActive ? ' active' : ''}`}>
                <Icon size={20} /><span>{label}</span>
              </NavLink>
            ))}
          </nav>
          {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
        </div></ProtectedRoute>
      } />
    </Routes></Suspense>
  )
}

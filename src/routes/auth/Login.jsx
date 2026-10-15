import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { isAdminProfile } from '../../lib/adminAccess.js'
import wordmark from '../../assets/rockyeats-wordmark-tight.webp'
import Sunset from '../../components/Sunset.jsx'
import { inputClass } from '../../components/ui.jsx'

// Supabase returns English messages; staff see Spanish.
function authErrorMessage(error) {
  const msg = error?.message || ''
  if (/invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(msg)) return 'Esta cuenta aún no confirma su correo.'
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espera un minuto e intenta de nuevo.'
  if (/fetch|network/i.test(msg)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  return 'No pudimos iniciar sesión. Intenta de nuevo.'
}

function Shell({ children }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-sea-950 px-5 pb-10 pt-10 text-white">
      <Sunset className="pointer-events-none absolute -right-16 top-10 w-[320px] opacity-80 sm:right-[8%] sm:w-[420px]" />
      <img src={wordmark} alt="RockyEats" className="relative h-9 w-auto self-start sm:mx-auto sm:self-center" width="520" height="165" />
      <div className="relative mx-auto mt-auto w-full max-w-sm sm:mt-24">{children}</div>
    </div>
  )
}

function Message({ children, onSignOut }) {
  return (
    <Shell>
      <div className="rounded-2xl bg-white p-6 text-sea-950">
        <p>{children}</p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-4 text-sm font-semibold text-sea-950/60 underline underline-offset-2 hover:text-sea-950"
        >
          Cerrar sesión
        </button>
      </div>
    </Shell>
  )
}

function Login() {
  const { session, profile, loading, signIn, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session && profile?.role === 'admin' && !isAdminProfile(profile)) {
    return <Message onSignOut={() => signOut()}>Esta cuenta no tiene acceso de administrador.</Message>
  }

  if (!loading && session && profile) {
    return <Navigate to={isAdminProfile(profile) ? '/admin' : '/dashboard'} replace />
  }

  if (!loading && session && !profile) {
    return (
      <Message onSignOut={() => signOut()}>
        Ya iniciaste sesión, pero tu cuenta todavía no tiene un rol. Pide al administrador que te dé acceso en Admin, Usuarios.
      </Message>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await signIn(email, password)
    if (signInError) {
      setError(authErrorMessage(signInError))
      setSubmitting(false)
    }
    // On success, the session/profile effects above redirect automatically.
  }

  return (
    <Shell>
      <h1 className="condensed text-5xl font-extrabold leading-[0.9]">Panel del restaurante</h1>
      <p className="mt-2 text-white/65">Pedidos, cocina, menú y ventas en un solo lugar.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl bg-white p-5 text-sea-950">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
            Correo
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-chili-500/10 px-3.5 py-3 text-sm font-semibold text-chili-500">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-sun-500 text-base font-bold text-white transition hover:bg-sun-600 disabled:opacity-60"
        >
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </Shell>
  )
}

export default Login

import { useState, useEffect } from 'react'
import Logo from '../components/Logo'
import { useGoogleLogin } from '@react-oauth/google'

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.705 17.64 9.2z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
)

const Field = ({ label, hint, right, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.06em' }}>
        {label.toUpperCase()}
      </label>
      {right}
    </div>
    {children}
    {hint && <span style={{ fontSize: 10, color: 'var(--dim)', marginTop: -2 }}>{hint}</span>}
  </div>
)

const SectionDivider = ({ label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    <span style={{ fontSize: 10, color: 'var(--dim)', whiteSpace: 'nowrap' }}>{label}</span>
    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
  </div>
)

export default function Splash({ onEnter }) {
  const [mode, setMode]               = useState('login-id')
  const [username, setUsername]       = useState('')
  const [foundUser, setFoundUser]     = useState(null)
  const [firstName, setFirstName]     = useState('')
  const [lastName, setLastName]       = useState('')
  const [passcode, setPasscode]       = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [error, setError]             = useState(null)
  const [loading, setLoading]         = useState(false)
  const [usernameStatus, setUsernameStatus] = useState('idle')

  useEffect(() => {
    if (mode !== 'signup') return
    const val = username.trim()
    if (val.length < 3) { setUsernameStatus('idle'); return }
    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/users?email=${encodeURIComponent(val)}`)
      setUsernameStatus(res.ok ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timer)
  }, [username, mode])

  const googleLogin = useGoogleLogin({
    scope: 'openid email profile',
    onSuccess: async (res) => {
      setLoading(true)
      setError(null)
      try {
        const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${res.access_token}` },
        })
        const info = await r.json()
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: info.email, name: info.name, avatar: info.picture, provider: 'google' }),
        })
        onEnter({ email: info.email, name: info.name, avatar: info.picture, accessToken: res.access_token })
      } catch {
        setError('Google sign-in failed. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    onError: () => setError('Google sign-in failed. Please try again.'),
  })

  const handleContinue = async () => {
    setError(null)
    if (!username.trim()) { setError('Please enter your username'); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/users?email=${encodeURIComponent(username.trim())}`)
      const data = await res.json()
      if (!res.ok || !data.user || data.user.provider !== 'local') {
        setError('No account found with that username')
        return
      }
      setFoundUser(data.user)
      setMode('login-pass')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async () => {
    setError(null)
    if (!passcode.trim()) { setError('Please enter your passcode'); return }
    setLoading(true)
    try {
      if (foundUser.passcode !== passcode.trim()) {
        setError('Incorrect passcode')
        return
      }
      onEnter({ email: foundUser.email, name: foundUser.name, avatar: foundUser.avatar, accessToken: null })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async () => {
    setError(null)
    if (!firstName.trim()) { setError('Please enter your first name'); return }
    if (!lastName.trim()) { setError('Please enter your last name'); return }
    if (!username.trim() || username.trim().length < 3) { setError('Username must be at least 3 characters'); return }
    if (usernameStatus === 'taken') { setError('That username is already taken'); return }
    if (usernameStatus === 'checking') { setError('Still checking username…'); return }
    if (!passcode.trim() || passcode.trim().length < 4) { setError('Passcode must be at least 4 characters'); return }
    if (passcode !== confirmPasscode) { setError('Passcodes do not match'); return }
    setLoading(true)
    try {
      // Final availability check before committing
      const check = await fetch(`/api/users?email=${encodeURIComponent(username.trim())}`)
      if (check.ok) { setError('That username is already taken'); return }
      const name = `${firstName.trim()} ${lastName.trim()}`
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username.trim(), name, passcode: passcode.trim(), avatar: null, provider: 'local' }),
      })
      onEnter({ email: username.trim(), name, avatar: null, accessToken: null })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resetSignup = () => {
    setError(null); setUsernameStatus('idle')
    setUsername(''); setPasscode(''); setConfirmPasscode('')
    setFirstName(''); setLastName('')
  }

  const usernameIndicator = () => {
    if (usernameStatus === 'checking')  return <span style={{ fontSize: 10, color: 'var(--muted)' }}>Checking…</span>
    if (usernameStatus === 'taken')     return <span style={{ fontSize: 10, color: 'var(--red)' }}>✕ Taken</span>
    if (usernameStatus === 'available') return <span style={{ fontSize: 10, color: 'var(--green)' }}>✓ Available</span>
    return null
  }

  // ── Login step 1: username ────────────────────────────────────────
  if (mode === 'login-id') return (
    <div style={page}>
      <Logo size="lg" />
      <p style={tagline}>Track every share. The right way.</p>

      <div style={card}>
        <p style={{ fontSize: 12, color: 'var(--dim)', margin: '0 0 4px', textAlign: 'center' }}>
          Sign in to continue
        </p>

        <input
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleContinue()}
          autoCapitalize="none"
          autoFocus
          style={inp}
        />

        {error && <div style={errStyle}>{error}</div>}

        <button onClick={handleContinue} disabled={loading} style={{ ...btn, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Checking…' : 'Continue →'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--dim)' }}>
          No account?{' '}
          <span onClick={() => { resetSignup(); setMode('signup') }} style={lnk}>Sign up</span>
        </div>

        <SectionDivider label="or sign in with" />

        <button onClick={() => googleLogin()} disabled={loading} style={{ ...googleBtn, opacity: loading ? 0.7 : 1 }}>
          <GoogleG />
          Continue with Google
        </button>
      </div>
    </div>
  )

  // ── Login step 2: passcode ────────────────────────────────────────
  if (mode === 'login-pass') return (
    <div style={page}>
      <Logo size="lg" />

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 0 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, color: 'var(--bg)',
          }}>
            {(foundUser?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{foundUser?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--dim)' }}>{foundUser?.email}</div>
          </div>
          <span
            onClick={() => { setMode('login-id'); setFoundUser(null); setPasscode(''); setError(null) }}
            style={{ ...lnk, marginLeft: 'auto', fontSize: 11 }}
          >
            ← Change
          </span>
        </div>

        <input
          type="password"
          placeholder="Enter your passcode"
          value={passcode}
          onChange={e => setPasscode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSignIn()}
          autoFocus
          style={inp}
        />

        {error && <div style={errStyle}>{error}</div>}

        <button onClick={handleSignIn} disabled={loading} style={{ ...btn, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  )

  // ── Sign up ───────────────────────────────────────────────────────
  return (
    <div style={page}>
      <Logo size="lg" />
      <p style={tagline}>Create your account</p>

      <div style={{ ...card, gap: 0 }}>
        {/* Path A: Google */}
        <div style={{ padding: '4px 0 16px' }}>
          <button onClick={() => googleLogin()} disabled={loading} style={{ ...googleBtn, opacity: loading ? 0.7 : 1 }}>
            <GoogleG />
            Sign up with Google
          </button>
        </div>

        <SectionDivider label="or create a username account" />

        {/* Path B: Manual */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="First name">
              <input
                placeholder="Sylvester"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                style={inp}
              />
            </Field>
            <Field label="Last name">
              <input
                placeholder="Asare"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                style={inp}
              />
            </Field>
          </div>

          <Field
            label="Username"
            hint="Used to sign in each time. Min. 3 chars, no spaces."
            right={usernameIndicator()}
          >
            <input
              placeholder="e.g. sylvester"
              value={username}
              onChange={e => setUsername(e.target.value.replace(/\s/g, ''))}
              autoCapitalize="none"
              style={{
                ...inp,
                borderColor: usernameStatus === 'taken'     ? 'rgba(255,142,138,0.5)'
                           : usernameStatus === 'available' ? 'rgba(91,227,140,0.4)'
                           : 'var(--border)',
              }}
            />
          </Field>

          <Field label="Passcode">
            <input
              type="password"
              placeholder="Choose a passcode (min. 4 chars)"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              style={inp}
            />
          </Field>

          <Field label="Confirm passcode">
            <input
              type="password"
              placeholder="Repeat your passcode"
              value={confirmPasscode}
              onChange={e => setConfirmPasscode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSignUp()}
              style={{
                ...inp,
                borderColor: confirmPasscode && passcode !== confirmPasscode ? 'rgba(255,142,138,0.5)'
                           : confirmPasscode && passcode === confirmPasscode  ? 'rgba(91,227,140,0.4)'
                           : 'var(--border)',
              }}
            />
          </Field>

          {error && <div style={errStyle}>{error}</div>}

          <button
            onClick={handleSignUp}
            disabled={loading || usernameStatus === 'taken' || usernameStatus === 'checking'}
            style={{
              ...btn,
              opacity: (loading || usernameStatus === 'taken' || usernameStatus === 'checking') ? 0.6 : 1,
            }}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--dim)', paddingBottom: 4 }}>
            Already have an account?{' '}
            <span onClick={() => { resetSignup(); setMode('login-id') }} style={lnk}>Sign in</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const page = {
  minHeight: '100vh',
  background: '#080A10',
  backgroundImage: 'radial-gradient(ellipse 600px 400px at 50% -10%, rgba(240,194,94,0.10) 0%, transparent 70%)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: '40px 24px',
}
const tagline = { fontSize: 13, color: 'var(--dim)', marginTop: 10, textAlign: 'center', lineHeight: 1.6 }
const card = {
  width: '100%', maxWidth: 340, marginTop: 28,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 18, padding: '20px',
  backdropFilter: 'blur(20px)',
  display: 'flex', flexDirection: 'column', gap: 10,
}
const inp = {
  width: '100%', padding: '12px 14px',
  background: '#080A10', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
  color: '#FAFBFD', fontSize: 13, outline: 'none',
  transition: 'border-color 0.2s',
}
const btn = {
  width: '100%', padding: 13,
  background: 'linear-gradient(180deg, #F0C25E 0%, #C99A38 100%)',
  boxShadow: '0 4px 14px rgba(240,194,94,0.27)',
  border: 'none', borderRadius: 10,
  fontSize: 14, fontWeight: 700,
  color: '#080A10', cursor: 'pointer',
}
const googleBtn = {
  width: '100%', padding: '11px 16px', background: '#fff',
  border: '1px solid #dadce0', borderRadius: 10,
  fontSize: 14, fontWeight: 600,
  color: '#1f1f1f', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
}
const errStyle = { fontSize: 12, color: '#FF8E8A', padding: '2px 2px' }
const lnk = { color: '#F0C25E', cursor: 'pointer' }

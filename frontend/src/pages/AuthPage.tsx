import { useState } from 'react'
import { login as apiLogin, register as apiRegister } from '../api'
import { useUser } from '../context/UserContext'
import { useNavigate, useLocation } from 'react-router-dom'
import Alert from '../components/Alert'
import { LogIn, UserPlus, Mail, Lock, ArrowRight, Github, Chrome } from 'lucide-react'

export default function AuthPage() {
  const { refresh } = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = (location.state as any)?.from?.pathname || '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isLogin) {
        await apiLogin(email, password)
        await refresh()
      } else {
        await apiRegister(email, password)
      }
      navigate(from, { replace: true })
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-1 p-4 relative overflow-hidden">
      {/* Background Elements - Warm purple glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary-glow/10 rounded-full blur-[120px]"></div>
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(123, 75, 255, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(123, 75, 255, 0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="bg-surface-2 border border-divider rounded-2xl shadow-elevated overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6 text-primary ring-1 ring-inset ring-primary/10">
              {isLogin ? <LogIn className="w-8 h-8" /> : <UserPlus className="w-8 h-8" />}
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-text-secondary text-sm">
              {isLogin 
                ? 'Enter your credentials to access your workspace' 
                : 'Join us to start managing your data efficiently'}
            </p>
          </div>

          {/* Form */}
          <div className="px-8 pb-8">
            {error && (
              <div className="mb-6">
                <Alert type="error" message={error} onClose={() => setError('')} />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider ml-1">Email</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors z-10">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    className="input pl-10"
                    placeholder="name@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider ml-1">Password</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors z-10">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    required
                    className="input pl-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-primary to-primary-glow hover:from-primary-hover hover:to-primary text-white font-semibold rounded-btn shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all flex items-center justify-center gap-2 group mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Create Account'}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-divider">
              <div className="grid grid-cols-2 gap-3">
                <button className="flex items-center justify-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-divider rounded-xl text-text-secondary hover:text-text transition-colors text-sm font-medium">
                  <Github className="w-4 h-4" />
                  GitHub
                </button>
                <button className="flex items-center justify-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-divider rounded-xl text-text-secondary hover:text-text transition-colors text-sm font-medium">
                  <Chrome className="w-4 h-4" />
                  Google
                </button>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-text-secondary">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin)
                    setError('')
                  }}
                  className="text-primary hover:text-primary-hover font-semibold transition-colors"
                >
                  {isLogin ? 'Sign up' : 'Log in'}
                </button>
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} Oreo.io. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}

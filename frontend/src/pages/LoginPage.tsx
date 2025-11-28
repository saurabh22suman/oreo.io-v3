import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import AuthForm from '../components/AuthForm'
import { useState } from 'react'
import { login } from '../api'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { CheckCircle, Zap } from 'lucide-react'

export default function LoginPage() {
  const [err, setErr] = useState('')
  const navigate = useNavigate()
  const { refresh } = useUser()
  return (
    <div className="bg-page min-h-screen flex flex-col animate-fade-in">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Branding */}
          <div className="hidden lg:block space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img src="/images/oreo_rabbit.png" alt="Oreo" className="h-16 w-16 object-contain" />
                <div>
                  <h1 className="text-3xl font-bold text-text font-display">
                    Welcome back
                  </h1>
                  <p className="text-text-secondary text-sm">Continue managing your data</p>
                </div>
              </div>
            </div>

            {/* Feature highlights */}
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-surface-2 border border-divider">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-text">Secure & Validated</h3>
                </div>
                <p className="text-sm text-text-secondary">Your data is protected with enterprise-grade security and schema enforcement.</p>
              </div>

              <div className="p-6 rounded-2xl bg-surface-2 border border-divider">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-secondary" />
                  </div>
                  <h3 className="font-semibold text-text">Lightning Fast</h3>
                </div>
                <p className="text-sm text-text-secondary">Edit and validate your Delta Lake tables with millisecond response times.</p>
              </div>
            </div>
          </div>

          {/* Right side - Form */}
          <div className="w-full">
            {err && (
              <div className="mb-6 p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-danger"></div>
                {err}
              </div>
            )}
            <AuthForm
              type="login"
              onSubmit={async (data: any) => {
                try {
                  setErr('');
                  await login(data.email, data.password);
                  await refresh();
                  navigate('/dashboard')
                } catch (e: any) {
                  setErr(e?.message || 'Login failed')
                }
              }}
              switchForm={() => navigate('/register')}
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

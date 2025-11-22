import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import AuthForm from '../components/AuthForm'
import { useState } from 'react'
import { login } from '../api'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

export default function LoginPage() {
  const [err, setErr] = useState('')
  const navigate = useNavigate()
  const { refresh } = useUser()
  return (
    <div className="bg-[#0B0F19] min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Branding */}
          <div className="hidden lg:block space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img src="/images/oreo_rabbit.png" alt="Oreo" className="h-16 w-16 object-contain" />
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                    Welcome back
                  </h1>
                  <p className="text-slate-400 text-sm">Continue managing your data</p>
                </div>
              </div>
            </div>

            {/* Feature highlights */}
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white">Secure & Validated</h3>
                </div>
                <p className="text-sm text-slate-400">Your data is protected with enterprise-grade security and schema enforcement.</p>
              </div>

              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white">Lightning Fast</h3>
                </div>
                <p className="text-sm text-slate-400">Edit and validate your Delta Lake tables with millisecond response times.</p>
              </div>
            </div>
          </div>

          {/* Right side - Form */}
          <div className="w-full">
            {err && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
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

import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import AuthForm from '../components/AuthForm'
import { useState } from 'react'
import { register } from '../api'
import { useNavigate } from 'react-router-dom'

export default function RegisterPage() {
  const [err, setErr] = useState('')
  const navigate = useNavigate()
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
                    Join Oreo
                  </h1>
                  <p className="text-slate-400 text-sm">Start managing your Delta Lake data</p>
                </div>
              </div>
            </div>

            {/* Value props */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">What you get with Oreo:</h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Live data editing with schema validation</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Time travel and version control for your data</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Team collaboration with approval workflows</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Enterprise-grade security and compliance</span>
                </li>
              </ul>
            </div>

            <div className="text-xs text-slate-500 text-center">
              By signing up, you agree to our Terms of Service and Privacy Policy
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
              type="register"
              onSubmit={async (data: any) => {
                try {
                  setErr('');
                  await register(data.email, data.password);
                  navigate('/login')
                } catch (e: any) {
                  setErr(e?.message || 'Registration failed')
                }
              }}
              switchForm={() => navigate('/login')}
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

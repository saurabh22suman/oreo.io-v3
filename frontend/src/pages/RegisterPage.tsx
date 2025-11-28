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
    <div className="min-h-screen flex flex-col bg-surface-1">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {err && (
            <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
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
          <p className="mt-4 text-xs text-text-muted text-center">
            By signing up, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}

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
      </main>
      <Footer />
    </div>
  )
}

import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import AuthForm from '../components/AuthForm'
import { useState } from 'react'
import { login } from '../api'
import { useNavigate } from 'react-router-dom'
import { Rocket } from 'lucide-react'
import Mascot from '../components/Mascot'
import { useUser } from '../context/UserContext'

export default function LoginPage() {
  const [err, setErr] = useState('')
  const navigate = useNavigate()
  const { refresh } = useUser()
  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="hidden md:flex items-center justify-center">
            <div className="bg-white p-6 w-full border">
              <div className="text-indigo-700 mb-4 flex items-center gap-2 font-semibold"><Rocket /> oreo.io</div>
              <div className="text-gray-700">Manage datasets, invite collaborators, and approve changes — all from one place.</div>
              <div className="mt-6 flex justify-center">
                <Mascot pose="winking" size={200} />
              </div>
            </div>
          </div>

          <div>
            {err && <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-2 text-sm w-full max-w-md mb-3">{err}</div>}
            <AuthForm type="login" onSubmit={async (data: any) => {
                try { setErr(''); await login(data.email, data.password); await refresh(); navigate('/dashboard') } catch (e:any){ setErr(e?.message || 'Login failed') }
              }} switchForm={() => navigate('/register')} />
            <div className="text-center mt-4 text-sm text-gray-500">Or continue with</div>
            <div className="flex justify-center gap-3 mt-3">
              <button className="border border-gray-200 px-3 py-2 flex items-center gap-2 hover-shadow"><img src="/images/google-logo.svg" alt="google" className="w-4 h-4"/> Sign in with Google</button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

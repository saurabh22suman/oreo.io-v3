import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import AuthForm from '../components/AuthForm'
import { useState } from 'react'
import { register } from '../api'
import { useNavigate } from 'react-router-dom'
import Mascot from '../components/Mascot'

export default function RegisterPage() {
  const [err, setErr] = useState('')
  const navigate = useNavigate()
  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-3xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="hidden md:flex items-center justify-center">
            <div className="bg-white p-6 w-full border">
              <div className="text-indigo-700 mb-4 flex items-center gap-2 font-semibold">oreo.io</div>
              <div className="text-gray-700">Manage datasets, invite collaborators, and approve changes — all from one place.</div>
              <div className="mt-6 flex justify-center">
                <Mascot pose="winking" size={200} />
              </div>
            </div>
          </div>
          <div>
            {err && <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-4 py-2 text-sm w-full max-w-md mb-3">{err}</div>}
            <AuthForm type="register" onSubmit={async (data: any) => {
                try { setErr(''); await register(data.email, data.password); navigate('/login') } catch (e:any) { setErr(e?.message || 'Registration failed') }
              }} switchForm={() => navigate('/login')} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

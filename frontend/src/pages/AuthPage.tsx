import { useEffect, useRef, useState } from 'react'
import { login, register, me, loginWithGoogleIdToken } from '../api'

export default function AuthPage(){
  const [email, setEmail] = useState('user@example.com')
  const [password, setPassword] = useState('password')
  const [status, setStatus] = useState('')
  const googleBtnRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{
    // Load Google Identity Services script lazily
    const existing = document.getElementById('google-identity') as HTMLScriptElement | null
    if(!existing){
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.defer = true
      s.id = 'google-identity'
      s.onload = () => initGoogle()
      document.body.appendChild(s)
    } else {
      initGoogle()
    }

    function initGoogle(){
      const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || localStorage.getItem('google_client_id')
      if(!clientId || !(window as any).google || !googleBtnRef.current) return
      const google = (window as any).google
      try{
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp: any) => {
            try{
              await loginWithGoogleIdToken(resp.credential)
              setStatus('Logged in with Google')
            }catch(e:any){ setStatus(e.message || 'Google login failed') }
          }
        })
        google.accounts.id.renderButton(googleBtnRef.current, { theme: 'outline', size: 'large' })
      }catch{ /* noop */ }
    }
  }, [])
  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-xl font-semibold mb-4">Auth</h2>
      <div className="grid gap-2 max-w-sm">
        <input className="border border-gray-300 rounded-md px-3 py-2" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border border-gray-300 rounded-md px-3 py-2" placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <div className="flex gap-2 pt-1">
          <button className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600" onClick={async()=>{ try{ await register(email,password); setStatus('Registered'); }catch(e:any){ setStatus(e.message) } }}>Register</button>
          <button className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600" onClick={async()=>{ try{ await login(email,password); setStatus('Logged in'); }catch(e:any){ setStatus(e.message) } }}>Login</button>
          <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={async()=>{ const ok = await me(); setStatus(ok?'Token OK':'Not logged in') }}>Me</button>
        </div>
        <div className="py-2">
          <div ref={googleBtnRef}></div>
        </div>
        <div className="text-sm text-gray-600 min-h-5">{status}</div>
      </div>
    </div>
  )
}

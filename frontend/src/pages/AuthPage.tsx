import { useState } from 'react'
import { login, register, me } from '../api'

export default function AuthPage(){
  const [email, setEmail] = useState('user@example.com')
  const [password, setPassword] = useState('password')
  const [status, setStatus] = useState('')
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
        <div className="text-sm text-gray-600 min-h-5">{status}</div>
      </div>
    </div>
  )
}

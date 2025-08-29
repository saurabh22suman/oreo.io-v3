import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { me as mePing } from '../api'

export default function Layout({ children }: { children: React.ReactNode }){
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const [me, setMe] = useState<{ ok: boolean; id?: number; email?: string; role?: string }|null>(null)

  useEffect(()=>{ (async()=>{ try{ if(token){
    // fetch minimal me info; if old backend returns only ok, we still hide email
    const r = await fetch((import.meta as any).env?.VITE_API_BASE || '/api' + '/auth/me', { headers: token? { Authorization: `Bearer ${token}` } : {} })
    if(r.ok){ try{ const j = await r.json(); setMe(j) } catch{ setMe({ ok: true }) } } else { setMe(null) }
  } }catch{ setMe(null) } })() }, [token])
  const navLink = (to: string, label: string) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded-md px-3 py-2 text-sm ${isActive ? 'bg-primary text-white' : 'text-gray-800 hover:bg-gray-100'}`
      }
    >
      {label}
    </NavLink>
  )

  return (
    <div className="min-h-screen grid grid-cols-12">
      <aside className="col-span-12 sm:col-span-3 lg:col-span-2 border-r border-gray-200 bg-white p-3">
        <div className="text-lg font-semibold mb-3">oreo.io</div>
        {token && me?.email && (
          <div className="mb-3 text-xs text-gray-600 break-words">
            <div className="font-medium text-gray-700">Signed in</div>
            <div>{me.email}</div>
          </div>
        )}
        <nav className="space-y-1">
          {token && navLink('/projects', 'Projects')}
          {navLink('/auth', 'Auth')}
          {token && (
            <button
              className="w-full text-left rounded-md px-3 py-2 text-sm text-gray-800 hover:bg-gray-100"
              onClick={() => {
                try {
                  localStorage.removeItem('token')
                  // Clear any session-cached admin password or transient previews
                  sessionStorage.removeItem('adminPwd')
                } catch {}
                navigate('/auth')
              }}
            >Logout</button>
          )}
        </nav>
      </aside>
      <main className="col-span-12 sm:col-span-9 lg:col-span-10 p-4">{children}</main>
    </div>
  )
}

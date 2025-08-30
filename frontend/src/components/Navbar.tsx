import { Link, useNavigate } from 'react-router-dom'
import { LogIn, LogOut } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import Mascot from './Mascot'
import { useUser } from '../context/UserContext'
import { logout } from '../api'

export default function Navbar() {
  const navigate = useNavigate()
  const { user, refresh } = useUser()

  async function handleLogout() {
    localStorage.removeItem('token')
    // Call backend to clear httpOnly cookie and wait for it to complete
    try {
      await logout()
    } catch (e) {
      // ignore network errors but still refresh local state
    }
    await refresh()
    navigate('/login')
  }
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent){ if(ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  },[])

  return (
  <nav className="topbar py-4 px-6 flex items-center justify-between">
  <button onClick={() => navigate(user ? '/dashboard' : '/')} className="flex items-center gap-3">
        <Mascot pose="happy" size={40} className="rounded-full" />
        <span className="text-2xl font-bold text-indigo-700">oreo.io</span>
      </button>
      <div className="flex gap-4 items-center">
        {user ? (
          <div className="relative" ref={ref}>
            <button onClick={() => setOpen(o => !o)} className="flex items-center gap-3 px-3 py-2">
              <div className="text-sm font-medium">{user.email?.split('@')[0] || 'User'}</div>
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-48 bg-white border-t py-2">
                <button onClick={() => { handleLogout() }} className="w-full text-left px-4 py-2 text-sm text-gray-700">Logout</button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="flex items-center gap-2 text-gray-700 hover:text-indigo-700">
            <LogIn size={18} /> Login
          </Link>
        )}
      </div>
    </nav>
  )
}

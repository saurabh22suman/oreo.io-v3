import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Moon, Sun, Menu, X, ChevronDown, LogOut, Settings, Bell, Search, Command, Sparkles } from 'lucide-react'
import { useUser } from '../context/UserContext'
import { logout as apiLogout } from '../api'

export default function Navbar() {
  const { user, ready, refresh } = useUser()
  const [scrolled, setScrolled] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })
  
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  
  const isLanding = location.pathname === '/landing' || location.pathname === '/'
  const isAuthPage = location.pathname.startsWith('/login') || location.pathname.startsWith('/register')
  
  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  // Close user menu on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  async function handleLogout() {
    try { await apiLogout() } catch { }
    await refresh()
    navigate('/landing')
  }

  return (
    <header 
      className={`
        sticky top-0 z-50 h-14 w-full
        transition-all duration-300
        ${scrolled 
          ? 'bg-surface-1/80 backdrop-blur-xl border-b border-divider/50 shadow-sm' 
          : 'bg-surface-1 border-b border-transparent'
        }
      `}
    >
      <nav className="h-full w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-full items-center justify-between">
          {/* Left: Brand - Always leftmost */}
          <Link to={user ? "/dashboard" : "/landing"} className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-300 shadow-sm">
              <img src="/images/oreo_rabbit.png" alt="oreo.io" className="h-5 w-5 object-contain" />
              <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-primary/10" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-transparent group-hover:from-primary group-hover:to-primary-glow transition-all duration-300">
              oreo.io
            </span>
          </Link>

          {/* Center: Navigation Links (Landing page only) */}
          {!user && isLanding && (
            <div className="hidden md:flex items-center gap-1 bg-surface-2/50 rounded-xl px-1.5 py-1 absolute left-1/2 -translate-x-1/2">
              <a href="#features" className="px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-lg transition-all">Features</a>
              <a href="#how" className="px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-lg transition-all">How it works</a>
              <Link to="/docs" className="px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-lg transition-all">Docs</Link>
            </div>
          )}

          {/* Right: Actions - Always rightmost */}
          <div className="hidden md:flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="relative p-2.5 rounded-xl text-text-secondary hover:text-text-primary bg-surface-2/50 hover:bg-surface-3 transition-all duration-200 group"
              aria-label="Toggle theme"
            >
              <div className="relative w-[18px] h-[18px]">
                <Sun 
                  size={18} 
                  className={`absolute inset-0 transition-all duration-300 ${darkMode ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'}`}
                />
                <Moon 
                  size={18} 
                  className={`absolute inset-0 transition-all duration-300 ${darkMode ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
                />
              </div>
            </button>

            {!user ? (
              <div className="flex items-center gap-2">
                <Link to="/login" className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors rounded-xl hover:bg-surface-3">
                  Log in
                </Link>
                <Link to="/register" className="relative group px-5 py-2 text-sm font-semibold text-white rounded-xl overflow-hidden transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-primary/40">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary-glow" />
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-glow to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative flex items-center gap-1.5">
                    <Sparkles size={14} />
                    Get Started
                  </span>
                </Link>
              </div>
            ) : (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`
                    flex items-center gap-2 p-1.5 pr-3 rounded-xl 
                    transition-all duration-200
                    ${userMenuOpen 
                      ? 'bg-surface-3 ring-1 ring-primary/20' 
                      : 'hover:bg-surface-3'
                    }
                  `}
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-1 ring-inset ring-primary/20">
                    <span className="text-primary text-sm font-semibold">
                      {user.email[0].toUpperCase()}
                    </span>
                  </div>
                  <ChevronDown 
                    size={14} 
                    className={`text-text-muted transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} 
                  />
                </button>

                {/* User Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-surface-2 border border-divider/50 shadow-elevated animate-fade-in overflow-hidden">
                    {/* User info header */}
                    <div className="p-4 bg-gradient-to-br from-primary/10 to-transparent">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-1 ring-inset ring-primary/20">
                          <span className="text-primary font-semibold">{user.email[0].toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{user.email}</p>
                          <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                            <Sparkles size={10} className="text-primary" />
                            Free Plan
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-2">
                      <Link 
                        to="/settings" 
                        className="flex items-center gap-3 px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-xl transition-all"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings size={16} /> 
                        <span>Settings</span>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-danger hover:bg-danger/10 rounded-xl transition-all text-left"
                      >
                        <LogOut size={16} /> 
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl text-text-secondary hover:text-text-primary bg-surface-2/50 hover:bg-surface-3 transition-all"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl text-text-primary bg-surface-2/50 hover:bg-surface-3 transition-all"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-surface-1/95 backdrop-blur-xl border-b border-divider animate-slide-down">
          <div className="px-4 py-3 space-y-1">
            {!user ? (
              <>
                <a href="#features" className="block px-4 py-3 rounded-xl text-sm text-text-primary hover:bg-surface-3">Features</a>
                <a href="#how" className="block px-4 py-3 rounded-xl text-sm text-text-primary hover:bg-surface-3">How it works</a>
                <Link to="/login" className="block px-4 py-3 rounded-xl text-sm text-text-primary hover:bg-surface-3">Log in</Link>
                <Link to="/register" className="block w-full text-center mt-3 btn btn-primary text-sm py-3">Get Started</Link>
              </>
            ) : (
              <>
                <Link to="/dashboard" className="block px-4 py-3 rounded-xl text-sm text-text-primary hover:bg-surface-3">Home</Link>
                <Link to="/projects" className="block px-4 py-3 rounded-xl text-sm text-text-primary hover:bg-surface-3">Projects</Link>
                <Link to="/inbox" className="block px-4 py-3 rounded-xl text-sm text-text-primary hover:bg-surface-3">Inbox</Link>
                <Link to="/settings" className="block px-4 py-3 rounded-xl text-sm text-text-primary hover:bg-surface-3">Settings</Link>
                <div className="border-t border-divider mt-2 pt-2">
                  <button onClick={handleLogout} className="block w-full text-left px-4 py-3 rounded-xl text-sm text-danger hover:bg-danger/10">Sign out</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}


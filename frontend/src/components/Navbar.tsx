import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Moon, Sun, Menu, X, ChevronDown, LogOut, Settings } from 'lucide-react'
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
    const handleScroll = () => setScrolled(window.scrollY > 20)
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
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-surface-1/80 backdrop-blur-md border-b border-divider shadow-sm' 
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <Link to={user ? "/dashboard" : "/landing"} className="flex items-center gap-2 group">
            <div className="relative w-8 h-8 flex items-center justify-center bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
              <img src="/images/oreo_rabbit.png" alt="oreo.io" className="h-6 w-6 object-contain" />
            </div>
            <span className="text-xl font-bold font-display tracking-tight text-text group-hover:text-primary transition-colors">
              oreo.io
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {!user && (
              <>
                <a href="#features" className="text-sm font-medium text-text-secondary hover:text-primary transition-colors">Features</a>
                <a href="#how" className="text-sm font-medium text-text-secondary hover:text-primary transition-colors">How it works</a>
                <Link to="/docs" className="text-sm font-medium text-text-secondary hover:text-primary transition-colors">Docs</Link>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full text-text-secondary hover:text-primary hover:bg-surface-2 transition-all"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {!user ? (
              <div className="flex items-center gap-3">
                <Link to="/login" className="text-sm font-medium text-text hover:text-primary transition-colors">
                  Log in
                </Link>
                <Link to="/register" className="btn btn-primary text-sm shadow-lg shadow-primary/25">
                  Get Started
                </Link>
              </div>
            ) : (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border border-border-subtle bg-surface-1 hover:bg-surface-2 transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                    {user.email[0].toUpperCase()}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* User Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-card bg-surface-1 border border-divider shadow-xl ring-1 ring-black/5 focus:outline-none animate-fade-in">
                    <div className="p-3 border-b border-divider">
                      <p className="text-sm font-medium text-text truncate">{user.email}</p>
                      <p className="text-xs text-text-muted">Free Plan</p>
                    </div>
                    <div className="p-1">
                      <Link to="/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text hover:bg-surface-2 rounded-md transition-colors">
                        <Settings className="w-4 h-4" /> Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10 rounded-md transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" /> Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-4">
             <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full text-text-secondary hover:text-primary hover:bg-surface-2 transition-all"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-text hover:bg-surface-2 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-surface-1 border-b border-divider animate-slide-up">
          <div className="px-4 pt-2 pb-4 space-y-1">
            {!user ? (
              <>
                <a href="#features" className="block px-3 py-2 rounded-md text-base font-medium text-text hover:bg-surface-2 hover:text-primary">Features</a>
                <a href="#how" className="block px-3 py-2 rounded-md text-base font-medium text-text hover:bg-surface-2 hover:text-primary">How it works</a>
                <Link to="/login" className="block px-3 py-2 rounded-md text-base font-medium text-text hover:bg-surface-2 hover:text-primary">Log in</Link>
                <Link to="/register" className="block w-full text-center mt-4 btn btn-primary">Get Started</Link>
              </>
            ) : (
              <>
                <Link to="/dashboard" className="block px-3 py-2 rounded-md text-base font-medium text-text hover:bg-surface-2 hover:text-primary">Dashboard</Link>
                <Link to="/projects" className="block px-3 py-2 rounded-md text-base font-medium text-text hover:bg-surface-2 hover:text-primary">Projects</Link>
                <Link to="/settings" className="block px-3 py-2 rounded-md text-base font-medium text-text hover:bg-surface-2 hover:text-primary">Settings</Link>
                <button onClick={handleLogout} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-danger hover:bg-danger/10">Sign out</button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}


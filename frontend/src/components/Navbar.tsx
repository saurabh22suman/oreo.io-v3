import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { useUser } from '../context/UserContext'
import { logout as apiLogout } from '../api'

export default function Navbar() {
	const { user, ready, refresh } = useUser()
	const [open, setOpen] = useState(false)
	const [userMenuOpen, setUserMenuOpen] = useState(false)
	const [darkMode, setDarkMode] = useState(() => {
		const saved = localStorage.getItem('theme')
		return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
	})
	const menuRef = useRef<HTMLDivElement>(null)
	const navigate = useNavigate()
	const location = useLocation()
	const isLanding = location.pathname.startsWith('/landing')
	const isAuthPage = location.pathname.startsWith('/login') || location.pathname.startsWith('/register')
	const brandTo = (isLanding || isAuthPage) ? '/landing' : '/'

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
		<header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B0F19]/80 backdrop-blur-xl dark:border-white/5 dark:bg-[#0B0F19]/95">
			<nav className="w-full px-4 sm:px-6 lg:px-8">
				<div className="flex h-16 items-center justify-between">
					{/* Brand */}
					<div className="flex items-center gap-3">
						<Link to={brandTo} className="inline-flex items-center gap-2 group">
							<div className="relative">
								<div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
								<img src="/images/oreo_rabbit.png" alt="oreo.io" className="h-8 w-8 relative z-10 object-contain" />
							</div>
							<span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">oreo.io</span>
						</Link>
					</div>

					{/* Desktop links */}
					<div className="hidden md:flex items-center gap-6">
						{ready && !user && (
							<>
								<a href="#features" className="text-sm font-medium text-slate-400 hover:text-cyan-400 transition-colors">Features</a>
								<a href="#how" className="text-sm font-medium text-slate-400 hover:text-cyan-400 transition-colors">How it works</a>
								<a href="/docs" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-400 hover:text-cyan-400 transition-colors">Docs</a>
							</>
						)}
					</div>

					{/* Actions */}
					<div className="hidden md:flex items-center gap-3">
						{/* Theme Toggle */}
						<button
							onClick={() => setDarkMode(!darkMode)}
							className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
							aria-label="Toggle theme"
						>
							{darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
						</button>

						{isLanding ? (
							<Link to="/login" className="px-6 py-2 rounded-full bg-azure-blue hover:bg-azure-blue/90 text-white font-medium text-sm transition-all shadow-[0_0_20px_-5px_rgba(0,120,212,0.5)] hover:shadow-[0_0_30px_-5px_rgba(0,120,212,0.6)]">
								Log in
							</Link>
						) : isAuthPage ? (
							<></>
						) : ready && user ? (
							<div className="relative" ref={menuRef}>
								<button
									type="button"
									onClick={() => setUserMenuOpen(v => !v)}
									className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
									aria-haspopup="menu"
									aria-expanded={userMenuOpen}
								>
									<span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-azure-blue/20 text-cyan-400 ring-1 ring-inset ring-cyan-500/30">
										<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
									</span>
									<span className="hidden sm:inline text-slate-300">{user?.email}</span>
									<svg className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
								</button>
								{userMenuOpen && (
									<div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-white/10 bg-[#0F131F] backdrop-blur-xl py-1 shadow-2xl" role="menu">
										<Link to="/settings" className="block px-3 py-2 text-sm text-slate-300 hover:bg-white/5" role="menuitem">User Settings</Link>
										<button onClick={handleLogout} className="block w-full px-3 py-2 text-left text-sm text-rose-400 hover:bg-rose-500/10" role="menuitem">Logout</button>
									</div>
								)}
							</div>
						) : (
							<>
								<Link to="/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Log in</Link>
								<Link to="/register" className="px-6 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-azure-blue hover:from-cyan-400 hover:to-azure-blue/90 text-white font-medium text-sm transition-all shadow-[0_0_20px_-5px_rgba(0,120,212,0.5)]">
									Sign up
								</Link>
							</>
						)}
					</div>

					{/* Mobile menu button */}
					<button
						type="button"
						className="md:hidden inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10"
						aria-label="Toggle menu"
						aria-controls="mobile-menu"
						aria-expanded={open}
						onClick={() => setOpen(v => !v)}
					>
						<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							{open ? (
								<path d="M18 6L6 18M6 6l12 12" />
							) : (
								<path d="M3 6h18M3 12h18M3 18h18" />
							)}
						</svg>
					</button>
				</div>
			</nav>

			{/* Mobile panel */}
			{open && (
				<div id="mobile-menu" className="md:hidden border-t border-white/10 bg-[#0F131F]/95 backdrop-blur-xl">
					<div className="w-full px-4 sm:px-6 lg:px-8 py-4 space-y-3">
						{/* Theme toggle for mobile */}
						<button
							onClick={() => setDarkMode(!darkMode)}
							className="w-full flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-sm font-medium"
						>
							<span>Theme</span>
							{darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
						</button>

						{ready && !user && (
							<>
								<a href="#features" className="block text-sm font-medium text-slate-400 hover:text-cyan-400">Features</a>
								<a href="#how" className="block text-sm font-medium text-slate-400 hover:text-cyan-400">How it works</a>
								<a href="/docs" target="_blank" rel="noopener noreferrer" className="block text-sm font-medium text-slate-400 hover:text-cyan-400">Docs</a>
								<div className="pt-2 border-t border-white/10" />
							</>
						)}
						{isLanding ? (
							<Link to="/login" className="block text-center px-6 py-2 rounded-full bg-azure-blue text-white font-medium text-sm">Log in</Link>
						) : isAuthPage ? (
							<div />
						) : ready && user ? (
							<div className="space-y-2">
								<div className="flex items-center gap-2 text-sm text-slate-300 p-2">
									<span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-azure-blue/20 text-cyan-400">
										<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
									</span>
									<span>{user?.email}</span>
								</div>
								<Link to="/settings" className="block text-sm font-medium text-slate-400 hover:text-cyan-400 px-2">User Settings</Link>
								<button onClick={handleLogout} className="block text-left text-sm font-medium text-rose-400 hover:text-rose-300 px-2">Logout</button>
							</div>
						) : (
							<div className="space-y-2">
								<Link to="/login" className="block text-sm font-medium text-slate-400 hover:text-white">Log in</Link>
								<Link to="/register" className="block text-center px-6 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-azure-blue text-white font-medium text-sm">Sign up</Link>
							</div>
						)}
					</div>
				</div>
			)}
		</header>
	)
}


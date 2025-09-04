import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useUser } from '../context/UserContext'
import { logout as apiLogout } from '../api'

export default function Navbar() {
	const { user, ready, refresh } = useUser()
	const [open, setOpen] = useState(false)
	const [userMenuOpen, setUserMenuOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)
	const navigate = useNavigate()
	const location = useLocation()
	const isLanding = location.pathname.startsWith('/landing')
	const isAuthPage = location.pathname.startsWith('/login') || location.pathname.startsWith('/register')
	// Clicking brand: if on landing/auth pages, keep user on /landing; else go to root for RootRedirect
	const brandTo = (isLanding || isAuthPage) ? '/landing' : '/'

	// Close user menu on outside click
	useEffect(() => {
		function onDocClick(e: MouseEvent){
			if(!menuRef.current) return
			if(!menuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
		}
		document.addEventListener('click', onDocClick)
		return () => document.removeEventListener('click', onDocClick)
	}, [])

	async function handleLogout(){
		try{ await apiLogout() }catch{}
		// Immediately refresh session (will set user=null) and route to landing
		await refresh()
		navigate('/landing')
	}

	return (
		<header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/70 backdrop-blur-lg supports-[backdrop-filter]:bg-white/60">
			<nav className="w-full px-4 sm:px-6 lg:px-8">
				<div className="flex h-14 items-center justify-between">
					{/* Brand */}
					<div className="flex items-center gap-2">
						<Link to={brandTo} className="inline-flex items-center gap-2">
							<img src="/images/dutch_rabbit.svg" alt="oreo.io" className="h-6 w-6" />
							<span className="text-sm font-semibold tracking-tight text-slate-900">oreo.io</span>
						</Link>
					</div>

					{/* Desktop links */}
					<div className="hidden md:flex items-center gap-6">
						{ready && !user && (
							<>
								<a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900">Features</a>
								<a href="#how" className="text-sm font-medium text-slate-600 hover:text-slate-900">How it works</a>
								<a href="/docs" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-600 hover:text-slate-900">Docs</a>
							</>
						)}
					</div>

					{/* Actions */}
					<div className="hidden md:flex items-center gap-3">
						{/* Top-right actions */}
						{isLanding ? (
							// Landing: only Login button
							<Link to="/login" className="relative btn-shine inline-flex items-center rounded-lg bg-gradient-to-br from-indigo-500 via-sky-500 to-violet-500 px-3 py-1.5 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(0,0,0,.05)_inset,0_8px_24px_-10px_rgba(99,102,241,.35)]">Log in</Link>
						) : isAuthPage ? (
							// Login/Register pages: show nothing
							<></>
						) : ready && user ? (
							<div className="relative" ref={menuRef}>
								<button
									type="button"
									onClick={() => setUserMenuOpen(v => !v)}
									className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 pl-1 pr-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
									aria-haspopup="menu"
									aria-expanded={userMenuOpen}
								>
									<span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-200">
										{/* User icon */}
										<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
									</span>
									<span className="hidden sm:inline text-slate-700">{user?.email}</span>
									<svg className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
								</button>
								{userMenuOpen && (
									<div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg" role="menu">
										<Link to="/settings" className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" role="menuitem">User Settings</Link>
										<button onClick={handleLogout} className="block w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" role="menuitem">Logout</button>
									</div>
								)}
							</div>
						) : (
							<>
								<Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Log in</Link>
								<Link to="/register" className="relative btn-shine inline-flex items-center rounded-lg bg-gradient-to-br from-indigo-500 via-sky-500 to-violet-500 px-3 py-1.5 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(0,0,0,.05)_inset,0_8px_24px_-10px_rgba(99,102,241,.35)]">
									Sign up
								</Link>
							</>
						)}
					</div>

					{/* Mobile menu button */}
					<button
						type="button"
						className="md:hidden inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
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
				<div id="mobile-menu" className="md:hidden border-t border-slate-200/80 bg-white">
					<div className="w-full px-4 sm:px-6 lg:px-8 py-3 space-y-2">
						{ready && !user && (
							<>
								<a href="#features" className="block text-sm font-medium text-slate-700">Features</a>
								<a href="#how" className="block text-sm font-medium text-slate-700">How it works</a>
								<a href="/docs" target="_blank" rel="noopener noreferrer" className="block text-sm font-medium text-slate-700">Docs</a>
								<div className="pt-2 border-t border-slate-200" />
							</>
						)}
						{/* Mobile actions */}
						{isLanding ? (
							<div className="flex items-center gap-2">
								<Link to="/login" className="inline-flex items-center rounded-lg bg-gradient-to-br from-indigo-500 via-sky-500 to-violet-500 px-3 py-1.5 text-sm font-medium text-white">Log in</Link>
							</div>
						) : isAuthPage ? (
							<div />
						) : ready && user ? (
							<div className="space-y-2">
								<div className="flex items-center gap-2 text-sm text-slate-700">
									<span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-200">
										<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
									</span>
									<span>{user?.email}</span>
								</div>
								<Link to="/settings" className="block text-sm font-medium text-slate-700">User Settings</Link>
								<button onClick={handleLogout} className="block text-left text-sm font-medium text-rose-600">Logout</button>
							</div>
						) : (
							<div className="flex items-center gap-2">
								<Link to="/login" className="text-sm font-medium text-slate-700">Log in</Link>
								<Link to="/register" className="inline-flex items-center rounded-lg bg-gradient-to-br from-indigo-500 via-sky-500 to-violet-500 px-3 py-1.5 text-sm font-medium text-white">Sign up</Link>
							</div>
						)}
					</div>
				</div>
			)}
		</header>
	)
}


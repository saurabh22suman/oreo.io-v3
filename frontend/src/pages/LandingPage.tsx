import { useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import {
	BookOpen, Star as StarIcon, Database, Users, Lock, Rocket,
	ShieldCheck, GitMerge, ArrowRight, Sparkles, Calendar
} from 'lucide-react'

export default function LandingPage() {
	const parallaxRef = useRef<HTMLDivElement | null>(null)
	const rabbitRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		// Reveal-on-scroll
		const io = new IntersectionObserver((entries) => {
			entries.forEach(e => {
				if (e.isIntersecting) {
					e.target.classList.add('show')
					io.unobserve(e.target as Element)
				}
			})
		}, { threshold: 0.15 })
		document.querySelectorAll('.reveal').forEach(el => io.observe(el))
		return () => io.disconnect()
	}, [])

	useEffect(() => {
		// Parallax for mascot
		const wrap = parallaxRef.current
		const rabbit = rabbitRef.current
		if (!wrap || !rabbit) return
		const onMove = (e: MouseEvent) => {
			const rect = wrap.getBoundingClientRect()
			const x = (e.clientX - rect.left) / rect.width - 0.5
			const y = (e.clientY - rect.top) / rect.height - 0.5
			rabbit.style.transform = `translate(${x * 8}px, ${y * 8}px)`
		}
		const onLeave = () => { rabbit.style.transform = 'translate(0,0)' }
		wrap.addEventListener('mousemove', onMove)
		wrap.addEventListener('mouseleave', onLeave)
		return () => {
			wrap.removeEventListener('mousemove', onMove)
			wrap.removeEventListener('mouseleave', onLeave)
		}
	}, [])

	// No analytics charts on landing now

	return (
		<div className="min-h-screen flex flex-col bg-white">
			<Navbar />

			{/* Hero with animated background */}
			<section className="relative hero-gradient overflow-hidden">
				{/* background layers */}
				<div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
					<div className="absolute inset-0 opacity-[0.07]" style={{
						backgroundImage: 'linear-gradient(to right, rgba(15,23,42,.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,.25) 1px, transparent 1px)',
						backgroundSize: '40px 40px',
						animation: 'gridMove 30s linear infinite'
					}} />
					<div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl" style={{ animation: 'blob 18s ease-in-out infinite' }} />
					<div className="absolute -bottom-16 -right-10 h-72 w-72 rounded-full bg-sky-400/25 blur-3xl" style={{ animation: 'blob 22s ease-in-out infinite reverse' }} />
					<div className="absolute left-1/2 top-1/2 h-[620px] w-[620px] rounded-full opacity-[0.06]" style={{
						transform: 'translate(-50%, -50%)',
						background: 'conic-gradient(from 0deg at 50% 50%, rgba(99,102,241,.25), rgba(56,189,248,.25), rgba(168,85,247,.25), rgba(99,102,241,.25))',
						animation: 'spinSlow 40s linear infinite'
					}} />
				</div>

				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-28 pb-20">
					<div className="grid md:grid-cols-2 gap-10 items-center">
						{/* Left copy */}
						<div className="reveal">
							<div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
								New: Collaborative review flows
							</div>
							<h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl tracking-tight font-semibold text-slate-900">Welcome to oreo.io</h1>
							<p className="mt-4 text-base sm:text-lg text-slate-600 max-w-xl">Modern, secure, and collaborative data platform for teams. Bring your datasets, review changes, and ship confidently with automated approvals.</p>
							<div className="mt-8 flex flex-col sm:flex-row gap-3">
								<a href="/register" className="relative btn-shine inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-sky-500 to-violet-500 px-5 py-3 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(0,0,0,.05)_inset,0_10px_30px_-10px_rgba(99,102,241,.35)]">Create account</a>
								<a href="/docs" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 transition">
									<BookOpen className="w-4 h-4" /> Read docs
								</a>
							</div>
							<div className="mt-6 flex items-center gap-2 text-slate-600">
								<StarIcon className="w-4 h-4 text-amber-500" />
								<span className="text-sm">Loved by early users for speed and simplicity.</span>
							</div>
						</div>

						{/* Right visual card with parallax mascot */}
						<div className="relative reveal">
							<div id="heroParallax" ref={parallaxRef} className="relative mx-auto max-w-md">
								<div className="absolute -top-8 -left-10 h-48 w-48 bg-indigo-500/20 blur-3xl" style={{ animation: 'blob 12s ease-in-out infinite' }} />
								<div className="absolute bottom-8 -right-8 h-56 w-56 bg-sky-400/20 blur-3xl" style={{ animation: 'blob 16s ease-in-out infinite reverse' }} />
								<div className="relative rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-xl shadow-2xl">
									<div className="absolute inset-px rounded-2xl bg-gradient-to-b from-white/50 to-transparent pointer-events-none" />
									<div className="p-6">
										<div className="grid grid-cols-3 gap-4">
											<div className="col-span-2">
												<h3 className="text-base font-medium tracking-tight text-slate-900">Meet Oreo, your dutch rabbit guide</h3>
												<p className="mt-1 text-sm text-slate-600">He keeps your data tidy, approvals swift, and dashboards happy.</p>
											</div>
											<div className="relative">
												<div className="absolute right-2 top-2 h-0 w-0">
													<span className="absolute left-1/2 top-1/2 -ml-4 -mt-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200" style={{ animation: 'orbit 10s linear infinite' }}>
														<ShieldCheck className="w-4 h-4 text-emerald-600" />
													</span>
													<span className="absolute left-1/2 top-1/2 -ml-4 -mt-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200" style={{ animation: 'orbit 14s linear infinite reverse' }}>
														<GitMerge className="w-4 h-4 text-sky-600" />
													</span>
												</div>
											</div>
										</div>
										<div className="mt-6 relative">
											<div className="absolute -inset-8 -z-10 rounded-3xl bg-gradient-to-tr from-indigo-500/10 via-violet-500/10 to-sky-/10 blur-2xl" />
											<div className="mx-auto flex items-center justify-center">
												<div ref={rabbitRef} className="w-56 h-56" style={{ animation: 'floatY 5s ease-in-out infinite' }}>
													<img src="/images/dutch_rabbit.svg" alt="Oreo mascot" className="w-full h-full object-contain" />
												</div>
											</div>
										</div>
										<div className="mt-6 grid grid-cols-3 gap-3 text-center">
											<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
												<div className="text-sm font-medium text-slate-900">1.3M</div>
												<div className="text-xs text-slate-600">rows/day</div>
											</div>
											<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
												<div className="text-sm font-medium text-slate-900">99.99%</div>
												<div className="text-xs text-slate-600">uptime</div>
											</div>
											<div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
												<div className="text-sm font-medium text-slate-900">~120ms</div>
												<div className="text-xs text-slate-600">queries</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Features */}
			<section id="features" className="relative">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
					<div className="max-w-3xl">
						<h2 className="text-3xl sm:text-4xl tracking-tight font-semibold text-slate-900 reveal">What you get</h2>
						<p className="mt-2 text-slate-600 reveal">Essential building blocks for collaborative data workflows.</p>
					</div>
					<div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
						<div className="reveal group relative rounded-2xl border border-slate-200 bg-white p-5 hover:-translate-y-1 transition will-change-transform">
							<div className="flex items-center gap-3">
								<div className="rounded-lg bg-indigo-500/10 p-2 ring-1 ring-indigo-300/20">
									<Database className="w-5 h-5 text-indigo-600" />
								</div>
								<h3 className="font-medium text-slate-900 tracking-tight">Data Management</h3>
							</div>
							<p className="mt-3 text-sm text-slate-600">Upload, validate, and manage datasets with ease.</p>
						</div>
						<div className="reveal group relative rounded-2xl border border-slate-200 bg-white p-5 hover:-translate-y-1 transition">
							<div className="flex items-center gap-3">
								<div className="rounded-lg bg-sky-500/10 p-2 ring-1 ring-sky-300/20">
									<Users className="w-5 h-5 text-sky-600" />
								</div>
								<h3 className="font-medium text-slate-900 tracking-tight">Collaboration</h3>
							</div>
							<p className="mt-3 text-sm text-slate-600">Invite teammates, assign roles, and review changes.</p>
						</div>
						<div className="reveal group relative rounded-2xl border border-slate-200 bg-white p-5 hover:-translate-y-1 transition">
							<div className="flex items-center gap-3">
								<div className="rounded-lg bg-emerald-500/10 p-2 ring-1 ring-emerald-300/20">
									<Lock className="w-5 h-5 text-emerald-600" />
								</div>
								<h3 className="font-medium text-slate-900 tracking-tight">Secure Approvals</h3>
							</div>
							<p className="mt-3 text-sm text-slate-600">Multi-reviewer approval flows ensure integrity.</p>
						</div>
						<div className="reveal group relative rounded-2xl border border-slate-200 bg-white p-5 hover:-translate-y-1 transition">
							<div className="flex items-center gap-3">
								<div className="rounded-lg bg-violet-500/10 p-2 ring-1 ring-violet-300/20">
									<Rocket className="w-5 h-5 text-violet-600" />
								</div>
								<h3 className="font-medium text-slate-900 tracking-tight">Fast & Modern</h3>
							</div>
							<p className="mt-3 text-sm text-slate-600">Built for speed with a robust, scalable backend.</p>
						</div>
					</div>
				</div>
			</section>

			{/* How it works */}
			<section id="how" className="relative">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8">
					<div className="grid lg:grid-cols-3 gap-10 items-start">
						<div className="lg:col-span-2">
							<h2 className="text-3xl tracking-tight font-semibold text-slate-900 reveal">How it works</h2>
							<ol className="mt-6 space-y-5">
								{['Register and create your project.','Upload datasets and define schema/rules.','Invite reviewers and submit changes for approval.','Track approvals and manage data collaboratively.'].map((t, i) => (
									<li key={i} className="reveal flex gap-4">
										<span className="h-7 w-7 shrink-0 rounded-full bg-slate-100 text-slate-900 flex items-center justify-center text-xs">{i+1}</span>
										<p className="text-slate-600">{t}</p>
									</li>
								))}
							</ol>
							{/* CTA removed as requested */}
						</div>
						{/* Animated panel */}
						<div className="reveal">
							<div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
								<div className="h-56 w-full rounded-lg" style={{
									animation: 'drift 14s ease-in-out infinite',
									background: 'radial-gradient(140px 140px at 20% 30%, rgba(99,102,241,.35), transparent 60%), radial-gradient(160px 160px at 70% 50%, rgba(56,189,248,.35), transparent 60%), radial-gradient(120px 120px at 40% 80%, rgba(168,85,247,.35), transparent 60%), linear-gradient(180deg, rgba(255,255,255,.8), rgba(255,255,255,.6))'
								}} />
								<div className="mt-4 grid grid-cols-3 gap-3">
									<div className="h-20 w-full rounded-lg ring-1 ring-slate-200 bg-gradient-to-br from-indigo-500/15 to-transparent" style={{ animation: 'floatY 6s ease-in-out infinite' }} />
									<div className="h-20 w-full rounded-lg ring-1 ring-slate-200 bg-gradient-to-br from-sky-500/15 to-transparent" style={{ animation: 'floatY 7s ease-in-out infinite' }} />
									<div className="h-20 w-full rounded-lg ring-1 ring-slate-200 bg-gradient-to-br from-violet-500/15 to-transparent" style={{ animation: 'floatY 8s ease-in-out infinite' }} />
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Analytics section removed as requested */}

			{/* CTA */}
			<section className="relative pb-20">
				<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
					<div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-500/15 via-sky-500/15 to-violet-500/15 p-8 sm:p-10 text-center">
						<div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
						<div aria-hidden className="pointer-events-none absolute -z-10 left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" style={{ animation: 'blob 18s ease-in-out infinite' }} />
						<h3 className="text-2xl sm:text-3xl tracking-tight font-semibold text-slate-900">Ship trustworthy data, faster</h3>
						<p className="mt-2 text-slate-600">Sign up in minutes. Your dutch rabbit will guide the way.</p>
						<div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
							<a href="/register" className="relative btn-shine inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-medium text-neutral-900 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 transition">
								Get started free <Sparkles className="w-4 h-4" />
							</a>
							<a href="/docs" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 transition">
								Book a demo <Calendar className="w-4 h-4" />
							</a>
						</div>
					</div>
				</div>
			</section>

			<Footer />
		</div>
	)
}

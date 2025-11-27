import { useEffect } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import {
	Table, ShieldCheck, History, FileJson,
	ArrowRight, CheckCircle2, Layout
} from 'lucide-react'

export default function LandingPage() {
	useEffect(() => {
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

	return (
		<div className="min-h-screen flex flex-col bg-[#0B0F19] text-white overflow-x-hidden font-sans selection:bg-cyan-500/30">
			<Navbar />

			{/* Hero Section */}
			<section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
				{/* Background Elements */}
				<div className="absolute inset-0 z-0 pointer-events-none">
					<img src="/images/Data_universe.png" alt="Background" className="w-full h-full object-cover opacity-20" />
					<div className="absolute inset-0 bg-gradient-to-b from-[#0B0F19] via-[#0B0F19]/90 to-[#0B0F19]"></div>
				</div>

				<div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
					<div className="reveal inline-flex items-center gap-2 px-4 py-2 rounded-full bg-azure-blue/10 border border-azure-blue/20 backdrop-blur-md mb-8">
						<span className="flex h-2 w-2 rounded-full bg-azure-blue animate-pulse" />
						<span className="text-sm font-medium text-cyan-100">Simple for Users. Powerful for Data</span>
					</div>

					<h1 className="reveal text-5xl md:text-7xl font-bold tracking-tight mb-6">
						Your Data, <br />
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-azure-blue">Validated & Editable.</span>
					</h1>

					<p className="reveal mt-6 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
						Forget the SQL overhead.
						<b>Oreo</b> provides an intuitive spreadsheet interface for business users, with built-in validation, governance, and full change tracking.
					</p>

					<div className="reveal mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
						<a href="/register" className="group relative px-8 py-4 bg-azure-blue hover:bg-azure-blue/90 rounded-full font-semibold text-white transition-all shadow-[0_0_40px_-10px_rgba(0,120,212,0.5)] hover:shadow-[0_0_60px_-15px_rgba(0,120,212,0.6)] hover:-translate-y-1">
							<span className="relative z-10 flex items-center gap-2">
								Let's Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
							</span>
						</a>
					</div>

					{/* Hero Visual - The "Live Editor" Mockup */}
					<div className="reveal mt-20 relative max-w-5xl mx-auto">
						<div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-azure-blue rounded-[2rem] blur opacity-20"></div>
						<div className="relative rounded-[2rem] bg-[#0F131F] border border-white/10 shadow-2xl overflow-hidden">
							{/* Mockup Header */}
							<div className="h-12 bg-white/5 border-b border-white/5 flex items-center px-6 gap-4">
								<div className="flex gap-2">
									<div className="w-3 h-3 rounded-full bg-red-500/50"></div>
									<div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
									<div className="w-3 h-3 rounded-full bg-green-500/50"></div>
								</div>
								<div className="flex-1 text-center text-xs font-mono text-slate-500">user_transactions.data — Oreo Editor</div>
							</div>

							{/* Mockup Body */}
							<div className="p-8 grid md:grid-cols-3 gap-8">
								{/* Left: The Editor UI */}
								<div className="md:col-span-2 space-y-4">
									<div className="flex items-center justify-between mb-4">
										<h3 className="text-lg font-semibold text-white flex items-center gap-2">
											<Table className="w-5 h-5 text-azure-blue" /> Data Grid
										</h3>
										<span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Live Mode</span>
									</div>

									{/* Fake Table */}
									<div className="border border-white/10 rounded-lg overflow-hidden bg-[#0B0F19]">
										<div className="grid grid-cols-3 bg-white/5 text-xs font-medium text-slate-400 p-3 border-b border-white/10">
											<div>user_id</div>
											<div>status</div>
											<div>amount</div>
										</div>
										<div className="divide-y divide-white/5 text-sm text-slate-300">
											<div className="grid grid-cols-3 p-3 hover:bg-white/5 transition-colors cursor-text group">
												<div className="font-mono text-slate-500">u_8392</div>
												<div className="text-emerald-400">active</div>
												<div>$1,240.00</div>
											</div>
											<div className="grid grid-cols-3 p-3 hover:bg-white/5 transition-colors cursor-text group bg-azure-blue/10">
												<div className="font-mono text-slate-500">u_8393</div>
												<div className="text-yellow-400 flex items-center gap-2">
													pending
													<span className="opacity-0 group-hover:opacity-100 text-[10px] bg-azure-blue px-1 rounded text-white">EDIT</span>
												</div>
												<div className="border border-azure-blue rounded px-1 bg-[#0B0F19]">$450.50|</div>
											</div>
											<div className="grid grid-cols-3 p-3 hover:bg-white/5 transition-colors cursor-text group">
												<div className="font-mono text-slate-500">u_8394</div>
												<div className="text-red-400">blocked</div>
												<div>$0.00</div>
											</div>
										</div>
									</div>
								</div>

								{/* Right: The Mascot/Validator */}
								<div className="relative flex flex-col items-center justify-center text-center space-y-4 border-l border-white/5 pl-8">
									<div className="w-32 h-32 relative">
										<div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl animate-pulse"></div>
										<img src="/images/oreo_rabbit.png" alt="Oreo" className="relative z-10 w-full h-full object-contain" />
									</div>
									<div>
										<h4 className="text-white font-medium">Oreo Validator</h4>
										<p className="text-xs text-slate-400 mt-1">Schema enforcement active.</p>
									</div>
									<div className="w-full bg-white/5 rounded-lg p-3 text-left space-y-2">
										<div className="flex items-center gap-2 text-xs text-emerald-400">
											<CheckCircle2 className="w-3 h-3" /> Type check passed
										</div>
										<div className="flex items-center gap-2 text-xs text-emerald-400">
											<CheckCircle2 className="w-3 h-3" /> Constraints satisfied
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Core Features */}
			<section className="py-24 relative z-10 bg-[#0F131F]/50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="reveal text-3xl md:text-4xl font-bold mb-4">Why use Oreo?</h2>
						<p className="reveal text-slate-400 max-w-2xl mx-auto">
							Leave the complexity behind.
							Experience data the way it was meant to be—simple, familiar, and effortless.
						</p>
					</div>

					<div className="grid md:grid-cols-3 gap-8">
						<div className="reveal group p-8 rounded-[2rem] bg-[#0B0F19] border border-white/10 hover:border-azure-blue/50 transition-all hover:-translate-y-1 relative overflow-hidden">
							<div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
								<Table className="w-24 h-24 text-azure-blue" />
							</div>
							<div className="w-12 h-12 rounded-2xl bg-azure-blue/10 flex items-center justify-center mb-6 text-azure-blue">
								<Layout className="w-6 h-6" />
							</div>
							<h3 className="text-xl font-semibold mb-3">Live Data Editor</h3>
							<p className="text-slate-400 leading-relaxed">
								Directly edit rows in your Delta tables. Fix typos, adjust status flags, or patch data without running complex UPDATE scripts.
							</p>
						</div>

						<div className="reveal group p-8 rounded-[2rem] bg-[#0B0F19] border border-white/10 hover:border-purple-500/50 transition-all hover:-translate-y-1 relative overflow-hidden">
							<div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
								<ShieldCheck className="w-24 h-24 text-purple-500" />
							</div>
							<div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 text-purple-500">
								<FileJson className="w-6 h-6" />
							</div>
							<h3 className="text-xl font-semibold mb-3">Schema Governance</h3>
							<p className="text-slate-400 leading-relaxed">
								Oreo enforces your schema rules strictly. No more "schema drift" or accidental type mismatches corrupting your data.
							</p>
						</div>

						<div className="reveal group p-8 rounded-[2rem] bg-[#0B0F19] border border-white/10 hover:border-emerald-500/50 transition-all hover:-translate-y-1 relative overflow-hidden">
							<div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
								<History className="w-24 h-24 text-emerald-500" />
							</div>
							<div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 text-emerald-500">
								<History className="w-6 h-6" />
							</div>
							<h3 className="text-xl font-semibold mb-3">Audit & Time Travel</h3>
							<p className="text-slate-400 leading-relaxed">
								Every edit is versioned. See exactly who changed what, and roll back to any previous version of your data instantly.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Integration / How it works */}
			<section className="py-24 relative overflow-hidden">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid lg:grid-cols-2 gap-16 items-center">
						<div className="reveal">
							<h2 className="text-3xl md:text-4xl font-bold mb-6">Seamless Integration</h2>
							<p className="text-slate-400 text-lg mb-8">
								Oreo connects to your existing storage. Whether it's local files, S3, or Azure Blob Storage,
								we provide the management layer on top of your data.
							</p>

							<div className="space-y-6">
								<div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
									<div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">1</div>
									<div>
										<h4 className="font-semibold">Connect Storage</h4>
										<p className="text-sm text-slate-500">Point Oreo to your Delta Lake root.</p>
									</div>
								</div>
								<div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
									<div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">2</div>
									<div>
										<h4 className="font-semibold">Define Rules</h4>
										<p className="text-sm text-slate-500">Set up Great Expectations suites for quality.</p>
									</div>
								</div>
								<div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
									<div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">3</div>
									<div>
										<h4 className="font-semibold">Manage & Edit</h4>
										<p className="text-sm text-slate-500">Use the UI to curate your datasets.</p>
									</div>
								</div>
							</div>
						</div>

						<div className="reveal relative">
							{/* Abstract representation of data flow */}
							<div className="relative rounded-[2rem] bg-[#0F131F] border border-white/10 p-8 shadow-2xl">
								<img src="/images/Data_management.png" alt="Integration" className="w-full h-auto object-contain opacity-80 hover:opacity-100 transition-opacity duration-500" />
							</div>
						</div>
					</div>
				</div>
			</section>

			<Footer />
		</div>
	)
}

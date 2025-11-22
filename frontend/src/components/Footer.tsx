import { useUser } from '../context/UserContext'
import { Github, Twitter, Linkedin } from 'lucide-react'

export default function Footer() {
	const { user, ready } = useUser()
	const showMarketing = !(ready && user)
	return (
		<footer className="border-t border-white/10 bg-[#0B0F19]/80 backdrop-blur-xl">
			<div className="w-full px-4 sm:px-6 lg:px-8 py-8">
				<div className="grid md:grid-cols-4 gap-6">
					{/* Brand & Description */}
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<img src="/images/oreo_rabbit.png" alt="oreo.io" className="h-6 w-6 object-contain" />
							<span className="text-base font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">oreo.io</span>
						</div>
						<p className="text-xs text-slate-400 leading-relaxed">
							The missing UI for Delta Lake. Manage, validate, and edit your data with confidence.
						</p>
						{/* Social Links */}
						<div className="flex items-center gap-2">
							<a href="https://github.com" target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-cyan-400 hover:bg-white/10 transition-colors">
								<Github className="w-3.5 h-3.5" />
							</a>
							<a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-cyan-400 hover:bg-white/10 transition-colors">
								<Twitter className="w-3.5 h-3.5" />
							</a>
							<a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-cyan-400 hover:bg-white/10 transition-colors">
								<Linkedin className="w-3.5 h-3.5" />
							</a>
						</div>
						{/* Copyright moved here */}
						<p className="text-[10px] text-slate-500 pt-2">
							© {new Date().getFullYear()} oreo.io — All rights reserved.
						</p>
					</div>

					{/* Quick Links */}
					{showMarketing && (
						<>
							<div>
								<h4 className="text-xs font-semibold text-white mb-2">Product</h4>
								<nav className="flex flex-col gap-1.5 text-xs text-slate-400">
									<a href="#features" className="hover:text-cyan-400 transition-colors">Features</a>
									<a href="#how" className="hover:text-cyan-400 transition-colors">How it works</a>
									<a href="/docs" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">Documentation</a>
									<a href="/register" className="hover:text-cyan-400 transition-colors">Get Started</a>
								</nav>
							</div>
							<div>
								<h4 className="text-xs font-semibold text-white mb-2">Resources</h4>
								<nav className="flex flex-col gap-1.5 text-xs text-slate-400">
									<a href="#" className="hover:text-cyan-400 transition-colors">Blog</a>
									<a href="#" className="hover:text-cyan-400 transition-colors">Community</a>
									<a href="#" className="hover:text-cyan-400 transition-colors">Support</a>
									<a href="#" className="hover:text-cyan-400 transition-colors">Contact</a>
								</nav>
							</div>
							<div>
								<h4 className="text-xs font-semibold text-white mb-2">Legal</h4>
								<nav className="flex flex-col gap-1.5 text-xs text-slate-400">
									<a href="#" className="hover:text-cyan-400 transition-colors">Privacy Policy</a>
									<a href="#" className="hover:text-cyan-400 transition-colors">Terms of Service</a>
								</nav>
							</div>
						</>
					)}
				</div>
			</div>
		</footer>
	)
}


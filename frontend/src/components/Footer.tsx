import { useUser } from '../context/UserContext'
import { Github, Twitter, Linkedin } from 'lucide-react'

export default function Footer() {
	const { user, ready } = useUser()
	const showMarketing = !(ready && user)

	return (
		<footer className="border-t border-divider bg-surface-2">
			<div className="max-w-content mx-auto px-4 sm:px-6 py-8">
				<div className="grid md:grid-cols-4 gap-6">
					{/* Brand */}
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<img src="/images/oreo_rabbit.png" alt="oreo.io" className="h-5 w-5 object-contain" />
							<span className="text-sm font-semibold text-text-primary">oreo.io</span>
						</div>
						<p className="text-xs text-text-muted leading-relaxed">
							Data editing and validation for Delta Lake.
						</p>
						<div className="flex items-center gap-2">
							<a href="https://github.com" target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md bg-surface-3 text-text-muted hover:text-text-primary hover:bg-surface-4 transition-colors">
								<Github size={14} />
							</a>
							<a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md bg-surface-3 text-text-muted hover:text-text-primary hover:bg-surface-4 transition-colors">
								<Twitter size={14} />
							</a>
							<a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md bg-surface-3 text-text-muted hover:text-text-primary hover:bg-surface-4 transition-colors">
								<Linkedin size={14} />
							</a>
						</div>
						<p className="text-[10px] text-text-muted pt-2">
							© {new Date().getFullYear()} oreo.io
						</p>
					</div>

					{showMarketing && (
						<>
							<div>
								<h4 className="text-xs font-medium text-text-primary mb-2">Product</h4>
								<nav className="flex flex-col gap-1.5 text-xs text-text-muted">
									<a href="#features" className="hover:text-text-primary transition-colors">Features</a>
									<a href="#how" className="hover:text-text-primary transition-colors">How it works</a>
									<a href="/docs" className="hover:text-text-primary transition-colors">Documentation</a>
								</nav>
							</div>
							<div>
								<h4 className="text-xs font-medium text-text-primary mb-2">Resources</h4>
								<nav className="flex flex-col gap-1.5 text-xs text-text-muted">
									<a href="#" className="hover:text-text-primary transition-colors">Blog</a>
									<a href="#" className="hover:text-text-primary transition-colors">Support</a>
									<a href="#" className="hover:text-text-primary transition-colors">Contact</a>
								</nav>
							</div>
							<div>
								<h4 className="text-xs font-medium text-text-primary mb-2">Legal</h4>
								<nav className="flex flex-col gap-1.5 text-xs text-text-muted">
									<a href="#" className="hover:text-text-primary transition-colors">Privacy Policy</a>
									<a href="#" className="hover:text-text-primary transition-colors">Terms of Service</a>
								</nav>
							</div>
						</>
					)}
				</div>
			</div>
		</footer>
	)
}


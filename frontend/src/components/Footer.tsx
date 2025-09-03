import { useUser } from '../context/UserContext'

export default function Footer(){
	const { user, ready } = useUser()
	const showMarketing = !(ready && user)
	return (
		<footer className="border-t border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
			<div className="w-full px-4 sm:px-6 lg:px-8 py-8">
				<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
					<div className="flex items-center gap-2">
						<img src="/images/dutch_rabbit.svg" alt="oreo.io" className="h-5 w-5" />
						<span className="text-sm font-medium text-slate-600">oreo.io</span>
					</div>
					{showMarketing && (
						<nav className="flex items-center gap-4 text-sm text-slate-600">
							<a href="#features" className="hover:text-slate-900">Features</a>
							<a href="#how" className="hover:text-slate-900">How it works</a>
						</nav>
					)}
					<p className="text-xs text-slate-500">© {new Date().getFullYear()} oreo.io — All rights reserved.</p>
				</div>
			</div>
		</footer>
	)
}


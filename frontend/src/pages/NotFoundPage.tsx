import { Link } from 'react-router-dom'
import { Home, AlertTriangle } from 'lucide-react'

export default function NotFoundPage(){
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-1 animate-fade-in p-6">
      <div className="text-center max-w-lg w-full bg-surface-1/50 backdrop-blur-xl border border-divider rounded-3xl p-12 shadow-2xl shadow-black/5">
        <div className="w-24 h-24 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <AlertTriangle className="w-12 h-12 text-error" />
        </div>
        <h1 className="text-6xl font-bold text-text mb-2 font-display tracking-tighter">404</h1>
        <h2 className="text-2xl font-bold text-text mb-4">Page Not Found</h2>
        <p className="text-text-secondary mb-10 text-lg leading-relaxed">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link 
          to="/dashboard" 
          className="inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-lg shadow-primary/25 transition-all hover:-translate-y-1 hover:shadow-primary/40"
        >
          <Home className="w-5 h-5" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

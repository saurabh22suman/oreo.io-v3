import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function ProjectPlaceholderPage(){
  return (
    <div className="h-[calc(100vh-64px)] flex items-center justify-center animate-fade-in">
      <div className="text-center max-w-md px-6">
        <div className="w-24 h-24 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <img src="/images/oreo_rabbit.png" alt="Work in progress" className="w-16 h-16 object-contain opacity-80" />
        </div>
        <h2 className="text-2xl font-bold text-text mb-2">Building for you</h2>
        <p className="text-text-secondary mb-8">We're working hard on this feature. Check back soon for updates!</p>
        <Link 
          to="/projects" 
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>
      </div>
    </div>
  )
}

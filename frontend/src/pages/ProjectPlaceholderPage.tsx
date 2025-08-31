import { Link } from 'react-router-dom'

export default function ProjectPlaceholderPage(){
  return (
    <div className="h-[calc(100vh-64px)] flex items-start justify-center pt-12">
      <div className="text-center">
        <img src="/images/work_in_progress.png" alt="Work in progress" className="mx-auto w-56 mb-6 mascot-bounce" />
        <h2 className="text-2xl font-semibold">Building for you</h2>
        <p className="mt-2 text-gray-500">We're working on this page. Check back soon.</p>
        <div className="mt-4">
          <Link to="/projects" className="text-indigo-600">Go to projects</Link>
        </div>
      </div>
    </div>
  )
}

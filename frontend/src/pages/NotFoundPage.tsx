import { Link } from 'react-router-dom'

export default function NotFoundPage(){
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-gray-500">Page not found.</p>
        <div className="mt-4">
          <Link to="/dashboard" className="text-indigo-600">Go to dashboard</Link>
        </div>
      </div>
    </div>
  )
}

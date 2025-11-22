import { Navigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, ready } = useUser()

  // Wait for the user context to be ready to avoid flicker
  if (!ready) {
    return null
  }

  // Redirect to landing if not authenticated
  if (!user) {
    return <Navigate to="/landing" replace />
  }

  return <>{children}</>
}

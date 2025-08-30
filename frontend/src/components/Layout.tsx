import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout(){
  // Simplified layout: Navbar at top, outlet below. Per-page sidebars (like Dashboard's) will render themselves.
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1"><Outlet/></main>
    </div>
  )
}

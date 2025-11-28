import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import { useUser } from '../context/UserContext'
import { CollapseProvider, useCollapse } from '../context/CollapseContext'

function InnerLayout() {
  const { user } = useUser()
  const { collapsed } = useCollapse()
  
  return (
    <div className="min-h-screen flex flex-col bg-page text-text font-sans transition-colors duration-300">
      <Navbar />
      <div className="flex flex-1 relative">
        {user && (
          <Sidebar />
        )}

        <main 
          className={`flex-1 p-6 lg:p-8 transition-all duration-300 ${
            user 
              ? (collapsed ? 'ml-16' : 'ml-64') 
              : 'ml-0'
          }`}
        >
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default function Layout() {
  return (
    <CollapseProvider>
      <InnerLayout />
    </CollapseProvider>
  )
}

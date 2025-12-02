import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import { useUser } from '../context/UserContext'
import { CollapseProvider, useCollapse } from '../context/CollapseContext'

function InnerLayout() {
  const { user } = useUser()
  const { collapsed } = useCollapse()
  
  return (
    <div className="min-h-screen flex flex-col bg-surface-1 text-text-primary font-sans">
      <Navbar />
      <div className="flex flex-1">
        {user && <Sidebar />}

        <main 
          className={`
            flex-1 min-h-[calc(100vh-3.5rem)] p-6
            transition-all duration-300 ease-out
            ${user ? (collapsed ? 'ml-[68px]' : 'ml-64') : 'ml-0'}
          `}
        >
          <div className="w-full animate-fade-in">
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

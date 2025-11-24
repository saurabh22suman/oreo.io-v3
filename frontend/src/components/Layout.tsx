import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import { useUser } from '../context/UserContext'
import { CollapseProvider, useCollapse } from '../context/CollapseContext'

function InnerLayout() {
  const { user } = useUser()
  const { collapsed } = useCollapse()
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <div className={`flex-1 ${user ? `layout-with-sidebar ${collapsed ? 'collapsed' : ''}` : ''}`}>
        {user && (
          <Sidebar />
        )}

        <main className={`main flex-1 p-4 lg:p-6 overflow-auto ${user ? '' : 'max-w-full'}`}>
          <div className="max-w-[95%] mx-auto"><Outlet /></div>
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

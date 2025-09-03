import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import Sidebar from './Sidebar'
import { useUser } from '../context/UserContext'
import { CollapseProvider, useCollapse } from '../context/CollapseContext'

function InnerLayout(){
  const { user } = useUser()
  const { collapsed } = useCollapse()
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <div className={`flex-1 ${user ? `layout-with-sidebar ${collapsed ? 'collapsed' : ''}` : ''}`}>
        {user && (
          <Sidebar />
        )}

        <main className={`main flex-1 p-6 lg:p-8 overflow-auto ${user ? '' : 'max-w-full'}`}>
          <div className="max-w-7xl mx-auto"><Outlet/></div>
        </main>
      </div>
      <Footer />
    </div>
  )
}

export default function Layout(){
  return (
    <CollapseProvider>
      <InnerLayout />
    </CollapseProvider>
  )
}

import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import { useUser } from '../context/UserContext'

export default function Layout(){
  const { user } = useUser()
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className={`flex-1 ${user ? 'layout-with-sidebar' : ''}`}>
        {user && (
          <Sidebar />
        )}

        <main className={`main flex-1 p-6 lg:p-8 overflow-auto ${user ? '' : 'max-w-full'}`}>
          <div className="max-w-7xl mx-auto"><Outlet/></div>
        </main>
      </div>
    </div>
  )
}

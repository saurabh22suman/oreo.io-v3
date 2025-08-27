import { NavLink, useNavigate } from 'react-router-dom'

export default function Layout({ children }: { children: React.ReactNode }){
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const navLink = (to: string, label: string) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded-md px-3 py-2 text-sm ${isActive ? 'bg-primary text-white' : 'text-gray-800 hover:bg-gray-100'}`
      }
    >
      {label}
    </NavLink>
  )

  return (
    <div className="min-h-screen grid grid-cols-12">
      <aside className="col-span-12 sm:col-span-3 lg:col-span-2 border-r border-gray-200 bg-white p-3">
        <div className="text-lg font-semibold mb-3">oreo.io</div>
        <nav className="space-y-1">
          {navLink('/', 'Projects')}
          {navLink('/auth', 'Auth')}
          {token && (
            <button
              className="w-full text-left rounded-md px-3 py-2 text-sm text-gray-800 hover:bg-gray-100"
              onClick={() => {
                localStorage.removeItem('token');
                navigate('/auth')
              }}
            >Logout</button>
          )}
        </nav>
      </aside>
      <main className="col-span-12 sm:col-span-9 lg:col-span-10 p-4">{children}</main>
    </div>
  )
}

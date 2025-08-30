import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, BookOpen, Settings, FlaskConical, FolderPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { currentUser } from '../api'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/projects', label: 'Projects', icon: <FolderPlus size={18} /> },
  { to: '/docs', label: 'Docs', icon: <BookOpen size={18} /> },
  { to: '/settings', label: 'Settings', icon: <Settings size={18} /> },
  { to: '/labs', label: 'Labs', icon: <FlaskConical size={18} /> },
]

export default function Sidebar({ collapsed: collapsedProp, setCollapsed: setCollapsedProp }: { collapsed?: boolean; setCollapsed?: (v:boolean)=>void } = {}) {
  const { pathname } = useLocation()
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const collapsed = typeof collapsedProp === 'boolean' ? collapsedProp : internalCollapsed
  const setCollapsed = setCollapsedProp || setInternalCollapsed
  const [user, setUser] = useState<{ email?: string } | null>(null)

  useEffect(() => {
    let mounted = true
    currentUser().then(u => { if (mounted) setUser(u) }).catch(() => { if (mounted) setUser(null) })
    return () => { mounted = false }
  }, [])

  return (
    // use relative/flow layout so the main can resize; parent may still position container as needed
    <aside className={`sidebar p-4 ${collapsed ? 'w-20' : 'w-64'} transition-all`}>
      <div className="flex items-center justify-end px-2">
        <button onClick={() => setCollapsed(!collapsed)} className="text-gray-500 hover:text-indigo-700 p-2 rounded">
          {collapsed ? '›' : '‹'}
        </button>
      </div>

  <nav className="flex-1 px-1 mt-4">
        {items.map(it => (
          <Link key={it.to} to={it.to} className={`flex items-center gap-3 px-3 py-2 text-gray-700 transition ${pathname === it.to ? 'font-semibold border-l-4 border-indigo-700 pl-2' : ''}`}>
            <div className="w-6">{it.icon}</div>
            {!collapsed && <span>{it.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="px-2 pt-4">
        {!collapsed && <div className="text-xs text-gray-400">v0.1.0</div>}
      </div>
    </aside>
  )
}

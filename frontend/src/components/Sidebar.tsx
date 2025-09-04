import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, BookOpen, Settings, FlaskConical, FolderPlus, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { currentUser, getInboxUnreadCount, subscribeNotifications } from '../api'
import { useCollapse } from '../context/CollapseContext'

const itemsBase = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/projects', label: 'Projects', icon: <FolderPlus size={18} /> },
  { to: '/inbox', label: 'Inbox', icon: <Mail size={18} /> },
  { to: '/docs', label: 'Docs', icon: <BookOpen size={18} /> },
  { to: '/settings', label: 'Settings', icon: <Settings size={18} /> },
  { to: '/labs', label: 'Labs', icon: <FlaskConical size={18} /> },
] as const

export default function Sidebar({ collapsed: collapsedProp, setCollapsed: setCollapsedProp }: { collapsed?: boolean; setCollapsed?: (v:boolean)=>void } = {}) {
  const { pathname } = useLocation()
  const { collapsed: ctxCollapsed, setCollapsed: ctxSetCollapsed } = useCollapse() as any
  const collapsed = typeof collapsedProp === 'boolean' ? collapsedProp : ctxCollapsed
  const setCollapsed = setCollapsedProp || ctxSetCollapsed
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let mounted = true
    currentUser().then(u => { if (mounted) setUser(u) }).catch(() => { if (mounted) setUser(null) })
    // initial fetch
    const load = async()=>{ try{ const c = await getInboxUnreadCount(); if(mounted) setUnread(c) }catch{} }
    load()
    // subscribe to SSE for realtime updates
    const unsubscribe = subscribeNotifications((evt) => {
      if(!mounted) return
      if(evt?.type === 'unread_count' && typeof evt.count === 'number'){
        setUnread(Number(evt.count))
      }
    })
    return () => { mounted = false; unsubscribe() }
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
        {itemsBase.map(it => {
          const isInbox = it.to === '/inbox'
          const isDocs = it.to === '/docs'
          return (
            isDocs ? (
              <a key={it.to} href={it.to} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-between px-3 py-2 text-gray-700 transition`}>
                <div className="flex items-center gap-3">
                  <div className="w-6">{it.icon}</div>
                  {!collapsed && <span>{it.label}</span>}
                </div>
              </a>
            ) : (
              <Link key={it.to} to={it.to} className={`flex items-center justify-between px-3 py-2 text-gray-700 transition ${pathname === it.to ? 'font-semibold border-l-4 border-indigo-700 pl-2' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-6">{it.icon}</div>
                  {!collapsed && <span>{it.label}</span>}
                </div>
                {isInbox && unread > 0 && <span className="badge-pill bg-indigo-600 text-white text-xxs px-2 py-0.5 ml-2">{unread > 99 ? '99+' : unread}</span>}
              </Link>
            )
          )
        })}
      </nav>

      <div className="px-2 pt-4">
        {!collapsed && <div className="text-xs text-gray-400">v0.1.0</div>}
      </div>
    </aside>
  )
}

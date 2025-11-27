import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FolderPlus, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { currentUser, getInboxUnreadCount, subscribeNotifications } from '../api'
import { useCollapse } from '../context/CollapseContext'

const itemsBase = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/projects', label: 'Projects', icon: <FolderPlus size={18} /> },
  { to: '/inbox', label: 'Inbox', icon: <Mail size={18} /> },
] as const

export default function Sidebar({ collapsed: collapsedProp, setCollapsed: setCollapsedProp }: { collapsed?: boolean; setCollapsed?: (v: boolean) => void } = {}) {
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
    const load = async () => { try { const c = await getInboxUnreadCount(); if (mounted) setUnread(c) } catch { } }
    load()
    // subscribe to SSE for realtime updates
    const unsubscribe = subscribeNotifications((evt) => {
      if (!mounted) return
      if (evt?.type === 'unread_count' && typeof evt.count === 'number') {
        setUnread(Number(evt.count))
      }
    })
    return () => { mounted = false; unsubscribe() }
  }, [])

  return (
    <aside className={`sidebar flex flex-col p-4 ${collapsed ? 'w-20' : 'w-64'} transition-all duration-300 ease-in-out bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-r border-slate-200/50 dark:border-slate-700/50`}>
      {/* Logo/Brand Section */}
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-2 mb-6`}>
        <div className="flex items-center gap-2">
          <img src="/images/oreo_rabbit.png" alt="oreo.io" className="h-8 w-8 object-contain" />
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all duration-200 hover:scale-105 ${collapsed ? 'hidden' : ''}`}
        >
          ‹
        </button>
        {collapsed && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-8 p-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-400 hover:text-primary transition-colors"
          >
            ›
          </button>
        )}
      </div>

      <nav className="flex-1 px-1 space-y-1">
        {itemsBase.map(it => {
          const isInbox = it.to === '/inbox'
          const isActive = pathname === it.to

          const content = (
            <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
              <div className={`${isActive ? 'text-primary' : 'text-slate-500 dark:text-slate-400'}`}>{it.icon}</div>
              {!collapsed && <span className="font-medium">{it.label}</span>}
            </div>
          )

          const className = `relative flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group
            ${isActive
              ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 text-primary border border-blue-200/50 dark:border-blue-700/50 shadow-sm'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100'
            }`

          return (
            <Link key={it.to} to={it.to} className={className}>
              {content}
              {isInbox && unread > 0 && !collapsed && (
                <span className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg shadow-rose-500/30">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
              {isInbox && unread > 0 && collapsed && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full shadow-lg shadow-rose-500/50"></div>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto px-2 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
        {!collapsed && (
          <div className="text-xs text-slate-400 px-3 py-2 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 text-center">
            v0.3.1
          </div>
        )}
      </div>
    </aside>
  )
}

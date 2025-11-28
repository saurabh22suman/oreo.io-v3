import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FolderPlus, Mail, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { currentUser, getInboxUnreadCount, subscribeNotifications } from '../api'
import { useCollapse } from '../context/CollapseContext'

const itemsBase = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { to: '/projects', label: 'Projects', icon: <FolderPlus size={20} /> },
  { to: '/inbox', label: 'Inbox', icon: <Mail size={20} /> },
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
    <aside 
      className={`fixed left-0 top-16 bottom-0 z-40 flex flex-col bg-surface-1 border-r border-divider transition-all duration-300 ease-in-out ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 p-1 rounded-full bg-surface-1 border border-divider text-text-secondary hover:text-primary transition-colors shadow-sm z-50"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <nav className="flex-1 px-3 py-6 space-y-1">
        {itemsBase.map(it => {
          const isInbox = it.to === '/inbox'
          const isActive = pathname === it.to

          return (
            <Link 
              key={it.to} 
              to={it.to} 
              className={`
                relative flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group
                ${isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-text-secondary hover:bg-surface-2 hover:text-text'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? it.label : undefined}
            >
              <div className={`${isActive ? 'text-primary' : 'text-text-secondary group-hover:text-text'}`}>
                {it.icon}
              </div>
              
              {!collapsed && (
                <span className="truncate">{it.label}</span>
              )}

              {/* Unread Badge */}
              {isInbox && unread > 0 && (
                <div className={`
                  absolute flex items-center justify-center bg-danger text-white font-bold rounded-full shadow-sm
                  ${collapsed 
                    ? 'top-2 right-2 w-2.5 h-2.5 p-0' 
                    : 'right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs'
                  }
                `}>
                  {!collapsed && (unread > 99 ? '99+' : unread)}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-divider">
        {!collapsed ? (
          <div className="text-xs text-text-muted text-center">
            v0.3.1
          </div>
        ) : (
          <div className="w-full h-1 bg-divider/50 rounded-full" />
        )}
      </div>
    </aside>
  )
}

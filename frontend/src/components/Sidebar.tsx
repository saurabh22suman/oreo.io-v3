import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, Inbox, ChevronLeft, ChevronRight, Settings, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { currentUser, getInboxUnreadCount, subscribeNotifications } from '../api'
import { useCollapse } from '../context/CollapseContext'

const navItems = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard, description: 'Overview' },
  { to: '/projects', label: 'Projects', icon: FolderKanban, description: 'Your workspaces' },
  { to: '/inbox', label: 'Inbox', icon: Inbox, showBadge: true, description: 'Notifications' },
] as const

const bottomItems = [
  { to: '/settings', label: 'Settings', icon: Settings, description: 'Preferences' },
] as const

export default function Sidebar({ collapsed: collapsedProp, setCollapsed: setCollapsedProp }: { collapsed?: boolean; setCollapsed?: (v: boolean) => void } = {}) {
  const { pathname } = useLocation()
  const { collapsed: ctxCollapsed, setCollapsed: ctxSetCollapsed } = useCollapse() as any
  const collapsed = typeof collapsedProp === 'boolean' ? collapsedProp : ctxCollapsed
  const setCollapsed = setCollapsedProp || ctxSetCollapsed
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let mounted = true
    
    // Initial fetch
    const load = async () => { 
      try { 
        const c = await getInboxUnreadCount()
        if (mounted) setUnread(c) 
      } catch { } 
    }
    load()
    
    // Subscribe to SSE for realtime updates
    const unsubscribe = subscribeNotifications((evt) => {
      if (!mounted) return
      if (evt?.type === 'unread_count' && typeof evt.count === 'number') {
        setUnread(Number(evt.count))
      }
    })
    return () => { mounted = false; unsubscribe() }
  }, [])

  const NavItem = ({ item, showBadge = false }: { item: typeof navItems[number] | typeof bottomItems[number], showBadge?: boolean }) => {
    const Icon = item.icon
    const isActive = pathname === item.to || (item.to !== '/dashboard' && pathname.startsWith(item.to))
    const hasBadge = showBadge && 'showBadge' in item && item.showBadge && unread > 0

    return (
      <Link 
        to={item.to} 
        className={`
          group relative flex items-center rounded-xl transition-all duration-200
          ${collapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'}
          ${isActive 
            ? 'bg-gradient-to-r from-primary/15 to-primary/5 text-primary shadow-sm' 
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-3'
          }
        `}
        title={collapsed ? item.label : undefined}
      >
        {/* Active indicator bar */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
        )}
        
        <div className={`relative flex items-center justify-center ${collapsed ? '' : ''}`}>
          <Icon 
            size={20} 
            className={`transition-all duration-200 ${isActive ? 'text-primary' : 'group-hover:scale-110'}`} 
            strokeWidth={isActive ? 2.5 : 2}
          />
          
          {/* Collapsed badge */}
          {hasBadge && collapsed && (
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full ring-2 ring-surface-1 animate-pulse" />
          )}
        </div>
        
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className={`font-medium text-sm ${isActive ? 'text-primary' : ''}`}>{item.label}</span>
              {/* Expanded badge */}
              {hasBadge && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-primary text-white rounded-full">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </div>
            {'description' in item && (
              <span className="text-xs text-text-muted truncate block">{item.description}</span>
            )}
          </div>
        )}
      </Link>
    )
  }

  return (
    <aside 
      className={`
        fixed left-0 top-14 bottom-0 z-40 
        flex flex-col
        bg-surface-1
        transition-all duration-300 ease-out
        ${collapsed ? 'w-[68px]' : 'w-64'}
      `}
    >
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-primary/[0.02] pointer-events-none" />
      
      {/* Border with gradient */}
      <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-divider via-divider to-transparent" />
      
      {/* Toggle Button - Modern pill style */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`
          absolute -right-3 top-8 z-50
          w-6 h-6 rounded-full
          bg-surface-2 border border-divider
          text-text-secondary hover:text-primary
          hover:bg-surface-3 hover:border-primary/30
          shadow-md hover:shadow-lg
          transition-all duration-200
          flex items-center justify-center
        `}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1.5 relative">
        {navItems.map(item => (
          <NavItem key={item.to} item={item} showBadge={'showBadge' in item && item.showBadge} />
        ))}
      </nav>

      {/* Divider with fade effect */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-divider to-transparent" />

      {/* Bottom Section */}
      <div className="p-3 space-y-1.5 relative">
        {bottomItems.map(item => (
          <NavItem key={item.to} item={item} />
        ))}
        
        {/* Version badge */}
        {!collapsed && (
          <div className="px-4 py-3 mt-2">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Sparkles size={12} className="text-primary" />
              <span>Oreo v0.3.1</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InboxItem, listInbox, markInboxRead, markInboxUnread, deleteInboxMessages } from '../api'
import { Check, Mail, MailOpen, Trash2, RefreshCw, Filter, ChevronLeft, ChevronRight, Bell, Inbox } from 'lucide-react'

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string>('')
  const [limit, setLimit] = useState(20)
  const [offset, setOffset] = useState(0)
  const navigate = useNavigate()

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k)), [selected])

  async function load() {
    setLoading(true)
    try {
      const res = await listInbox(filter, limit, offset)
      setItems(res.items)
      setTotal(res.total || 0)
      setError('')
    } catch (e: any) { setError(e?.message || 'Failed to load inbox') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filter, limit, offset])

  function toggle(id: number) { setSelected(s => ({ ...s, [id]: !s[id] })) }
  function selectAll() { const all: Record<number, boolean> = {}; items.forEach(i => all[i.id] = true); setSelected(all) }
  function clearSel() { setSelected({}) }

  async function markRead() { if (selectedIds.length === 0) return; await markInboxRead(selectedIds); clearSel(); await load() }
  async function markUnread() { if (selectedIds.length === 0) return; await markInboxUnread(selectedIds); clearSel(); await load() }
  async function deleteMsgs() { if (selectedIds.length === 0) return; await deleteInboxMessages(selectedIds); clearSel(); await load() }

  // Mark a single item as read and optimistically update state
  async function markOneRead(id: number) {
    try {
      await markInboxRead([id])
      setItems(prev => prev.map(it => it.id === id ? { ...it, is_read: true } : it))
    } catch { }
  }

  function itemLinkTarget(it: InboxItem) {
    const type = it?.metadata?.type
    if (type === 'project_member_added') {
      const pid = it?.metadata?.project_id; if (pid) return `/projects/${pid}`
    }
    if (type === 'reviewer_assigned') {
      const pid = it?.metadata?.project_id; const cid = it?.metadata?.change_request_id; if (pid && cid) return `/projects/${pid}/datasets/${it?.metadata?.dataset_id || ''}/changes/${cid}`
    }
    if (type === 'change_approved') {
      const pid = it?.metadata?.project_id; const ds = it?.metadata?.dataset_id; const cid = it?.metadata?.change_request_id; if (pid && ds && cid) return `/projects/${pid}/datasets/${ds}/changes/${cid}`
    }
    if (type === 'append_completed') {
      const pid = it?.metadata?.project_id; const ds = it?.metadata?.dataset_id; const cid = it?.metadata?.change_request_id
      // Prefer linking to the specific change details; fallback to dataset details if CID missing
      if (pid && ds && cid) return `/projects/${pid}/datasets/${ds}/changes/${cid}`
      if (pid && ds) return `/projects/${pid}/datasets/${ds}`
    }
    return undefined
  }

  const page = Math.floor(offset / limit) + 1
  const hasNext = total ? offset + limit < total : items.length === limit
  const nextPage = () => { if (hasNext) setOffset(o => o + limit) }
  const prevPage = () => setOffset(o => Math.max(0, o - limit))
  const resetPage = () => setOffset(0)

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-surface-1/80 backdrop-blur-xl border border-divider p-8 shadow-2xl shadow-black/5">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-xs font-bold border border-primary/20 text-primary shadow-sm">
                Notifications
              </span>
            </div>
            <h1 className="text-4xl font-bold mb-4 tracking-tight text-text font-display drop-shadow-sm">Inbox</h1>
            <p className="text-text-secondary max-w-lg text-base leading-relaxed">
              Stay updated with project activities, approvals, and team mentions.
            </p>
          </div>
        </div>
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-surface-1/50 p-2 rounded-2xl border border-divider backdrop-blur-sm">
        <div className="flex items-center gap-1 bg-surface-2/50 p-1 rounded-xl border border-divider">
          <button
            onClick={() => { setFilter('all'); resetPage() }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'all' ? 'bg-surface-1 text-primary shadow-sm border border-divider' : 'text-text-secondary hover:text-text hover:bg-surface-1/50'}`}
          >
            All
          </button>
          <button
            onClick={() => { setFilter('unread'); resetPage() }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'unread' ? 'bg-surface-1 text-primary shadow-sm border border-divider' : 'text-text-secondary hover:text-text hover:bg-surface-1/50'}`}
          >
            Unread
          </button>
          <button
            onClick={() => { setFilter('read'); resetPage() }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'read' ? 'bg-surface-1 text-primary shadow-sm border border-divider' : 'text-text-secondary hover:text-text hover:bg-surface-1/50'}`}
          >
            Read
          </button>
        </div>

        <div className="flex items-center gap-2 px-2">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 mr-4 animate-fade-in bg-surface-2/50 px-3 py-1.5 rounded-lg border border-divider">
              <span className="text-xs font-bold text-text-secondary">{selectedIds.length} selected</span>
              <div className="h-4 w-px bg-divider mx-1" />
              <button onClick={markRead} className="p-1.5 hover:bg-surface-3 rounded-md text-text-secondary hover:text-primary transition-colors" title="Mark as Read">
                <MailOpen className="w-4 h-4" />
              </button>
              <button onClick={markUnread} className="p-1.5 hover:bg-surface-3 rounded-md text-text-secondary hover:text-primary transition-colors" title="Mark as Unread">
                <Mail className="w-4 h-4" />
              </button>
              <button onClick={deleteMsgs} className="p-1.5 hover:bg-surface-3 rounded-md text-text-secondary hover:text-danger transition-colors" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <button onClick={load} className="p-2 hover:bg-surface-2 rounded-xl text-text-secondary hover:text-primary transition-colors border border-transparent hover:border-divider">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Inbox List */}
      <div className="bg-surface-1 border border-divider rounded-2xl overflow-hidden shadow-xl shadow-black/5">
        <div className="p-4 border-b border-divider flex items-center gap-4 bg-surface-2/30 backdrop-blur-sm">
          <input
            type="checkbox"
            className="rounded border-divider text-primary focus:ring-primary bg-surface-1 w-4 h-4 cursor-pointer"
            onChange={(e) => e.target.checked ? selectAll() : clearSel()}
            checked={items.length > 0 && items.every(i => selected[i.id])}
          />
          <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Message</span>
        </div>

        {loading && items.length === 0 ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-6 text-text-muted shadow-inner">
              <Inbox className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-text mb-2">All caught up!</h3>
            <p className="text-text-secondary max-w-xs mx-auto">No messages in your inbox right now. Check back later for updates.</p>
          </div>
        ) : (
          <div className="divide-y divide-divider">
            {items.map(item => {
              const link = itemLinkTarget(item)
              return (
                <div 
                  key={item.id} 
                  className={`group flex items-start gap-4 p-5 hover:bg-surface-2/50 transition-all duration-200 ${!item.is_read ? 'bg-primary/5 hover:bg-primary/10' : ''}`}
                >
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      className="rounded border-divider text-primary focus:ring-primary bg-surface-1 w-4 h-4 cursor-pointer"
                      checked={!!selected[item.id]}
                      onChange={() => toggle(item.id)}
                    />
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                    if (!item.is_read) markOneRead(item.id)
                    if (link) navigate(link)
                  }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {!item.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        )}
                        <h4 className={`text-sm font-bold ${!item.is_read ? 'text-primary' : 'text-text'}`}>
                          {item.metadata?.title || 'Notification'}
                        </h4>
                      </div>
                      <span className="text-xs text-text-muted whitespace-nowrap ml-2 font-mono">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={`text-sm ${!item.is_read ? 'text-text font-medium' : 'text-text-secondary'} line-clamp-2 leading-relaxed`}>
                      {item.message}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        {/* Pagination */}
        {total > limit && (
          <div className="p-4 border-t border-divider flex items-center justify-between bg-surface-2/30 backdrop-blur-sm">
            <span className="text-xs font-medium text-text-secondary">
              Showing <span className="text-text font-bold">{offset + 1}-{Math.min(offset + limit, total)}</span> of <span className="text-text font-bold">{total}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={prevPage}
                disabled={offset === 0}
                className="p-2 rounded-lg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary hover:text-text transition-colors border border-transparent hover:border-divider"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextPage}
                disabled={!hasNext}
                className="p-2 rounded-lg hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary hover:text-text transition-colors border border-transparent hover:border-divider"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

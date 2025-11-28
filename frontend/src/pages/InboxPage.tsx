import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InboxItem, listInbox, markInboxRead, markInboxUnread, deleteInboxMessages } from '../api'
import { Mail, MailOpen, Trash2, RefreshCw, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string>('')
  const [limit] = useState(20)
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
      if (pid && ds && cid) return `/projects/${pid}/datasets/${ds}/changes/${cid}`
      if (pid && ds) return `/projects/${pid}/datasets/${ds}`
    }
    return undefined
  }

  const hasNext = total ? offset + limit < total : items.length === limit
  const nextPage = () => { if (hasNext) setOffset(o => o + limit) }
  const prevPage = () => setOffset(o => Math.max(0, o - limit))
  const resetPage = () => setOffset(0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary mb-1">Inbox</h1>
          <p className="text-sm text-text-secondary">Stay updated with notifications and approvals</p>
        </div>
        <button 
          onClick={load} 
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Filter Tabs */}
        <div className="flex items-center bg-surface-2 rounded-lg p-0.5 border border-divider">
          {(['all', 'unread', 'read'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); resetPage() }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize
                ${filter === f ? 'bg-surface-3 text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Bulk Actions */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 bg-surface-2 px-3 py-1.5 rounded-lg border border-divider animate-fade-in">
            <span className="text-xs font-medium text-text-secondary">{selectedIds.length} selected</span>
            <div className="h-4 w-px bg-divider mx-1" />
            <button onClick={markRead} className="p-1.5 hover:bg-surface-3 rounded text-text-secondary hover:text-primary transition-colors" title="Mark as Read">
              <MailOpen size={14} />
            </button>
            <button onClick={markUnread} className="p-1.5 hover:bg-surface-3 rounded text-text-secondary hover:text-primary transition-colors" title="Mark as Unread">
              <Mail size={14} />
            </button>
            <button onClick={deleteMsgs} className="p-1.5 hover:bg-surface-3 rounded text-text-secondary hover:text-danger transition-colors" title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Inbox List */}
      <div className="bg-surface-2 border border-divider rounded-card overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-divider flex items-center gap-3 bg-surface-3/30">
          <input
            type="checkbox"
            className="rounded border-divider text-primary focus:ring-primary bg-surface-1 w-4 h-4 cursor-pointer"
            onChange={(e) => e.target.checked ? selectAll() : clearSel()}
            checked={items.length > 0 && items.every(i => selected[i.id])}
          />
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Messages</span>
        </div>

        {loading && items.length === 0 ? (
          <div className="p-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center mx-auto mb-4">
              <Inbox size={24} className="text-text-muted" />
            </div>
            <h3 className="font-medium text-text-primary mb-1">All caught up!</h3>
            <p className="text-sm text-text-secondary">No messages right now</p>
          </div>
        ) : (
          <div className="divide-y divide-divider">
            {items.map(item => {
              const link = itemLinkTarget(item)
              return (
                <div 
                  key={item.id} 
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-3/50 transition-colors ${!item.is_read ? 'bg-primary/5' : ''}`}
                >
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      className="rounded border-divider text-primary focus:ring-primary bg-surface-1 w-4 h-4 cursor-pointer"
                      checked={!!selected[item.id]}
                      onChange={() => toggle(item.id)}
                    />
                  </div>
                  <div 
                    className="flex-1 min-w-0 cursor-pointer" 
                    onClick={() => {
                      if (!item.is_read) markOneRead(item.id)
                      if (link) navigate(link)
                    }}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2">
                        {!item.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary" />
                        )}
                        <h4 className={`text-sm font-medium truncate ${!item.is_read ? 'text-text-primary' : 'text-text-secondary'}`}>
                          {item.metadata?.title || 'Notification'}
                        </h4>
                      </div>
                      <span className="text-xs text-text-muted ml-2 flex-shrink-0">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={`text-sm line-clamp-1 ${!item.is_read ? 'text-text-secondary' : 'text-text-muted'}`}>
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
          <div className="px-4 py-3 border-t border-divider flex items-center justify-between bg-surface-3/30">
            <span className="text-xs text-text-muted">
              {offset + 1}-{Math.min(offset + limit, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={prevPage}
                disabled={offset === 0}
                className="p-1.5 rounded hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary hover:text-text-primary transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={nextPage}
                disabled={!hasNext}
                className="p-1.5 rounded hover:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed text-text-secondary hover:text-text-primary transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

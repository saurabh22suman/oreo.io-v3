import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InboxItem, listInbox, markInboxRead, markInboxUnread, deleteInboxMessages } from '../api'
import Card from '../components/Card'
import { Check, Mail, MailOpen, Trash2, RefreshCw, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section with Mascot */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl shadow-slate-900/20">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold border border-white/10 text-blue-200">
                Notifications
              </span>
            </div>
            <h1 className="text-4xl font-bold mb-3 tracking-tight">Inbox</h1>
            <p className="text-slate-300 max-w-md text-sm leading-relaxed">
              Stay updated with project activities, approvals, and team mentions.
            </p>
          </div>

          {/* Mascot Image */}
          <div className="hidden md:block relative w-48 h-48 -mr-4 -mb-8">
            <img
              src="/images/oreo_rabbit.png"
              alt="Oreo Mascot"
              className="w-full h-full object-contain drop-shadow-2xl transform hover:scale-105 transition-transform duration-500 opacity-90"
            />
          </div>
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl">
            <button
              onClick={() => { setFilter('all'); resetPage() }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              All
            </button>
            <button
              onClick={() => { setFilter('unread'); resetPage() }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${filter === 'unread' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              Unread
            </button>
            <button
              onClick={() => { setFilter('read'); resetPage() }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${filter === 'read' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              Read
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={markRead}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <MailOpen className="w-4 h-4" />
                Mark Read
              </button>
              <button
                onClick={markUnread}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Mail className="w-4 h-4" />
                Mark Unread
              </button>
              <button
                onClick={deleteMsgs}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
            </>
          )}

          <button
            onClick={selectAll}
            className="text-sm font-medium text-slate-500 hover:text-primary transition-colors"
          >
            Select All
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={clearSel}
              className="text-sm font-medium text-slate-500 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Inbox List */}
      <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none">
        {loading && items.length === 0 ? (
          <div className="p-12 text-center text-slate-500">Loading messages...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">All caught up!</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              Your inbox is empty. You'll get notified when you're added to a project or assigned tasks.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {items.map(it => {
              const href = itemLinkTarget(it)
              const clickable = !!href
              return (
                <div
                  key={it.id}
                  className={`group flex items-start gap-4 p-4 transition-all duration-200
                    ${!it.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'bg-white dark:bg-slate-800/50'}
                    ${clickable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : ''}
                  `}
                  onClick={async () => { if (clickable) { await markOneRead(it.id); navigate(href!) } }}
                >
                  <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!!selected[it.id]}
                      onChange={() => toggle(it.id)}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {!it.is_read && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              New
                            </span>
                          )}
                          {it.metadata?.project_name && (
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              {it.metadata.project_name}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${!it.is_read ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                          {it.message}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {new Date(it.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {total > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
            <div className="text-xs text-slate-500">
              Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={prevPage}
                disabled={offset === 0}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 disabled:opacity-50 disabled:hover:bg-transparent transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextPage}
                disabled={!hasNext}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-slate-200 dark:hover:border-slate-600 disabled:opacity-50 disabled:hover:bg-transparent transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InboxItem, listInbox, markInboxRead, markInboxUnread } from '../api'

export default function InboxPage(){
  const [items, setItems] = useState<InboxItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'unread'|'read'>('all')
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string>('')
  const [limit, setLimit] = useState(20)
  const [offset, setOffset] = useState(0)
  const nav = useNavigate()

  const selectedIds = useMemo(()=> Object.entries(selected).filter(([,v])=>v).map(([k])=>Number(k)), [selected])

  async function load(){
    setLoading(true)
    try{
  const res = await listInbox(filter, limit, offset)
  setItems(res.items)
  setTotal(res.total || 0)
      setError('')
    }catch(e:any){ setError(e?.message || 'Failed to load inbox') }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ load() }, [filter, limit, offset])

  function toggle(id: number){ setSelected(s => ({...s, [id]: !s[id]})) }
  function selectAll(){ const all: Record<number, boolean> = {}; items.forEach(i => all[i.id] = true); setSelected(all) }
  function clearSel(){ setSelected({}) }

  async function markRead(){ if(selectedIds.length === 0) return; await markInboxRead(selectedIds); clearSel(); await load() }
  async function markUnread(){ if(selectedIds.length === 0) return; await markInboxUnread(selectedIds); clearSel(); await load() }

  // Mark a single item as read and optimistically update state
  async function markOneRead(id: number){
    try{
      await markInboxRead([id])
      setItems(prev => prev.map(it => it.id === id ? { ...it, is_read: true } : it))
    }catch{}
  }

  function itemLinkTarget(it: InboxItem){
    const type = it?.metadata?.type
    if(type === 'project_member_added'){
      const pid = it?.metadata?.project_id; if(pid) return `/projects/${pid}`
    }
    if(type === 'reviewer_assigned'){
      const pid = it?.metadata?.project_id; const cid = it?.metadata?.change_request_id; if(pid && cid) return `/projects/${pid}/datasets/${it?.metadata?.dataset_id || ''}/changes/${cid}`
    }
    if(type === 'change_approved'){
      const pid = it?.metadata?.project_id; const ds = it?.metadata?.dataset_id; const cid = it?.metadata?.change_request_id; if(pid && ds && cid) return `/projects/${pid}/datasets/${ds}/changes/${cid}`
    }
    return undefined
  }

  const page = Math.floor(offset / limit) + 1
  const hasNext = total ? offset + limit < total : items.length === limit
  const nextPage = () => { if(hasNext) setOffset(o => o + limit) }
  const prevPage = () => setOffset(o => Math.max(0, o - limit))
  const resetPage = () => setOffset(0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={e=>{ setFilter(e.target.value as any); resetPage() }} className="border px-2 py-1 text-sm" aria-label="Filter messages">
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
          <select value={limit} onChange={e=>{ setLimit(Number(e.target.value)); resetPage() }} className="border px-2 py-1 text-sm" aria-label="Page size">
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <button className="border px-2 py-1 text-sm" onClick={load} disabled={loading}>Refresh</button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button className="border px-2 py-1 text-sm" onClick={selectAll}>Select all</button>
  <button className="border px-2 py-1 text-sm" onClick={clearSel}>Clear</button>
  <button className="border px-2 py-1 text-sm" onClick={async()=>{ try{ const ids = items.filter(i=>!i.is_read).map(i=>i.id); if(ids.length){ await markInboxRead(ids); await load() } }catch(e:any){ setError(e?.message||'Failed to clear') } }}>Mark all read</button>
        <div className="ml-4"/>
        <button className="bg-indigo-600 text-white px-3 py-1.5 text-sm rounded disabled:opacity-50" disabled={selectedIds.length===0} onClick={markRead}>Mark read</button>
        <button className="border px-3 py-1.5 text-sm rounded disabled:opacity-50" disabled={selectedIds.length===0} onClick={markUnread}>Mark unread</button>
      </div>

      {error && <div className="mt-4 text-sm text-red-600" role="alert">{error}</div>}

      <div className="mt-4 bg-white dark:bg-slate-900 rounded border divide-y">
        {loading && <div className="p-4 text-sm text-gray-500">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">Your inbox is quiet.</div>
            <div className="text-xs text-gray-500 mt-1">You’ll get notified when you’re added to a project or assigned as a reviewer.</div>
          </div>
        )}
        {items.map(it => {
          const href = itemLinkTarget(it)
          const clickable = !!href
          return (
            <div
              key={it.id}
              className={`flex items-start gap-3 p-4 ${!it.is_read ? 'bg-indigo-50/60 dark:bg-slate-800/40' : ''} ${clickable ? 'cursor-pointer hover:bg-indigo-50/80 dark:hover:bg-slate-800/60' : ''}`}
              onClick={async()=>{ if(clickable){ await markOneRead(it.id); nav(href!) } }}
              role={clickable ? 'button' : 'listitem'}
              tabIndex={clickable ? 0 : -1}
              onKeyDown={async(e)=>{ if(clickable && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); await markOneRead(it.id); nav(href!) } }}
            >
              <input type="checkbox" className="mt-1" checked={!!selected[it.id]} onChange={(e)=>{ e.stopPropagation(); toggle(it.id) }} aria-label="Select message" onClick={(e)=> e.stopPropagation()} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {!it.is_read && <span className="badge-pill bg-indigo-600 text-white text-xxs px-2 py-0.5">New</span>}
                    <span className="text-sm">{it.message}</span>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(it.created_at).toLocaleString()}</span>
                </div>
                {it.metadata?.project_name && <div className="text-xs text-gray-500 mt-1">{it.metadata.project_name}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination controls */}
      <div className="mt-4 flex items-center justify-between">
  <div className="text-xs text-gray-500">Page {page}{total ? ` · ${total} total` : ''}</div>
        <div className="flex items-center gap-2">
          <button className="border px-2 py-1 text-sm rounded disabled:opacity-50" onClick={prevPage} disabled={offset === 0}>Previous</button>
          <button className="border px-2 py-1 text-sm rounded disabled:opacity-50" onClick={nextPage} disabled={!hasNext}>Next</button>
        </div>
      </div>
    </div>
  )
}

import React, { useRef, useState, useEffect, useMemo } from 'react'
import { listMembers, upsertMember, removeMember, myProjectRole } from '../api'

function initialsFromEmail(email?: string){
  if(!email) return 'U'
  const name = email.split('@')[0]
  const parts = name.split(/\.|_|-|\+/).filter(Boolean)
  if(parts.length === 0) return email.charAt(0).toUpperCase()
  if(parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length-1].charAt(0)).toUpperCase()
}

export default function MembersPopover({ projectId, initialMembers, myRole }: { projectId: number; initialMembers?: Array<any>; myRole?: string }){
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name'|'role'>('name')
  const [members, setMembers] = useState<Array<any>>(initialMembers || [])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'owner'|'contributor'|'viewer'|'editor'>('viewer')
  const [loadingMembers, setLoadingMembers] = useState(false)

  useEffect(() => {
    function onDoc(e: MouseEvent){ if(ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  },[])

  const list = (members || []) as Array<any>

  const roles = useMemo(() => {
    const s = new Set<string>()
    list.forEach(m => { if(m.role) s.add(m.role) })
    return Array.from(s)
  }, [list])

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return list.filter(m => {
      if(roleFilter !== 'all' && (m.role || '') !== roleFilter) return false
      if(!qq) return true
      const email = (m.email || m.user_email || '').toLowerCase()
      return email.includes(qq)
    }).sort((a,b) => {
      if(sortBy === 'role') return (a.role||'').localeCompare(b.role||'')
      const aa = (a.email || a.user_email || '').toLowerCase()
      const bb = (b.email || b.user_email || '').toLowerCase()
      return aa.localeCompare(bb)
    })
  }, [list, q, roleFilter, sortBy])

  const label = list.length === 0 ? 'No members' : (list.length === 1 ? (list[0].email || list[0].user_email || 'member') : `${list.length} members`)

  useEffect(() => {
    // refresh members when popover opens
    if(!open) return
    let cancelled = false
    async function fetchMembers(){
      setLoadingMembers(true)
      try{
        const data = await listMembers(projectId)
        if(!cancelled) setMembers(data || [])
      }catch(e){
        console.warn('listMembers failed', e)
      }finally{ setLoadingMembers(false) }
    }
    fetchMembers()
    return () => { cancelled = true }
  }, [open, projectId])

  function colorFromEmail(email?: string){
    const colors = ['bg-indigo-100 text-indigo-700','bg-emerald-100 text-emerald-700','bg-rose-100 text-rose-700','bg-amber-100 text-amber-700','bg-sky-100 text-sky-700','bg-violet-100 text-violet-700']
    if(!email) return colors[0]
    let h = 0
    for(let i=0;i<email.length;i++) h = (h*31 + email.charCodeAt(i)) >>> 0
    return colors[h % colors.length]
  }

  async function handleInvite(){
    if(!inviteEmail) return
    try{
      await upsertMember(projectId, inviteEmail, inviteRole)
      // refresh
      const data = await listMembers(projectId)
      setMembers(data || [])
      setInviteEmail('')
    }catch(e:any){
      console.error('invite failed', e)
      alert(e?.message || 'Invite failed')
    }
  }

  async function handleRemove(userId: number){
    if(!confirm('Remove member?')) return
    try{
      await removeMember(projectId, userId)
      setMembers(prev => prev.filter(m => m.user_id !== userId))
    }catch(e:any){ console.error('remove failed', e); alert(e?.message || 'Remove failed') }
  }

  async function handleChangeRole(userId: number, role: string){
    try{
      const m = members.find(x => x.user_id === userId)
      if(!m) return
      await upsertMember(projectId, m.email, role as any)
      const data = await listMembers(projectId)
      setMembers(data || [])
    }catch(e:any){ console.error('change role failed', e); alert(e?.message || 'Change role failed') }
  }

  return (
    <div className="relative inline-block text-right" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="text-sm text-indigo-700 px-3 py-1 border border-indigo-100 rounded hover:bg-indigo-50">{label}</button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 shadow-lg z-50 rounded">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-slate-700">Project members</div>
              <div className="text-xs text-slate-400">{list.length} total</div>
            </div>

            <div className="flex gap-2 mb-2">
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by email" className="flex-1 px-2 py-1 border rounded text-sm" />
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="text-sm px-2 py-1 border rounded">
                <option value="all">All roles</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <div>Showing {filtered.length}</div>
              <div className="flex items-center gap-2">
                <label className="text-xs">Sort</label>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="text-sm px-2 py-1 border rounded">
                  <option value="name">Name</option>
                  <option value="role">Role</option>
                </select>
              </div>
            </div>

            <div className="max-h-56 overflow-auto">
              {loadingMembers && <div className="text-sm text-slate-500">Loading...</div>}
              {filtered.length === 0 && !loadingMembers && <div className="text-sm text-slate-600">No members</div>}
              {filtered.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full font-semibold flex items-center justify-center ${colorFromEmail(m.email || m.user_email)}`}>{initialsFromEmail(m.email || m.user_email)}</div>
                    <div className="flex flex-col">
                      <div className="text-sm text-slate-800 truncate">{m.email || m.user_email || `user:${m.user_id || m.userId}`}</div>
                      <div className="text-xs text-slate-500">{m.user_id ? `id ${m.user_id}` : ''}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">{m.role || '-'}</div>
                    {/* Manage actions: show for owners */}
                    {myRole === 'owner' && m.user_id !== undefined && (
                      <div className="flex items-center gap-1">
                        <select value={m.role || ''} onChange={(e) => handleChangeRole(m.user_id, e.target.value)} className="text-xs border rounded px-1 py-0.5">
                          <option value="owner">owner</option>
                          <option value="contributor">contributor</option>
                          
                          <option value="viewer">viewer</option>
                          <option value="editor">editor</option>
                        </select>
                        <button onClick={() => handleRemove(m.user_id)} className="text-xs text-rose-600 px-2">Remove</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Invite section for owners/contributors */}
            {myRole === 'owner' || myRole === 'contributor' ? (
              <div className="mt-3 pt-2 border-t">
                <div className="text-xs text-slate-600 mb-2">Invite member</div>
                <div className="flex gap-2">
                  <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@example.com" className="flex-1 px-2 py-1 border rounded text-sm" />
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value as any)} className="text-sm px-2 py-1 border rounded">
                    <option value="viewer">viewer</option>
                    <option value="contributor">contributor</option>
                    
                    <option value="editor">editor</option>
                  </select>
                  <button onClick={handleInvite} className="text-sm px-3 py-1 bg-indigo-600 text-white rounded">Invite</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

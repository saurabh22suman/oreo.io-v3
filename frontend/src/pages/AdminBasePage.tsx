import { useEffect, useMemo, useState } from 'react'
import Alert from '../components/Alert'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function fetchAdmin(path: string, opts?: RequestInit, adminPassword?: string){
  const r = await fetch(`${API_BASE}${path}`, {
    ...(opts||{}),
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': adminPassword || '',
      ...(opts?.headers||{}),
    },
  })
  if(!r.ok) throw new Error(await r.text())
  return r.json()
}

export default function AdminBasePage(){
  const [pwd, setPwd] = useState('')
  const [status, setStatus] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user'|'contributor'|'editor'|'approver'|'owner'>('user')
  const [error, setError] = useState('')
  // simple admin command line: supports `delta ls [path]`
  const [cmd, setCmd] = useState('')
  const [cmdOut, setCmdOut] = useState('')
  const [cmdBusy, setCmdBusy] = useState(false)

  async function load(){
    setError('')
    try{ setUsers(await fetchAdmin('/admin/users', {}, pwd)) }catch(e:any){ setError(e.message) }
  }

  // hydrate password from sessionStorage
  useEffect(()=>{
    const s = sessionStorage.getItem('adminPwd')
    if(s && !pwd){ setPwd(s) }
  }, [])

  // persist password to sessionStorage and load users
  useEffect(()=>{ 
    if(pwd){ 
      sessionStorage.setItem('adminPwd', pwd)
      load() 
    }
  }, [pwd])

  async function runCmd(){
    const raw = (cmd||'').trim()
    if(!raw) return
    setCmdBusy(true); setCmdOut('')
    try{
      const parts = raw.split(/\s+/)
      if(parts[0] === 'delta' && parts[1] === 'ls'){
        const path = parts.slice(2).join(' ').trim()
        const q = path ? `?path=${encodeURIComponent(path)}` : ''
        const res = await fetchAdminRaw(`/admin/delta/ls${q}`, pwd)
        setCmdOut(formatDeltaLs(res))
      } else {
        setCmdOut(`Unknown command: ${raw}\n\nSupported:\n  delta ls [path]`)
      }
    }catch(e:any){
      setCmdOut(String(e?.message || e))
    } finally {
      setCmdBusy(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Admin</h2>
        <div className="text-sm text-gray-600">/admin_base</div>
      </div>

      {!pwd ? (
        <div className="border border-gray-200 bg-white rounded-md p-3 max-w-sm">
          <div className="text-sm mb-2">Enter admin password</div>
          <input type="password" className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="admin123" value={pwd} onChange={e=>setPwd(e.target.value)} />
          <div className="text-xs text-gray-600 mt-2">Default is admin123 (configurable via ADMIN_PASSWORD env)</div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-end mb-2">
            <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={()=>{ setPwd(''); sessionStorage.removeItem('adminPwd'); setUsers([]) }}>Clear password</button>
          </div>
          {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
          {status && <Alert type="success" message={status} onClose={()=>setStatus('')} autoDismiss={true} />}

          <div className="border border-gray-200 bg-white rounded-md p-3 mb-3">
            <div className="text-sm font-medium mb-2">Create user</div>
            <div className="grid sm:grid-cols-4 gap-2">
              <input className="border border-gray-300 rounded-md px-3 py-2" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
              <input className="border border-gray-300 rounded-md px-3 py-2" placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
              <select className="border border-gray-300 rounded-md px-3 py-2" value={role} onChange={e=>setRole(e.target.value as any)}>
                <option value="user">user</option>
                <option value="contributor">contributor</option>
                <option value="approver">approver</option>
                <option value="owner">owner</option>
              </select>
              <button className="btn-primary bold px-3 py-2 text-sm" onClick={async()=>{
                setError(''); setStatus('')
                try{ await fetchAdmin('/admin/users', { method:'POST', body: JSON.stringify({ email, password, role }) }, pwd); setStatus('User created'); setEmail(''); setPassword(''); load() }catch(e:any){ setError(e.message) }
              }}>Create</button>
            </div>
          </div>

          <div className="border border-gray-200 bg-white rounded-md p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Admin command line</div>
              <div className="text-xs text-gray-500">Try: <code>delta ls</code> or <code>delta ls sub/folder</code></div>
            </div>
            <div className="flex items-center gap-2">
              <input className="flex-1 border border-gray-300 rounded-md px-3 py-2" placeholder="delta ls [path]" value={cmd} onChange={e=>setCmd(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'){ runCmd() } }} />
              <button className="btn-primary px-3 py-2 text-sm" disabled={cmdBusy} onClick={runCmd}>{cmdBusy? 'Running...' : 'Run'}</button>
            </div>
            {cmdOut && (
              <pre className="mt-3 text-xs bg-gray-50 border border-gray-200 rounded-md p-2 overflow-auto max-h-80 whitespace-pre-wrap">{cmdOut}</pre>
            )}
          </div>

          <div className="border border-gray-200 bg-white rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Users</div>
              <button className="border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={load}>Refresh</button>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 border-b border-gray-200">ID</th>
                    <th className="text-left px-3 py-2 border-b border-gray-200">Email</th>
                    <th className="text-left px-3 py-2 border-b border-gray-200">Role</th>
                    <th className="text-left px-3 py-2 border-b border-gray-200">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <UserRow key={u.id} u={u} pwd={pwd} onChanged={load} onError={setError} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function UserRow({ u, pwd, onChanged, onError }: { u:any; pwd: string; onChanged: ()=>void; onError: (m:string)=>void }){
  const [email, setEmail] = useState(u.email)
  const [role, setRole] = useState(u.role || 'user')
  const [newPw, setNewPw] = useState('')

  async function update(){
    try{ await fetchAdmin(`/admin/users/${u.id}`, { method:'PUT', body: JSON.stringify({ email, role, password: newPw||undefined }) }, pwd); setNewPw(''); onChanged() }catch(e:any){ onError(e.message) }
  }
  async function del(){
    if(!confirm('Delete this user?')) return
    try{ await fetchAdmin(`/admin/users/${u.id}`, { method:'DELETE' }, pwd); onChanged() }catch(e:any){ onError(e.message) }
  }

  return (
    <tr>
      <td className="px-3 py-2 border-b border-gray-100 whitespace-nowrap">{u.id}</td>
      <td className="px-3 py-2 border-b border-gray-100 min-w-[16rem]"><input className="w-full border border-gray-300 rounded-md px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} /></td>
      <td className="px-3 py-2 border-b border-gray-100">
        <select className="border border-gray-300 rounded-md px-2 py-1" value={role} onChange={e=>setRole(e.target.value)}>
          <option value="user">user</option>
          <option value="contributor">contributor</option>
          <option value="approver">approver</option>
          <option value="owner">owner</option>
        </select>
      </td>
      <td className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <input className="border border-gray-300 rounded-md px-2 py-1" placeholder="new password (optional)" type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} />
          <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={update}>Save</button>
          <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={del}>Delete</button>
        </div>
      </td>
    </tr>
  )
}

// helper within module scope
async function fetchAdminRaw(path: string, adminPassword?: string){
  const API_BASE = import.meta.env.VITE_API_BASE || '/api'
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { 'X-Admin-Password': adminPassword || '' },
  })
  if(!r.ok){ throw new Error(await r.text()) }
  return r.json()
}

function formatDeltaLs(res: any): string{
  try{
    const lines: string[] = []
    const rel = res.path?.replace(res.root, '') || ''
    lines.push(`# Delta root: ${res.root}`)
    lines.push(`# Path: ${rel || '/'}\n`)
    const items = (res.items||[]) as Array<any>
    if(items.length === 0){ lines.push('(empty)'); return lines.join('\n') }
    // columns: TYPE NAME PATH
    const rows = items.map((it:any)=>[it.type, it.name, it.path])
    const colWidths = [4, 4, 4]
    rows.forEach(r=>{ r.forEach((cell:string,i:number)=>{ colWidths[i] = Math.max(colWidths[i], String(cell||'').length) }) })
    const header = ['TYPE','NAME','PATH']
    const pad = (s:string,w:number)=> (s||'').padEnd(w)
    lines.push(`${pad(header[0], colWidths[0])}  ${pad(header[1], colWidths[1])}  ${pad(header[2], colWidths[2])}`)
    lines.push(`${'-'.repeat(colWidths[0])}  ${'-'.repeat(colWidths[1])}  ${'-'.repeat(colWidths[2])}`)
    rows.forEach(r=> lines.push(`${pad(String(r[0]), colWidths[0])}  ${pad(String(r[1]), colWidths[1])}  ${String(r[2])}`))
    return lines.join('\n')
  }catch(e:any){
    return String(e?.message || e)
  }
}


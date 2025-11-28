import { useEffect, useMemo, useState } from 'react'
import Alert from '../components/Alert'
import { Shield, Terminal, UserPlus, Users, RefreshCw, Trash2, Save, Key, Lock } from 'lucide-react'

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
    <div className="max-w-6xl mx-auto p-6 animate-fade-in space-y-8">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-surface-1 border border-divider p-8 shadow-lg">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-danger/10 text-xs font-bold border border-danger/20 text-danger flex items-center gap-2">
                <Shield className="w-3 h-3" />
                Admin Area
              </span>
            </div>
            <h1 className="text-3xl font-bold mb-2 tracking-tight text-text font-display">System Administration</h1>
            <p className="text-text-secondary text-sm">
              Manage users, permissions, and system diagnostics.
            </p>
          </div>
          {pwd && (
            <button 
              className="px-4 py-2 rounded-xl border border-divider bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text transition-colors text-sm font-medium" 
              onClick={()=>{ setPwd(''); sessionStorage.removeItem('adminPwd'); setUsers([]) }}
            >
              Clear Session
            </button>
          )}
        </div>
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-danger/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      </div>

      {!pwd ? (
        <div className="max-w-md mx-auto bg-surface-1 rounded-2xl border border-divider p-8 shadow-sm">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-text-secondary" />
            </div>
            <h3 className="text-lg font-bold text-text">Admin Access Required</h3>
            <p className="text-sm text-text-secondary mt-1">Please enter the admin password to continue.</p>
          </div>
          
          <div className="space-y-4">
            <input 
              type="password" 
              className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
              placeholder="Enter admin password" 
              value={pwd} 
              onChange={e=>setPwd(e.target.value)} 
            />
            <p className="text-xs text-text-muted text-center">
              Default is <code className="bg-surface-2 px-1 py-0.5 rounded border border-divider">admin123</code> (configurable via env)
            </p>
          </div>
        </div>
      ) : (
        <>
          {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
          {status && <Alert type="success" message={status} onClose={()=>setStatus('')} autoDismiss={true} />}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: User Management */}
            <div className="lg:col-span-2 space-y-8">
              {/* Create User Card */}
              <div className="bg-surface-1 rounded-2xl border border-divider overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-divider bg-surface-2/50 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-text">Create User</h3>
                </div>
                <div className="p-6">
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <input 
                      className="w-full px-4 py-2 rounded-xl border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                      placeholder="Email address" 
                      value={email} 
                      onChange={e=>setEmail(e.target.value)} 
                    />
                    <input 
                      className="w-full px-4 py-2 rounded-xl border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                      placeholder="Password" 
                      type="password" 
                      value={password} 
                      onChange={e=>setPassword(e.target.value)} 
                    />
                  </div>
                  <div className="flex gap-4">
                    <select 
                      className="flex-1 px-4 py-2 rounded-xl border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                      value={role} 
                      onChange={e=>setRole(e.target.value as any)}
                    >
                      <option value="user">User</option>
                      <option value="contributor">Contributor</option>
                      <option value="approver">Approver</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button 
                      className="px-6 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold shadow-lg shadow-primary/20 transition-all" 
                      onClick={async()=>{
                        setError(''); setStatus('')
                        try{ await fetchAdmin('/admin/users', { method:'POST', body: JSON.stringify({ email, password, role }) }, pwd); setStatus('User created'); setEmail(''); setPassword(''); load() }catch(e:any){ setError(e.message) }
                      }}
                    >
                      Create User
                    </button>
                  </div>
                </div>
              </div>

              {/* Users List */}
              <div className="bg-surface-1 rounded-2xl border border-divider overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-divider flex items-center justify-between bg-surface-2/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                      <Users className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-text">Users</h3>
                  </div>
                  <button 
                    className="p-2 hover:bg-surface-3 rounded-lg text-text-secondary hover:text-text transition-colors" 
                    onClick={load}
                    title="Refresh list"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-2/30 border-b border-divider">
                        <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                      {users.map(u => (
                        <UserRow key={u.id} u={u} pwd={pwd} onChanged={load} onError={setError} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: CLI */}
            <div className="lg:col-span-1">
              <div className="bg-surface-1 rounded-2xl border border-divider overflow-hidden shadow-sm h-full flex flex-col">
                <div className="px-6 py-4 border-b border-divider bg-surface-2/50 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-text-muted/10 text-text-muted">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-text">System CLI</h3>
                    <p className="text-xs text-text-secondary">Execute admin commands</p>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex gap-2 mb-4">
                    <input 
                      className="flex-1 px-3 py-2 rounded-lg border border-divider bg-surface-2 text-text font-mono text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                      placeholder="delta ls [path]" 
                      value={cmd} 
                      onChange={e=>setCmd(e.target.value)} 
                      onKeyDown={e=>{ if(e.key==='Enter'){ runCmd() } }} 
                    />
                    <button 
                      className="px-4 py-2 rounded-lg bg-surface-3 hover:bg-surface-2 text-text font-medium border border-divider transition-colors text-sm" 
                      disabled={cmdBusy} 
                      onClick={runCmd}
                    >
                      {cmdBusy? '...' : 'Run'}
                    </button>
                  </div>
                  
                  <div className="flex-1 bg-black/90 rounded-xl p-4 overflow-auto min-h-[300px] border border-divider shadow-inner">
                    {cmdOut ? (
                      <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">{cmdOut}</pre>
                    ) : (
                      <div className="text-xs font-mono text-gray-500">
                        # Available commands:<br/>
                        &gt; delta ls [path]<br/>
                        <br/>
                        # Ready for input...
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
    <tr className="hover:bg-surface-2 transition-colors group">
      <td className="px-6 py-4 text-sm text-text-secondary font-mono">#{u.id}</td>
      <td className="px-6 py-4">
        <input 
          className="w-full bg-transparent border-b border-transparent hover:border-divider focus:border-primary outline-none text-sm text-text transition-colors px-1" 
          value={email} 
          onChange={e=>setEmail(e.target.value)} 
        />
      </td>
      <td className="px-6 py-4">
        <select 
          className="bg-transparent border-b border-transparent hover:border-divider focus:border-primary outline-none text-sm text-text transition-colors px-1 cursor-pointer" 
          value={role} 
          onChange={e=>setRole(e.target.value)}
        >
          <option value="user">User</option>
          <option value="contributor">Contributor</option>
          <option value="approver">Approver</option>
          <option value="owner">Owner</option>
        </select>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <input 
              className="w-32 px-2 py-1 rounded border border-divider bg-surface-1 text-xs focus:border-primary outline-none" 
              placeholder="New password" 
              type="password" 
              value={newPw} 
              onChange={e=>setNewPw(e.target.value)} 
            />
          </div>
          <button 
            className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors" 
            onClick={update}
            title="Save changes"
          >
            <Save className="w-4 h-4" />
          </button>
          <button 
            className="p-1.5 text-danger hover:bg-danger/10 rounded transition-colors" 
            onClick={del}
            title="Delete user"
          >
            <Trash2 className="w-4 h-4" />
          </button>
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


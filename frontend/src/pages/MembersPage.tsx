import { useEffect, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { getProject, listMembers, removeMember, upsertMember, myProjectRole, currentUser } from '../api'

type Member = { id: number; email: string; role: 'owner'|'contributor'|'approver'|'viewer' }

export default function MembersPage(){
  const { id } = useParams()
  const projectId = Number(id)
  const [project, setProject] = useState<any>(null)
  const [items, setItems] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Member['role']>('viewer')
  const [isOwner, setIsOwner] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [meId, setMeId] = useState<number|undefined>(undefined)
  const [meEmail, setMeEmail] = useState<string|undefined>(undefined)

  useEffect(()=>{ (async()=>{
    try{
      const [p, ms, me, meInfo] = await Promise.all([
        getProject(projectId),
        listMembers(projectId),
        myProjectRole(projectId).catch(()=>({role:null as any})),
        currentUser().catch(()=>null as any)
      ])
      setProject(p); setItems(ms)
      setIsOwner(me?.role === 'owner')
  if(meInfo?.id) setMeId(Number(meInfo.id))
  if(meInfo?.email) setMeEmail(String(meInfo.email))
    } catch(e:any){ setError(e.message) }
  })() }, [projectId])

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <main className="flex-1 main p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">Project: {project?.name || projectId}</h2>
          </div>
          <div className="mb-4 border-b border-gray-200">
            <nav className="flex gap-2">
              <NavLink end to={`/projects/${projectId}`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Datasets</NavLink>
              <NavLink to={`/projects/${projectId}/members`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Members</NavLink>
            </nav>
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {isOwner && (
                <div className="border border-gray-200 bg-white rounded-md p-3 mb-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input className="border border-gray-300 px-3 py-2" placeholder="Member email" value={email} onChange={e=>setEmail(e.target.value)} />
                    <select className="border border-gray-300 px-3 py-2" value={role} onChange={e=>setRole(e.target.value as Member['role'])}>
                      <option value="owner">Owner</option>
                      <option value="contributor">Contributor</option>
                      <option value="approver">Approver</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button disabled={!email || saving} className="btn-primary bold px-3 py-2 text-sm disabled:opacity-60" onClick={async()=>{
                      setError(''); setSaving(true)
                      try{ const m = await upsertMember(projectId, email, role); const exists = items.find(x=>x.id===m.id); if(exists){ setItems(items.map(x=>x.id===m.id? m : x)) } else { setItems([m, ...items]) } setEmail('') }
                      catch(e:any){ setError(e.message) }
                      finally{ setSaving(false) }
                    }}>Add/Update</button>
                  </div>
                  {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
                </div>
              )}

              <ul className="space-y-2">
                {items.map(m => (
                  <li key={m.id} className="flex items-center justify-between border border-gray-200 bg-white rounded-md px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{m.email}</div>
                      <div className="text-xs text-gray-500">{m.role}</div>
                    </div>
                    {isOwner && typeof meId === 'number' && meId !== m.id && m.email !== meEmail && !(m.role === 'owner' && (m.email === (project?.owner_email || project?.owner))) && (
                      <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={async()=>{
                        try{ await removeMember(projectId, m.id); setItems(items.filter(x=>x.id!==m.id)) } catch(e:any){ setError(e.message) }
                      }}>Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-1">
              {/* Placeholder right column for future project info or actions */}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

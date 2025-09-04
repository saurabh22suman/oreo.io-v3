import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getDataset, getDatasetStatsTop, getProject, listDatasetApprovalsTop, myProjectRole, subscribeNotifications } from '../api'
import Alert from '../components/Alert'

type Dataset = { id:number; name:string; schema?: string; rules?: string; last_upload_path?: string; last_upload_at?: string }

type Change = { id:number; type:string; status:string; title?:string; created_at?:string; user_id?: number; reviewer_id?: number }
type Member = { id:number; email:string; role:'owner'|'contributor'|'viewer' }

export default function DatasetDetailsPage(){
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const nav = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<Dataset|null>(null)
  const [stats, setStats] = useState<{row_count?:number; column_count?:number; owner_name?:string; table_location?:string; last_update_at?: string} | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [role, setRole] = useState<'owner'|'contributor'|'viewer'|null>(null)
  const [pending, setPending] = useState<any[]>([])
  

  useEffect(()=>{ (async()=>{
    try{
      setProject(await getProject(projectId))
      const ds = await getDataset(projectId, dsId); setDataset(ds)
      try{ setStats(await getDatasetStatsTop(dsId)) }catch{}
      try{ const r = await myProjectRole(projectId); setRole(r.role) }catch{}
  try{ setPending(await listDatasetApprovalsTop(dsId, 'pending')) }catch{}
    }catch(e:any){ setError(e.message) }
  })() }, [projectId, dsId])

  useEffect(()=>{
    // Live-update stats on approval notifications
    const unsub = subscribeNotifications(async (evt) => {
      if(evt?.type === 'change_approved' && Number(evt?.dataset_id) === dsId){
        try{ setStats(await getDatasetStatsTop(dsId)) }catch{}
      }
    })
    return () => { try{ unsub() }catch{} }
  }, [dsId])

  const owner = useMemo(()=> stats?.owner_name || project?.owner_email || project?.owner || '', [stats, project])

  return (
    <div className="max-w-5xl mx-auto">
      {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
      {toast && <Alert type="success" message={toast} onClose={()=>setToast('')} />}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-gray-500">Project: {project?.name || projectId}</div>
          <h2 className="text-2xl font-semibold">{dataset?.name || `Dataset #${dsId}`}</h2>
        </div>
        <Link className="text-sm text-primary hover:underline" to={`/projects/${projectId}`}>Back to datasets</Link>
      </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* View */}
        <CardLink to={`/projects/${projectId}/datasets/${dsId}/view`} title="View" desc="Open data viewer" icon={
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-10 h-10 opacity-80"><path strokeWidth="2" d="M3 5h18M3 12h18M3 19h18"/></svg>
        } />
        {/* Append */}
        <CardLink
          to={`/projects/${projectId}/datasets/${dsId}/append`}
          title="Append"
          desc={role === 'viewer' ? 'Requires contributor role' : 'Upload and submit'}
      icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-10 h-10 opacity-80"><path strokeWidth="2" d="M12 5v14m-7-7h14"/></svg>}
          disabled={role === 'viewer'}
        />
        {/* Query */}
        <CardLink to={`/projects/${projectId}/query?dataset=${dsId}`} title="Query" desc="Open SQL editor" icon={
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-10 h-10 opacity-80"><path strokeWidth="2" d="M4 6h16M4 12h10M4 18h7"/></svg>
        } />
        {/* Settings */}
        <CardLink to={`/projects/${projectId}/datasets/${dsId}/settings`} title="Settings" desc="Manage dataset" icon={
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-10 h-10 opacity-80"><path strokeWidth="2" d="M12 6.75a5.25 5.25 0 100 10.5 5.25 5.25 0 000-10.5z"/><path strokeWidth="2" d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364-7.364l-1.414 1.414M6.05 17.95l-1.414 1.414m12.728 0l-1.414-1.414M6.05 6.05L4.636 4.636"/></svg>
        } />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="border border-gray-200 rounded-md p-3 bg-white">
          <div className="text-xs text-gray-500">Table</div>
          <div className="font-medium break-words">{stats?.table_location || '—'}</div>
        </div>
        <div className="border border-gray-200 rounded-md p-3 bg-white">
          <div className="text-xs text-gray-500">Rows • Columns</div>
          <div className="font-medium">{(stats?.row_count ?? 0).toLocaleString()} • {(stats?.column_count ?? 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="mt-6 border border-gray-200 rounded-md bg-white">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="text-sm font-medium">Pending approvals</div>
          <Link to={`/projects/${projectId}/datasets/${dsId}/approvals`} className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {pending.length ? (
          <ul className="divide-y">
            {pending.slice(0,5).map((ch:any)=>(
              <li key={ch.id} className="p-3 text-sm flex items-center justify-between">
                <div>
                  <div className="font-medium">{ch.title || ch.type} <span className="text-xs text-gray-500">#{ch.id}</span></div>
                  <div className="text-xs text-gray-600">Submitted {ch.created_at ? new Date(ch.created_at).toLocaleString() : ''}</div>
                </div>
                <Link to={`/projects/${projectId}/datasets/${dsId}/changes/${ch.id}`} className="text-xs text-primary hover:underline">Open</Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-3 text-xs text-gray-600">No pending approvals.</div>
        )}
      </div>
    </div>
  )
}

function CardLink({ to, title, desc, icon, disabled }: { to: string; title: string; desc: string; icon: React.ReactNode, disabled?: boolean }){
  const Cmp: any = disabled ? 'div' : Link
  return (
    <Cmp
      to={disabled ? undefined : to}
      className={`project-card p-3 flex flex-col items-center justify-center text-center min-h-[120px] ${disabled ? 'opacity-50 cursor-not-allowed select-none' : 'hover-shadow'}`}
      title={disabled ? desc : undefined}
      aria-disabled={disabled}
    >
      <div className="mb-2 text-gray-700">{icon}</div>
      <div className="text-base font-semibold text-brand-blue">{title}</div>
      <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
    </Cmp>
  )
}

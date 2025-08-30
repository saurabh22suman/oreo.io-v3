import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { approveChange, getDataset, getDatasetSample, getDatasetStatsTop, getProject, listChanges, rejectChange, myProjectRole, currentUser, withdrawChange } from '../api'
import AgGridDialog from '../components/AgGridDialog'
import Alert from '../components/Alert'
import { orderColumnsBySchema } from '../utils/columnOrder'

type Dataset = { id:number; name:string; schema?: string; rules?: string; last_upload_path?: string; last_upload_at?: string }

type Change = { id:number; type:string; status:string; title?:string; created_at?:string; user_id?: number; reviewer_id?: number }
type Member = { id:number; email:string; role:'owner'|'contributor'|'approver'|'viewer' }

export default function DatasetDetailsPage(){
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const nav = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<Dataset|null>(null)
  const [stats, setStats] = useState<{row_count?:number; column_count?:number; owner_name?:string; table_location?:string} | null>(null)
  const [sample, setSample] = useState<{data:any[]; columns:string[]} | null>(null)
  const [openPreview, setOpenPreview] = useState(false)
  // Append moved to dedicated flow page
  const [changes, setChanges] = useState<Change[]>([])
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [isApprover, setIsApprover] = useState(false)
  const [meId, setMeId] = useState<number|undefined>(undefined)
  

  useEffect(()=>{ (async()=>{
    try{
  setProject(await getProject(projectId))
      const ds = await getDataset(projectId, dsId); setDataset(ds)
      // Load metadata stats (owner, rows, columns). Do not auto-load preview.
      try{ setStats(await getDatasetStatsTop(dsId)) }catch{}
  setChanges(await listChanges(projectId))
  const role = await myProjectRole(projectId).catch(()=>({role:null as any}))
  setIsApprover(role?.role === 'approver')
  const me = await currentUser().catch(()=>null as any)
  if(me?.id) setMeId(Number(me.id))
  
    }catch(e:any){ setError(e.message) }
  })() }, [projectId, dsId])

  const owner = useMemo(()=> stats?.owner_name || project?.owner_email || project?.owner || '', [stats, project])

  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <div className={`flex-1 layout-with-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-slot"><Sidebar collapsed={collapsed} setCollapsed={setCollapsed} /></div>
        <main className="main p-8">
          <div className="max-w-7xl mx-auto">
      <div className="mb-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Project: {project?.name || projectId}</h2>
          <div>
            <Link className="text-sm text-primary hover:underline" to={`/projects/${projectId}`}>Back to datasets</Link>
          </div>
        </div>
        <nav className="flex gap-2 mt-2">
          <NavLink to={`/projects/${projectId}`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Datasets</NavLink>
          <NavLink to={`/projects/${projectId}/members`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Members</NavLink>
        </nav>
      </div>

  {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
  {toast && <Alert type="success" message={toast} onClose={()=>setToast('')} />}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Left: Dataset summary */}
  <div className="lg:col-span-2 border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">{dataset?.name || `Dataset #${dsId}`}</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="border border-gray-100 p-3">
              <div className="text-gray-600">File name</div>
              <div className="font-medium break-words">{dataset?.last_upload_path ? dataset.last_upload_path.split(/[/\\]/).pop() : 'Not uploaded yet'}</div>
            </div>
            <div className="border border-gray-100 p-3">
              <div className="text-gray-600">Owner</div>
              <div className="font-medium">{owner || '—'}</div>
            </div>
            <div className="border border-gray-100 p-3">
              <div className="text-gray-600">Rows</div>
              <div className="font-medium">{stats?.row_count ?? (sample?.data?.length || 0)}</div>
            </div>
            <div className="border border-gray-100 rounded-md p-3">
              <div className="text-gray-600">Columns</div>
              <div className="font-medium">{stats?.column_count ?? (sample?.columns?.length || 0)}</div>
            </div>
            <div className="border border-gray-100 p-3 sm:col-span-2">
              <div className="text-gray-600">Table location</div>
              <div className="font-medium break-words">{stats?.table_location || '—'}</div>
            </div>
              <div className="border border-gray-100 rounded-md p-3 sm:col-span-2">
                <div className="text-gray-600">Last updated</div>
                <div className="font-medium">{dataset?.last_upload_at ? new Date(dataset.last_upload_at).toLocaleString() : (stats as any)?.last_update_at ? new Date((stats as any).last_update_at).toLocaleString() : '—'}</div>
              </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text_sm font-medium">Preview</div>
              <div className="flex gap-3">
                <Link className="text-xs text-primary hover:underline" to={`/projects/${projectId}/datasets/${dsId}/view`}>Open viewer</Link>
                <button className="text-xs text-primary hover:underline" onClick={async()=>{
                  try{ setStats(await getDatasetStatsTop(dsId)) }catch{}
                }}>Refresh stats</button>
                <button className="text-xs text-primary hover:underline" onClick={async()=>{
                  try{
                    const s = await getDatasetSample(projectId, dsId)
                    const cols = orderColumnsBySchema(s.columns||[], dataset?.schema)
                    setSample({ data: s.data||[], columns: cols })
                    setOpenPreview(true)
                    setToast('Loaded preview')
                  }catch(e:any){ setError(e.message) }
                }}>Load preview</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Append + Workflow */}
        <div className="border border-gray-200 bg-white rounded-md p-3">
          <div className="text-sm font-medium mb-2">Append new data</div>
          <div className="flex items-center gap-2 mb-2">
            <Link to={`/projects/${projectId}/datasets/${dsId}/append`} className="btn-primary bold px-3 py-1.5 text-sm">Open append flow</Link>
            <span className="text-xs text-gray-600">Upload, edit, preview, and submit for approval</span>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium mb-2">Change workflow</div>
            {changes.length ? (
              <ul className="space-y-2">
                {changes.map(ch => (
                  <li key={ch.id} className="border border-gray-200 rounded-md p-2 text-sm flex items-center justify-between">
                    <div>
                      <div className="font-medium">{ch.title || ch.type} <span className="text-xs text-gray-500">#{ch.id}</span></div>
                      <div className="text-xs text-gray-600">{ch.status}</div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Link to={`/projects/${projectId}/datasets/${dsId}/changes/${ch.id}`} className="text-xs text-primary hover:underline">Open</Link>
                      {ch.status === 'pending' && (
                        <>
                          {isApprover && (()=>{
                            let ids: number[] = []
                            try{ if(typeof (ch as any).reviewers === 'string') ids = JSON.parse((ch as any).reviewers) }catch{}
                            const assigned = (!ch.reviewer_id || ch.reviewer_id === meId) || (meId && ids.includes(meId))
                            return assigned
                          })() && (
                            <>
                              <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={async()=>{ try{ await approveChange(projectId, ch.id); setChanges(await listChanges(projectId)); setToast('Change approved'); }catch(e:any){ setError(e.message) } }}>Approve</button>
                              <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={async()=>{ try{ await rejectChange(projectId, ch.id); setChanges(await listChanges(projectId)); setToast('Change rejected'); }catch(e:any){ setError(e.message) } }}>Reject</button>
                            </>
                          )}
                          {meId === ch.user_id && (
                            <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={async()=>{
                              try{ await withdrawChange(projectId, ch.id); setChanges(await listChanges(projectId)); setToast('Change withdrawn') }
                              catch(e:any){ setError(e.message) }
                            }}>Withdraw</button>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-gray-600">No changes yet.</div>
            )}
          </div>
        </div>
      </div>
      <AgGridDialog
        open={openPreview}
        onOpenChange={setOpenPreview}
        title={`Dataset ${dataset?.name || dsId}`}
        rows={sample?.data || []}
        columns={sample?.columns || []}
        pageSize={50}
  allowEdit={false}
        compact
      />

  {/* Append reviewer selection moved to append flow page */}
          </div>
        </main>
      </div>
    </div>
  )
}

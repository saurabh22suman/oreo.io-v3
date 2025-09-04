import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteDataset, getDataset, getDatasetStatsTop, getProject, myProjectRole } from '../api'
import Alert from '../components/Alert'

export default function DatasetSettingsPage(){
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const nav = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<any>(null)
  const [stats, setStats] = useState<{row_count?:number; column_count?:number; owner_name?:string; table_location?:string; last_update_at?: string} | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [role, setRole] = useState<'owner'|'contributor'|'viewer'|null>(null)

  useEffect(()=>{ (async()=>{
    try{
      setProject(await getProject(projectId))
      const ds = await getDataset(projectId, dsId); setDataset(ds)
      try{ setStats(await getDatasetStatsTop(dsId)) }catch{}
      try{ const r = await myProjectRole(projectId); setRole(r.role) }catch{}
    }catch(e:any){ setError(e.message) }
  })() }, [projectId, dsId])

  async function onDelete(){
    if(!confirming) { setConfirming(true); return }
    try{
      setBusy(true)
      await deleteDataset(projectId, dsId)
      setToast('Dataset deleted')
      nav(`/projects/${projectId}`)
    }catch(e:any){ setError(e.message) }
    finally{ setBusy(false); setConfirming(false) }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
      {toast && <Alert type="success" message={toast} onClose={()=>setToast('')} />}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-gray-500">Project: {project?.name || projectId}</div>
          <h2 className="text-2xl font-semibold">Settings • {dataset?.name || `Dataset #${dsId}`}</h2>
        </div>
        <Link className="text-sm text-primary hover:underline" to={`/projects/${projectId}/datasets/${dsId}`}>Back to details</Link>
      </div>

      <section className="space-y-4">
        <div className="border border-gray-200 rounded-md bg-white p-4">
          <h3 className="font-semibold mb-2">Metadata</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium break-words">{dataset?.name || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Owner</dt>
              <dd className="font-medium">{stats?.owner_name || dataset?.owner_name || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Rows • Columns</dt>
              <dd className="font-medium">{(stats?.row_count ?? 0).toLocaleString()} • {(stats?.column_count ?? 0).toLocaleString()}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Table location</dt>
              <dd className="font-medium break-words">{stats?.table_location || '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Last updated</dt>
              <dd className="font-medium">{dataset?.last_upload_at ? new Date(dataset.last_upload_at).toLocaleString() : (stats as any)?.last_update_at ? new Date((stats as any).last_update_at).toLocaleString() : '—'}</dd>
            </div>
          </dl>
        </div>

  {role === 'owner' && (
  <div className="border border-red-200 rounded-md bg-white p-4">
          <h3 className="font-semibold text-red-700 mb-2">Danger Zone</h3>
          <p className="text-sm text-gray-600 mb-3">Deleting a dataset is irreversible. This may remove associated data and metadata. Proceed with caution.</p>
          <button disabled={busy} onClick={onDelete} className={`px-3 py-1.5 rounded-md text-sm border ${confirming? 'bg-red-600 text-white border-red-600' : 'border-red-600 text-red-700 hover:bg-red-50'}`}>
            {busy ? 'Deleting…' : confirming ? 'Click again to confirm delete' : 'Delete dataset'}
          </button>
  </div>
  )}
      </section>
    </div>
  )
}

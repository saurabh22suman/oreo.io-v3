import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { approveChange, getProject, rejectChange, currentUser, myProjectRole, listDatasetApprovalsTop } from '../api'
import Alert from '../components/Alert'

export default function DatasetApprovalsPage(){
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const [project, setProject] = useState<any>(null)
  const [changes, setChanges] = useState<any[]>([])
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [me, setMe] = useState<{id:number; email:string}|null>(null)
  const [isApprover, setIsApprover] = useState(false)
  const [status, setStatus] = useState<'pending'|'approved'|'rejected'|'withdrawn'|'all'>('pending')

  async function load(){
    try{
      setProject(await getProject(projectId))
      setChanges(await listDatasetApprovalsTop(dsId, status))
      const meInfo = await currentUser().catch(()=>null as any)
      if(meInfo?.id) setMe({ id: meInfo.id, email: meInfo.email })
      try{ await myProjectRole(projectId); setIsApprover(false) }catch{}
    }catch(e:any){ setError(e.message) }
  }
  useEffect(()=>{ load() }, [projectId, dsId, status])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Approvals</h2>
        <div className="flex gap-2 text-sm">
          <Link to={`/projects/${projectId}/datasets/${dsId}`} className="text-primary hover:underline">Back: Dataset</Link>
          <Link to={`/projects/${projectId}/datasets/${dsId}/view`} className="text-primary hover:underline">Next: Viewer</Link>
        </div>
      </div>
      <div className="mb-3">
        <label className="text-xs text-gray-600 mr-2">Status</label>
        <select className="border px-2 py-1 text-sm" value={status} onChange={e=>setStatus(e.target.value as any)}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="all">All</option>
        </select>
      </div>
  {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
  {toast && <Alert type="success" message={toast} onClose={()=>setToast('')} />}
      <div className="border border-gray-200 bg-white rounded-md p-3">
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
                  {ch.status === 'pending' && me && (()=>{
                    // Only show if me is assigned reviewer; prefer reviewer_states if available in detail view.
                    // Since list API doesn’t embed states, rely on reviewers array and fallback to reviewer_id.
                    let ids: number[] = []
                    try{ if(typeof (ch as any).reviewers === 'string' && (ch as any).reviewers.trim().startsWith('[')) ids = JSON.parse((ch as any).reviewers) }catch{}
                    const isAssigned = (ch.reviewer_id && me.id === ch.reviewer_id) || ids.includes(me.id)
                    return isAssigned || isApprover
                  })() && (
                    <>
                      <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={async()=>{ try{ await approveChange(projectId, ch.id); await load(); setToast('Change approved') }catch(e:any){ setError(e.message) } }}>Approve</button>
                      <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={async()=>{ try{ await rejectChange(projectId, ch.id); await load(); setToast('Change rejected') }catch(e:any){ setError(e.message) } }}>Reject</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-gray-600">No changes.</div>
        )}
      </div>
    </div>
  )
}

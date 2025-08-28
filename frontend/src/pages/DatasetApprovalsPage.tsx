import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { approveChange, getProject, listChanges, rejectChange } from '../api'

export default function DatasetApprovalsPage(){
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const [project, setProject] = useState<any>(null)
  const [changes, setChanges] = useState<any[]>([])
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(()=>{ (async()=>{
    try{ setProject(await getProject(projectId)); setChanges(await listChanges(projectId)) }catch(e:any){ setError(e.message) }
  })() }, [projectId])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Approvals</h2>
        <div className="flex gap-2 text-sm">
          <Link to={`/projects/${projectId}/datasets/${dsId}/upload`} className="text-primary hover:underline">Back: Upload</Link>
          <Link to={`/projects/${projectId}/datasets/${dsId}/view`} className="text-primary hover:underline">Next: Viewer</Link>
        </div>
      </div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {toast && <div className="text-sm text-green-700 mb-2">{toast}</div>}
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
                  {ch.status === 'pending' && (
                    <>
                      <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={async()=>{ try{ await approveChange(projectId, ch.id); setChanges(await listChanges(projectId)); setToast('Change approved') }catch(e:any){ setError(e.message) } }}>Approve</button>
                      <button className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" onClick={async()=>{ try{ await rejectChange(projectId, ch.id); setChanges(await listChanges(projectId)); setToast('Change rejected') }catch(e:any){ setError(e.message) } }}>Reject</button>
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

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProject } from '../api'
import AgGridDialog from '../components/AgGridDialog'

async function fetchJSON(url: string, opts?: RequestInit){
  const r = await fetch(url, { ...(opts||{}), headers: { 'Content-Type': 'application/json', ...(opts?.headers||{}), ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}) } });
  if(!r.ok) throw new Error(await r.text()); return r.json()
}

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export default function ChangeDetailsPage(){
  const { id, changeId, datasetId } = useParams()
  const projectId = Number(id)
  const chId = Number(changeId)
  const dsId = Number(datasetId)
  const [project, setProject] = useState<any>(null)
  const [change, setChange] = useState<any>(null)
  const [preview, setPreview] = useState<{data:any[]; columns:string[]}|null>(null)
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  useEffect(()=>{ (async()=>{
    try{
      setProject(await getProject(projectId))
      const ch = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}`)
      setChange(ch)
      try{ const pv = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}/preview`); setPreview({ data: pv.data||[], columns: pv.columns||[] }) }catch{}
      try{ const cs = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}/comments`); setComments(cs) }catch{}
    }catch(e:any){ setError(e.message) }
  })() }, [projectId, chId])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Change #{chId}</h2>
        <div className="flex gap-2 text-sm">
          <Link to={`/projects/${projectId}/datasets/${dsId}/approvals`} className="text-primary hover:underline">Back to approvals</Link>
        </div>
      </div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {change && (
        <div className="border border-gray-200 bg-white rounded-md p-3 mb-3 text-sm">
          <div className="flex flex-wrap gap-4">
            <div><span className="text-gray-600">Type:</span> <span className="font-medium">{change.type}</span></div>
            <div><span className="text-gray-600">Status:</span> <span className="font-medium">{change.status}</span></div>
            {change.title && <div><span className="text-gray-600">Title:</span> <span className="font-medium">{change.title}</span></div>}
          </div>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2 border border-gray-200 bg-white rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Data preview</div>
            {preview && <button className="text-sm text-primary hover:underline" onClick={()=> setOpen(true)}>Open in dialog</button>}
          </div>
          <div className="text-xs text-gray-600">Open the preview to explore with pagination, resizing, export, and editing.</div>
        </div>
        <div className="border border-gray-200 bg-white rounded-md p-3">
          <div className="text-sm font-medium mb-2">Comments</div>
          <div className="space-y-2 max-h-64 overflow-auto mb-2">
            {comments.length ? comments.map(cm => (
              <div key={cm.id} className="border border-gray-100 rounded-md p-2 text-xs">
                <div className="text-gray-600">{new Date(cm.created_at || cm.CreatedAt || Date.now()).toLocaleString()}</div>
                <div>{cm.body}</div>
              </div>
            )) : <div className="text-xs text-gray-600">No comments yet.</div>}
          </div>
          <textarea className="w-full border border-gray-300 rounded-md px-3 py-2 text-xs" rows={3} placeholder="Add a comment" value={comment} onChange={e=>setComment(e.target.value)} />
          <button className="mt-2 rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600" onClick={async()=>{
            if(!comment.trim()) return
            try{
              const r = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}/comments`, { method:'POST', body: JSON.stringify({ body: comment }) })
              setComments([...comments, r]); setComment('')
            }catch(e:any){ setError(e.message) }
          }}>Post</button>
        </div>
      </div>
      <AgGridDialog
        open={open}
        onOpenChange={setOpen}
        title={`Change #${chId} preview`}
        rows={preview?.data || []}
        columns={preview?.columns || []}
        pageSize={50}
      />
    </div>
  )
}

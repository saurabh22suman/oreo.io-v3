import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProject, currentUser, approveChange, rejectChange, myProjectRole, subscribeNotifications } from '../api'
import AgGridDialog from '../components/AgGridDialog'
import Alert from '../components/Alert'

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
  const [reviewerStates, setReviewerStates] = useState<any[]|null>(null)
  const [preview, setPreview] = useState<{data:any[]; columns:string[]}|null>(null)
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [me, setMe] = useState<{id:number; email:string}|null>(null)
  const [isApprover, setIsApprover] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(()=>{ (async()=>{
    try{
      setProject(await getProject(projectId))
  const meInfo = await currentUser().catch(()=>null as any)
  if(meInfo?.id) setMe({ id: meInfo.id, email: meInfo.email })
  try{ await myProjectRole(projectId); setIsApprover(false) }catch{}
  const ch = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}`)
  const base = ch?.change || ch
  // merge top-level requestor/reviewer extras for ease of rendering
  setChange({ ...base, requestor_email: ch?.requestor_email, requestor_name: ch?.requestor_name, reviewer_email: ch?.reviewer_email, reviewer_emails: ch?.reviewer_emails })
  if(ch?.reviewer_states) setReviewerStates(ch.reviewer_states as any[])
  // Attach reviewer email(s) if present
      try{ const pv = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}/preview`); setPreview({ data: pv.data||[], columns: pv.columns||[] }) }catch{}
      try{ const cs = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}/comments`); setComments(cs) }catch{}
    }catch(e:any){ setError(e.message) }
  })() }, [projectId, chId])

  // Listen for change_approved SSE to show popup for the requestor
  useEffect(()=>{
    let mounted = true
    const unsub = subscribeNotifications((evt) => {
      if(!mounted) return
      if(evt?.type === 'change_approved'){
        const pid = Number(evt?.project_id || evt?.metadata?.project_id)
        const cid = Number(evt?.change_request_id || evt?.metadata?.change_request_id)
        if(pid === projectId && cid === chId){
          setShowSuccess(true)
        }
      }
    })
    return ()=>{ mounted = false; unsub() }
  }, [projectId, chId])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Change #{chId}</h2>
        <div className="flex gap-2 text-sm">
          <Link to={`/projects/${projectId}/datasets/${dsId}/approvals`} className="text-primary hover:underline">Back to approvals</Link>
        </div>
      </div>
  {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
      {change && (
        <div className="border border-gray-200 bg-white rounded-md p-3 mb-3 text-sm">
          <div className="flex flex-wrap gap-4">
            <div><span className="text-gray-600">Type:</span> <span className="font-medium">{change.type}</span></div>
            <div><span className="text-gray-600">Status:</span> <span className="font-medium">{change.status}</span></div>
            {change.title && <div><span className="text-gray-600">Title:</span> <span className="font-medium">{change.title}</span></div>}
            {(change.requestor_email || change.requestor_name) && (
              <div><span className="text-gray-600">Requestor:</span> <span className="font-medium">{change.requestor_name ? `${change.requestor_name} • `: ''}{change.requestor_email || ''}</span></div>
            )}
            {/* Pending with removed per requirement */}
            {/* Hide reviewers list per requirement; show Requestor above instead */}
            {Array.isArray(reviewerStates) && reviewerStates.length>0 && (
              <div className="w-full">
                <div className="text-gray-600">Reviewer status</div>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {reviewerStates.map((st:any, idx:number)=> (
                    <li key={idx} className={`text-xs px-2 py-1 rounded-md border ${st.status==='approved'?'bg-green-50 border-green-200 text-green-800': st.status==='rejected'?'bg-red-50 border-red-200 text-red-800':'bg-gray-50 border-gray-200 text-gray-800'}`}>
                      {(st.email || `User #${st.id}`)}: {st.status || 'pending'} {st.decided_at ? `• ${new Date(st.decided_at).toLocaleString()}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
            {comments.length ? comments.map((cm) => {
              const name = (cm as any).user_name as string | undefined
              const email = (cm as any).user_email as string | undefined
              const identity = [name, email].filter(Boolean).join(' • ') || email || name || 'Unknown user'
              const createdAt = (cm as any).created_at || (cm as any).CreatedAt || Date.now()
              return (
                <div key={cm.id} className="border border-gray-100 rounded-md p-2 text-xs">
                  <div className="text-gray-600">{identity} • {new Date(createdAt).toLocaleString()}</div>
                  <div>{(cm as any).body}</div>
                </div>
              )
            }) : <div className="text-xs text-gray-600">No comments yet.</div>}
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
  allowEdit
  compact={false}
      />
      {showSuccess && (
        <div role="alert" className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-md shadow-md text-sm">
          Data appended successfully
          <button className="ml-3 text-white/80 hover:text-white" onClick={()=> setShowSuccess(false)} aria-label="Close">×</button>
        </div>
      )}
  {change && me && (
        <div className="mt-3 flex gap-2">
  {/* Show approve/reject only if user is an assigned reviewer */}
          {(() => {
    const idsFromStates: number[] = Array.isArray(reviewerStates) ? reviewerStates.map((s:any)=> Number(s.id)).filter(Boolean) : []
    const isAssigned = (change.reviewer_id && me.id === change.reviewer_id) || idsFromStates.includes(me.id)
    return change.status === 'pending' && (isAssigned || isApprover)
          })() && (
            <>
              <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={async()=>{ try{ await approveChange(projectId, chId); location.reload() }catch(e:any){ setError(e.message) } }}>Approve</button>
              <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={async()=>{ try{ await rejectChange(projectId, chId); location.reload() }catch(e:any){ setError(e.message) } }}>Reject</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

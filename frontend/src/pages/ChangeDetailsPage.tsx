import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { getProject, currentUser, approveChange, rejectChange, myProjectRole, subscribeNotifications } from '../api'
import AgGridDialog from '../components/AgGridDialog'
import Alert from '../components/Alert'
import Card from '../components/Card'
import { CheckCircle, XCircle, MessageSquare, FileText, User, Clock, AlertCircle, GitPullRequest, ArrowUpRight, Check, X } from 'lucide-react'

async function fetchJSON(url: string, opts?: RequestInit) {
  const r = await fetch(url, { ...(opts || {}), headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}), ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}) } });
  if (!r.ok) throw new Error(await r.text()); return r.json()
}

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export default function ChangeDetailsPage() {
  const { id, changeId, datasetId } = useParams()
  const projectId = Number(id)
  const chId = Number(changeId)
  const dsId = Number(datasetId)
  const [project, setProject] = useState<any>(null)
  const [change, setChange] = useState<any>(null)
  const [reviewerStates, setReviewerStates] = useState<any[] | null>(null)
  const [preview, setPreview] = useState<{ data: any[]; columns: string[] } | null>(null)
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [me, setMe] = useState<{ id: number; email: string } | null>(null)
  const [isApprover, setIsApprover] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        setProject(await getProject(projectId))
        const meInfo = await currentUser().catch(() => null as any)
        if (meInfo?.id) setMe({ id: meInfo.id, email: meInfo.email })
        try { await myProjectRole(projectId); setIsApprover(false) } catch { }
        const ch = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}`)
        const base = ch?.change || ch
        setChange({ ...base, requestor_email: ch?.requestor_email, requestor_name: ch?.requestor_name })
        if (ch?.reviewer_states) setReviewerStates(ch.reviewer_states as any[])
        try { const pv = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}/preview`); setPreview({ data: pv.data || [], columns: pv.columns || [] }) } catch { }
        try { const cs = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}/comments`); setComments(cs) } catch { }
      } catch (e: any) { setError(e.message) }
    })()
  }, [projectId, chId])

  // Listen for change_approved SSE to show popup for the requestor
  useEffect(() => {
    let mounted = true
    const unsub = subscribeNotifications((evt) => {
      if (!mounted) return
      if (evt?.type === 'change_approved') {
        const pid = Number(evt?.project_id || evt?.metadata?.project_id)
        const cid = Number(evt?.change_request_id || evt?.metadata?.change_request_id)
        if (pid === projectId && cid === chId) {
          setShowSuccess(true)
        }
      }
    })
    return () => { mounted = false; unsub() }
  }, [projectId, chId])

  const editedCells = useMemo(() => {
    if (!change?.payload) return []
    try {
      const p = JSON.parse(change.payload)
      return p.edited_cells || []
    } catch {
      return []
    }
  }, [change])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />
      case 'rejected': return <XCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl shadow-slate-900/20">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold border border-white/10 text-blue-200 flex items-center gap-2">
              <GitPullRequest className="w-3.5 h-3.5" />
              Change Request
            </span>
            {change && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 ${change.status === 'approved' ? 'bg-green-500/20 border-green-500/30 text-green-200' :
                  change.status === 'rejected' ? 'bg-red-500/20 border-red-500/30 text-red-200' :
                    'bg-blue-500/20 border-blue-500/30 text-blue-200'
                }`}>
                {getStatusIcon(change.status)}
                {change.status.charAt(0).toUpperCase() + change.status.slice(1)}
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold mb-2 tracking-tight">
            {change?.title || `Change #${chId}`}
          </h1>

          <div className="flex items-center gap-6 text-slate-300 text-sm mt-4">
            {(change?.requestor_email || change?.requestor_name) && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <span>Requested by <span className="text-white font-medium">{change.requestor_name || change.requestor_email}</span></span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span>Type: <span className="text-white font-medium capitalize">{change?.type}</span></span>
            </div>
          </div>
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Data Preview Card */}
          <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-white dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Data Preview
              </h2>
              {preview && (
                <button
                  onClick={() => setOpen(true)}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  Open in dialog
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Review the changes proposed in this request. Open the full dialog for detailed inspection.
              </p>
              {/* Mini preview or placeholder */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden h-48 flex items-center justify-center text-slate-400">
                {preview ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 opacity-50" />
                    <span className="text-sm">Preview available ({preview.data.length} rows)</span>
                  </div>
                ) : (
                  <span>No preview available</span>
                )}
              </div>
            </div>
          </Card>

          {/* Reviewer Status Card */}
          {Array.isArray(reviewerStates) && reviewerStates.length > 0 && (
            <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700/50">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Reviewers
                </h2>
              </div>
              <div className="p-6 bg-white dark:bg-slate-800/50">
                <div className="space-y-3">
                  {reviewerStates.map((st: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-white">{st.email || `User #${st.id}`}</div>
                          {st.decided_at && <div className="text-xs text-slate-500">{new Date(st.decided_at).toLocaleString()}</div>}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 ${getStatusColor(st.status || 'pending')}`}>
                        {getStatusIcon(st.status || 'pending')}
                        {(st.status || 'pending').charAt(0).toUpperCase() + (st.status || 'pending').slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Actions & Comments */}
        <div className="space-y-6">
          {/* Actions Card */}
          {change && me && (() => {
            const idsFromStates: number[] = Array.isArray(reviewerStates) ? reviewerStates.map((s: any) => Number(s.id)).filter(Boolean) : []
            const isAssigned = (change.reviewer_id && me.id === change.reviewer_id) || idsFromStates.includes(me.id)
            return change.status === 'pending' && (isAssigned || isApprover)
          })() && (
              <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
                <div className="p-6">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Actions</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={async () => { try { await approveChange(projectId, chId); location.reload() } catch (e: any) { setError(e.message) } }}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/30 hover:-translate-y-0.5"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={async () => { try { await rejectChange(projectId, chId); location.reload() } catch (e: any) { setError(e.message) } }}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-500/20 hover:shadow-red-500/30 hover:-translate-y-0.5"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </Card>
            )}

          {/* Comments Card */}
          <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col h-[500px]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Comments
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                  No comments yet. Start the discussion!
                </div>
              ) : (
                comments.map((cm) => {
                  const name = (cm as any).user_name as string | undefined
                  const email = (cm as any).user_email as string | undefined
                  const identity = [name, email].filter(Boolean).join(' • ') || email || name || 'Unknown user'
                  const createdAt = (cm as any).created_at || (cm as any).CreatedAt || Date.now()
                  return (
                    <div key={cm.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex-shrink-0 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                        {(name || email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-900 dark:text-white">{identity}</span>
                            <span className="text-[10px] text-slate-400">{new Date(createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{(cm as any).body}</p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
              <div className="relative">
                <textarea
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm resize-none"
                  rows={2}
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
                <button
                  className="absolute right-2 bottom-2 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!comment.trim()}
                  onClick={async () => {
                    if (!comment.trim()) return
                    try {
                      const r = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) })
                      setComments([...comments, r]); setComment('')
                    } catch (e: any) { setError(e.message) }
                  }}
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <AgGridDialog
        open={open}
        onOpenChange={setOpen}
        title={`Change #${chId} preview`}
        rows={preview?.data || []}
        columns={preview?.columns || []}
        pageSize={50}
        allowEdit={false}
        compact={false}
        editedCells={editedCells}
      />

      {showSuccess && (
        <div role="alert" className="fixed bottom-6 right-6 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl shadow-green-900/20 text-sm font-medium animate-in slide-in-from-bottom-6 flex items-center gap-3">
          <CheckCircle className="w-5 h-5" />
          <div>
            Change request approved successfully!
            <div className="text-green-100 text-xs mt-0.5">The data has been appended to the dataset.</div>
          </div>
          <button className="ml-4 text-white/80 hover:text-white" onClick={() => setShowSuccess(false)} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

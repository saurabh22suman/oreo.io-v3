import { useEffect, useState, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { getProject, currentUser, approveChange, rejectChange, myProjectRole, subscribeNotifications } from '../api'
import AgGridTable from '../components/AgGridTable'
import Alert from '../components/Alert'
import Card from '../components/Card'
import { 
  CheckCircle, 
  XCircle, 
  MessageSquare, 
  FileText, 
  User, 
  Clock, 
  AlertCircle, 
  GitPullRequest, 
  ArrowUpRight, 
  ArrowRight,
  Check, 
  X,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Send,
  Loader2
} from 'lucide-react'

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
  const navigate = useNavigate()
  
  const [project, setProject] = useState<any>(null)
  const [change, setChange] = useState<any>(null)
  const [reviewerStates, setReviewerStates] = useState<any[] | null>(null)
  const [preview, setPreview] = useState<{ data: any[]; columns: string[]; type?: string; edited_cells?: any[]; deleted_rows?: string[]; edit_count?: number; delete_count?: number } | null>(null)
  const [comments, setComments] = useState<any[]>([])
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [me, setMe] = useState<{ id: number; email: string } | null>(null)
  const [isApprover, setIsApprover] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        setProject(await getProject(projectId))
        const meInfo = await currentUser().catch(() => null as any)
        if (meInfo?.id) setMe({ id: meInfo.id, email: meInfo.email })
        try { await myProjectRole(projectId); setIsApprover(false) } catch { }
        const ch = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}`)
        const base = ch?.change || ch
        setChange({ ...base, requestor_email: ch?.requestor_email, requestor_name: ch?.requestor_name })
        if (ch?.reviewer_states) setReviewerStates(ch.reviewer_states as any[])
        try { const pv = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}/preview`); setPreview(pv) } catch { }
        try { const cs = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}/comments`); setComments(cs) } catch { }
      } catch (e: any) { setError(e.message) } finally {
        setLoading(false)
      }
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
      case 'approved': return 'bg-success/10 text-success border-success/20'
      case 'rejected': return 'bg-error/10 text-error border-error/20'
      case 'withdrawn': return 'bg-surface-3 text-text-secondary border-divider'
      default: return 'bg-primary/10 text-primary border-primary/20'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />
      case 'rejected': return <XCircle className="w-4 h-4" />
      case 'withdrawn': return <XCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-surface-2 animate-fade-in">
      {error && (
        <div className="fixed top-4 right-4 z-50">
          <Alert type="error" message={error} onClose={() => setError('')} />
        </div>
      )}
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Alert type="success" message={toast} onClose={() => setToast('')} autoDismiss={true} />
        </div>
      )}

      {/* Header Section */}
      <div className="bg-surface-1/50 backdrop-blur-sm border-b border-divider z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/projects/${projectId}/datasets/${dsId}/approvals`} className="p-2 rounded-full hover:bg-surface-2 text-text-secondary hover:text-text transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="h-6 w-px bg-divider" />
            <h1 className="text-xl font-bold text-text font-display">
              {change?.title || `Change #${chId}`}
            </h1>
            {change && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-2 ${getStatusColor(change.status)}`}>
                {getStatusIcon(change.status)}
                {change.status}
              </span>
            )}
          </div>

          {/* Actions */}
          {change && me && (() => {
            const idsFromStates: number[] = Array.isArray(reviewerStates) ? reviewerStates.map((s: any) => Number(s.id)).filter(Boolean) : []
            const isAssigned = (change.reviewer_id && me.id === change.reviewer_id) || idsFromStates.includes(me.id)
            return change.status === 'pending' && (isAssigned || isApprover)
          })() && (
            <div className="flex items-center gap-3">
              <button
                onClick={async () => { try { await rejectChange(projectId, chId); location.reload() } catch (e: any) { setError(e.message) } }}
                className="flex items-center gap-2 px-4 py-2 bg-error/10 hover:bg-error text-error hover:text-white font-bold rounded-xl transition-all border border-error/20 hover:border-error shadow-sm text-sm"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
              <button
                onClick={async () => { 
                  try { 
                    const result = await approveChange(projectId, chId)
                    if (result?.duplicates > 0) {
                      setToast(`Approved: ${result.inserted} rows inserted, ${result.duplicates} duplicate rows skipped`)
                    } else if (result?.inserted > 0) {
                      setToast(`Approved: ${result.inserted} rows inserted`)
                    } else {
                      setToast('Change approved successfully')
                    }
                    setTimeout(() => location.reload(), 2000)
                  } catch (e: any) { setError(e.message) } 
                }}
                className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success-hover text-white font-bold rounded-xl transition-all shadow-lg shadow-success/20 hover:shadow-success/30 hover:-translate-y-0.5 text-sm"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Left Column: Details & Preview */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          {/* Data Preview Card */}
          <div className="bg-surface-1 rounded-3xl border border-divider shadow-lg shadow-black/5 overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="p-6 border-b border-divider flex items-center justify-between bg-surface-1/50 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-text flex items-center gap-2 font-display">
                <FileText className="w-5 h-5 text-primary" />
                {(preview as any)?.type === 'live_edit' ? 'Changes Preview' : 'Data Preview'}
                {preview && preview.data.length > 0 && (
                  <span className="text-xs font-bold text-text-secondary uppercase tracking-wider ml-2 px-2 py-0.5 rounded bg-surface-2 border border-divider">
                    {(preview as any)?.type === 'live_edit' 
                      ? `${(preview as any)?.edit_count || 0} edits, ${(preview as any)?.delete_count || 0} deletions`
                      : `${preview.data.length} rows`
                    }
                  </span>
                )}
              </h2>
              {preview && preview.data.length > 0 && (
                <button
                  onClick={() => window.open(`/projects/${projectId}/datasets/${dsId}/view`, '_blank')}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-hover hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  View Full Data
                </button>
              )}
            </div>
            <div className="flex-1 bg-surface-1 p-0 overflow-hidden relative">
              {preview && (preview as any)?.type === 'live_edit' ? (
                /* Live Edit Preview - show actual row data with edits highlighted */
                <div className="h-full flex flex-col">
                  {/* Show AG Grid if we have row data */}
                  {(preview as any)?.data?.length > 0 ? (() => {
                    // Transform data to include Type column and properly order columns
                    const editedCellsRaw = (preview as any)?.edited_cells || []
                    const deletedRowsRaw = (preview as any)?.deleted_rows || []
                    const deletedRowSet = new Set(deletedRowsRaw.map((id: string) => parseInt(id, 10)))
                    
                    // Build a map of row_id -> set of edited columns
                    const editedRowsMap = new Map<number, Set<string>>()
                    for (const edit of editedCellsRaw) {
                      const rowId = parseInt(String(edit.row_id), 10)
                      if (!editedRowsMap.has(rowId)) {
                        editedRowsMap.set(rowId, new Set())
                      }
                      editedRowsMap.get(rowId)?.add(edit.column)
                    }
                    
                    // Transform rows to add _change_type column
                    const transformedRows = (preview as any).data.map((row: any) => {
                      const rowId = row._row_id
                      let changeType = 'Edited'
                      if (deletedRowSet.has(rowId)) {
                        changeType = 'Deleted'
                      }
                      return {
                        _change_type: changeType,
                        _row_id: rowId,
                        ...row
                      }
                    })
                    
                    // Order columns: _change_type, _row_id, then rest
                    const originalColumns = (preview as any).columns || []
                    const orderedColumns = ['_change_type', '_row_id', ...originalColumns.filter((c: string) => c !== '_row_id')]
                    
                    // Convert edited_cells to match row index in transformedRows
                    const editedCellsForGrid = editedCellsRaw.map((edit: any) => {
                      const rowId = parseInt(String(edit.row_id), 10)
                      // Find the index in transformedRows
                      const rowIndex = transformedRows.findIndex((r: any) => r._row_id === rowId)
                      return {
                        rowIndex: rowIndex >= 0 ? rowIndex : rowId,
                        column: edit.column,
                        oldValue: edit.old_value,
                        newValue: edit.new_value
                      }
                    })
                    
                    // Build deletedRowIds based on index in transformedRows
                    const deletedRowIndices = new Set<number>()
                    transformedRows.forEach((row: any, idx: number) => {
                      if (deletedRowSet.has(row._row_id)) {
                        deletedRowIndices.add(idx)
                      }
                    })
                    
                    return (
                      <AgGridTable
                        rows={transformedRows}
                        columns={orderedColumns}
                        pageSize={50}
                        allowEdit={false}
                        compact={false}
                        editedCells={editedCellsForGrid}
                        deletedRowIds={deletedRowIndices}
                        className="h-full border-0 rounded-none"
                        title=""
                      />
                    )
                  })() : (
                    /* Fallback: show changes summary if no row data available */
                    <div className="h-full overflow-auto p-6 space-y-6 custom-scrollbar">
                      {/* Edited Cells Section */}
                      {(preview as any)?.edited_cells?.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                            Cell Edits ({(preview as any).edited_cells.length})
                          </h3>
                          <div className="space-y-3">
                            {(preview as any).edited_cells.map((edit: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors">
                                <div className="text-xs text-text-secondary font-bold font-mono uppercase tracking-wider min-w-[80px]">Row {edit.row_id}</div>
                                <div className="text-sm font-bold text-text min-w-[120px]">{edit.column}</div>
                                <div className="flex items-center gap-3 ml-auto bg-surface-1 px-3 py-1.5 rounded-lg border border-divider">
                                  <span className="text-error line-through text-sm font-mono opacity-70">{String(edit.old_value ?? '')}</span>
                                  <ArrowRight className="w-3 h-3 text-text-muted" />
                                  <span className="text-success font-bold text-sm font-mono">{String(edit.new_value ?? '')}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Deleted Rows Section */}
                      {(preview as any)?.deleted_rows?.length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-error"></div>
                            Row Deletions ({(preview as any).deleted_rows.length})
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {(preview as any).deleted_rows.map((rowId: string, idx: number) => (
                              <span key={idx} className="px-3 py-1.5 rounded-lg bg-error/10 border border-error/20 text-error text-xs font-bold font-mono uppercase tracking-wider">
                                Row {rowId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {(preview as any)?.edited_cells?.length === 0 && (preview as any)?.deleted_rows?.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-text-muted">
                          <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4">
                            <CheckCircle className="w-8 h-8 text-success opacity-50" />
                          </div>
                          <span className="font-medium">No changes in this request</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : preview ? (
                <AgGridTable
                  rows={preview.data}
                  columns={preview.columns}
                  pageSize={50}
                  allowEdit={false}
                  compact={false}
                  editedCells={editedCells}
                  className="h-full border-0 rounded-none"
                  title=""
                />
              ) : (
                <div className="h-full flex items-center justify-center text-text-muted">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center">
                      <FileText className="w-8 h-8 opacity-50" />
                    </div>
                    <span className="text-lg font-medium">No preview available</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Reviewers & Comments */}
        <div className="space-y-6 flex flex-col min-h-0">
          {/* Reviewer Status Card */}
          {Array.isArray(reviewerStates) && reviewerStates.length > 0 && (
            <div className="bg-surface-1 rounded-3xl border border-divider shadow-lg shadow-black/5 overflow-hidden flex-shrink-0">
              <div className="p-6 border-b border-divider bg-surface-1/50 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-text flex items-center gap-2 font-display">
                  <User className="w-5 h-5 text-primary" />
                  Reviewers
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {reviewerStates.map((st: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-surface-2/50 border border-divider hover:bg-surface-2 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center text-text-secondary border border-divider shadow-sm">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-text">{st.email || `User #${st.id}`}</div>
                          {st.decided_at && (
                            <div className="text-xs text-text-secondary flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {new Date(st.decided_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border ${getStatusColor(st.status || 'pending')}`}>
                        {getStatusIcon(st.status || 'pending')}
                        {st.status || 'pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Comments Card */}
          <div className="bg-surface-1 rounded-3xl border border-divider shadow-lg shadow-black/5 overflow-hidden flex flex-col flex-1 min-h-[400px]">
            <div className="p-6 border-b border-divider bg-surface-1/50 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-text flex items-center gap-2 font-display">
                <MessageSquare className="w-5 h-5 text-primary" />
                Comments
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface-1 custom-scrollbar">
              {comments.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center justify-center h-full">
                  <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-text-muted" />
                  </div>
                  <p className="text-text font-bold mb-1">No comments yet</p>
                  <p className="text-text-secondary text-sm">Start the discussion by adding a comment below.</p>
                </div>
              ) : (
                comments.map((cm) => {
                  const name = (cm as any).user_name as string | undefined
                  const email = (cm as any).user_email as string | undefined
                  const identity = [name, email].filter(Boolean).join(' • ') || email || name || 'Unknown user'
                  const createdAt = (cm as any).created_at || (cm as any).CreatedAt || Date.now()
                  return (
                    <div key={cm.id} className="flex gap-4 group">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex-shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-md">
                        {(name || email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-text">{identity}</span>
                          <span className="text-xs text-text-secondary">•</span>
                          <span className="text-xs text-text-secondary">{new Date(createdAt).toLocaleString()}</span>
                        </div>
                        <div className="bg-surface-2 p-4 rounded-2xl rounded-tl-none border border-divider shadow-sm group-hover:shadow-md transition-shadow">
                          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{(cm as any).body}</p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div className="p-4 bg-surface-1 border-t border-divider">
              <div className="relative">
                <textarea
                  className="w-full pl-4 pr-12 py-4 bg-surface-2 border border-divider rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm resize-none text-text placeholder:text-text-muted shadow-inner"
                  rows={3}
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (comment.trim()) {
                        const btn = document.getElementById('send-comment-btn')
                        btn?.click()
                      }
                    }
                  }}
                />
                <button
                  id="send-comment-btn"
                  className="absolute right-3 bottom-3 p-2 bg-primary hover:bg-primary-hover text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5"
                  disabled={!comment.trim()}
                  onClick={async () => {
                    if (!comment.trim()) return
                    try {
                      const r = await fetchJSON(`${API_BASE}/projects/${projectId}/changes/${chId}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) })
                      setComments([...comments, r]); setComment('')
                    } catch (e: any) { setError(e.message) }
                  }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-text-muted mt-2 text-right px-2">Press Enter to send, Shift+Enter for new line</p>
            </div>
          </div>
        </div>
      </div>

      {showSuccess && (
        <div role="alert" className="fixed bottom-6 right-6 bg-surface-1 border border-success/20 px-6 py-4 rounded-2xl shadow-2xl shadow-success/10 text-sm font-medium animate-in slide-in-from-bottom-6 flex items-center gap-4 z-50 max-w-md">
          <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-6 h-6 text-success" />
          </div>
          <div className="flex-1">
            <h4 className="text-success font-bold text-base mb-0.5">Change Approved!</h4>
            <p className="text-text-secondary text-xs">The data has been successfully appended to the dataset.</p>
          </div>
          <button 
            className="p-2 hover:bg-surface-2 rounded-full transition-colors text-text-secondary hover:text-text" 
            onClick={() => setShowSuccess(false)} 
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
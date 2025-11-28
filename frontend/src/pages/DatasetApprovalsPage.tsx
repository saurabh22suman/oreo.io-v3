import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { approveChange, getProject, rejectChange, currentUser, myProjectRole, listDatasetApprovalsTop } from '../api'
import Alert from '../components/Alert'
import Card from '../components/Card'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Filter, 
  ArrowRight, 
  GitPullRequest, 
  Check, 
  X, 
  FileText, 
  ArrowLeft,
  ChevronRight,
  User,
  Calendar,
  Shield,
  Loader2,
  FileWarning
} from 'lucide-react'

export default function DatasetApprovalsPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const [project, setProject] = useState<any>(null)
  const [changes, setChanges] = useState<any[]>([])
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [me, setMe] = useState<{ id: number; email: string } | null>(null)
  const [isApprover, setIsApprover] = useState(false)
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'withdrawn' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try {
      setProject(await getProject(projectId))
      setChanges(await listDatasetApprovalsTop(dsId, status))
      const meInfo = await currentUser().catch(() => null as any)
      if (meInfo?.id) setMe({ id: meInfo.id, email: meInfo.email })
      try { await myProjectRole(projectId); setIsApprover(false) } catch { }
    } catch (e: any) { setError(e.message) } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [projectId, dsId, status])

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
      case 'approved': return <CheckCircle className="w-3.5 h-3.5" />
      case 'rejected': return <XCircle className="w-3.5 h-3.5" />
      case 'withdrawn': return <XCircle className="w-3.5 h-3.5" />
      default: return <Clock className="w-3.5 h-3.5" />
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
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
      <div className="bg-surface-1/50 backdrop-blur-sm border-b border-divider sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/projects/${projectId}/datasets/${dsId}`} className="p-2 rounded-full hover:bg-surface-2 text-text-secondary hover:text-text transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="h-6 w-px bg-divider" />
            <h1 className="text-xl font-bold text-text font-display">Change Requests</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 bg-surface-1 rounded-xl p-1 border border-divider shadow-sm">
            {['pending', 'approved', 'rejected', 'withdrawn', 'all'].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s as any)}
                className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                  status === s 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-text-secondary hover:text-text hover:bg-surface-2'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-surface-1 rounded-3xl border border-divider shadow-lg shadow-black/5 overflow-hidden">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : changes.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-surface-2 flex items-center justify-center mb-6">
                <GitPullRequest className="w-10 h-10 text-text-muted" />
              </div>
              <h3 className="text-xl font-bold text-text mb-2 font-display">No Requests Found</h3>
              <p className="text-text-secondary text-lg max-w-md">
                There are no {status !== 'all' ? status : ''} change requests for this dataset at the moment.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-2/50 border-b border-divider">
                    <th className="py-5 px-8 text-xs font-bold text-text-secondary uppercase tracking-wider">Request</th>
                    <th className="py-5 px-8 text-xs font-bold text-text-secondary uppercase tracking-wider">Author</th>
                    <th className="py-5 px-8 text-xs font-bold text-text-secondary uppercase tracking-wider">Status</th>
                    <th className="py-5 px-8 text-xs font-bold text-text-secondary uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {changes.map((ch) => (
                    <tr
                      key={ch.id}
                      onClick={() => navigate(`/projects/${projectId}/datasets/${dsId}/changes/${ch.id}`)}
                      className="group hover:bg-surface-2/50 transition-colors cursor-pointer"
                    >
                      <td className="py-5 px-8">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-text-secondary font-mono">#{ch.id}</span>
                              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-text-secondary border border-divider">
                                {ch.type}
                              </span>
                            </div>
                            <div className="font-bold text-text text-lg group-hover:text-primary transition-colors">
                              {ch.title || `Change Request #${ch.id}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-8">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center text-text-secondary border border-divider">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-text">{ch.created_by?.replace('user_', 'User #') || 'Unknown'}</div>
                            <div className="text-xs text-text-secondary flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(ch.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-8">
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${getStatusColor(ch.status)}`}>
                          {getStatusIcon(ch.status)}
                          {ch.status}
                        </span>
                      </td>
                      <td className="py-5 px-8 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => navigate(`/projects/${projectId}/datasets/${dsId}/changes/${ch.id}`)}
                            className="p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="View Details"
                          >
                            <ArrowRight className="w-5 h-5" />
                          </button>

                          {ch.status === 'pending' && me && (() => {
                            let ids: number[] = []
                            try { if (typeof (ch as any).reviewers === 'string' && (ch as any).reviewers.trim().startsWith('[')) ids = JSON.parse((ch as any).reviewers) } catch { }
                            const isAssigned = (ch.reviewer_id && me.id === ch.reviewer_id) || ids.includes(me.id)
                            return isAssigned || isApprover
                          })() && (
                              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-divider">
                                <button
                                  onClick={async (e) => { 
                                    e.stopPropagation()
                                    try { 
                                      const result = await approveChange(projectId, ch.id)
                                      await load()
                                      if (result?.duplicates > 0) {
                                        setToast(`Approved: ${result.inserted} rows inserted, ${result.duplicates} duplicate rows skipped`)
                                      } else if (result?.inserted > 0) {
                                        setToast(`Approved: ${result.inserted} rows inserted`)
                                      } else {
                                        setToast('Change approved')
                                      }
                                    } catch (err: any) { setError(err.message) } 
                                  }}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success hover:bg-success hover:text-white border border-success/20 rounded-lg transition-all font-bold text-xs uppercase tracking-wider"
                                  title="Approve"
                                >
                                  <Check className="w-4 h-4" />
                                  Approve
                                </button>
                                <button
                                  onClick={async (e) => { e.stopPropagation(); try { await rejectChange(projectId, ch.id); await load(); setToast('Change rejected') } catch (err: any) { setError(err.message) } }}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-error/10 text-error hover:bg-error hover:text-white border border-error/20 rounded-lg transition-all font-bold text-xs uppercase tracking-wider"
                                  title="Reject"
                                >
                                  <X className="w-4 h-4" />
                                  Reject
                                </button>
                              </div>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
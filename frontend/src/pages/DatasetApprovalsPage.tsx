import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { approveChange, getProject, rejectChange, currentUser, myProjectRole, listDatasetApprovalsTop } from '../api'
import Alert from '../components/Alert'
import Card from '../components/Card'
import { CheckCircle, XCircle, Clock, Filter, ArrowRight, GitPullRequest, Check, X, FileText } from 'lucide-react'

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
  const navigate = useNavigate()

  async function load() {
    try {
      setProject(await getProject(projectId))
      setChanges(await listDatasetApprovalsTop(dsId, status))
      const meInfo = await currentUser().catch(() => null as any)
      if (meInfo?.id) setMe({ id: meInfo.id, email: meInfo.email })
      try { await myProjectRole(projectId); setIsApprover(false) } catch { }
    } catch (e: any) { setError(e.message) }
  }
  useEffect(() => { load() }, [projectId, dsId, status])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      case 'withdrawn': return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl shadow-slate-900/20">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold border border-white/10 text-blue-200">
              Dataset Approvals
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-3 tracking-tight">Change Requests</h1>
          <p className="text-slate-300 max-w-md text-sm leading-relaxed">
            Review and manage change requests for this dataset. Approve or reject pending changes to maintain data integrity.
          </p>
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            className="pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
            value={status}
            onChange={e => setStatus(e.target.value as any)}
          >
            <option value="pending">Pending Requests</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="all">All Requests</option>
          </select>
        </div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {toast && <Alert type="success" message={toast} onClose={() => setToast('')} autoDismiss={true} />}

      <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-white dark:bg-slate-800/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-primary" />
            {status === 'all' ? 'All Requests' : `${status.charAt(0).toUpperCase() + status.slice(1)} Requests`}
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 font-medium">
              {changes.length}
            </span>
          </h2>
        </div>

        {changes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No {status !== 'all' ? status : ''} change requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title / Type</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {changes.map((ch) => (
                  <tr
                    key={ch.id}
                    onClick={() => navigate(`/projects/${projectId}/datasets/${dsId}/changes/${ch.id}`)}
                    className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <td className="py-4 px-6 text-sm font-mono text-slate-500">#{ch.id}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                            {ch.title || ch.type}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${getStatusColor(ch.status)}`}>
                        {getStatusIcon(ch.status)}
                        {ch.status.charAt(0).toUpperCase() + ch.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/projects/${projectId}/datasets/${dsId}/changes/${ch.id}`)}
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                          title="View Details"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>

                        {ch.status === 'pending' && me && (() => {
                          let ids: number[] = []
                          try { if (typeof (ch as any).reviewers === 'string' && (ch as any).reviewers.trim().startsWith('[')) ids = JSON.parse((ch as any).reviewers) } catch { }
                          const isAssigned = (ch.reviewer_id && me.id === ch.reviewer_id) || ids.includes(me.id)
                          return isAssigned || isApprover
                        })() && (
                            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                              <button
                                onClick={async (e) => { e.stopPropagation(); try { await approveChange(projectId, ch.id); await load(); setToast('Change approved') } catch (err: any) { setError(err.message) } }}
                                className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={async (e) => { e.stopPropagation(); try { await rejectChange(projectId, ch.id); await load(); setToast('Change rejected') } catch (err: any) { setError(err.message) } }}
                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
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
      </Card>
    </div>
  )
}

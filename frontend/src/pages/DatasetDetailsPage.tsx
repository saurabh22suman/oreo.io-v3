import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getDataset, getDatasetStatsTop, getProject, listDatasetApprovalsTop, myProjectRole, subscribeNotifications } from '../api'
import Alert from '../components/Alert'
import { Database, Eye, Plus, Atom, Settings, Clock, Table2, BarChart3, FileCheck, ArrowRight, Terminal } from 'lucide-react'

type Dataset = { id: number; name: string; schema?: string; rules?: string; last_upload_path?: string; last_upload_at?: string }

type Change = { id: number; type: string; status: string; title?: string; created_at?: string; user_id?: number; reviewer_id?: number }
type Member = { id: number; email: string; role: 'owner' | 'contributor' | 'viewer' }

export default function DatasetDetailsPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const nav = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [stats, setStats] = useState<{ row_count?: number; column_count?: number; owner_name?: string; table_location?: string; last_update_at?: string } | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [role, setRole] = useState<'owner' | 'contributor' | 'viewer' | null>(null)
  const [pending, setPending] = useState<any[]>([])


  useEffect(() => {
    (async () => {
      try {
        setProject(await getProject(projectId))
        const ds = await getDataset(projectId, dsId); setDataset(ds)
        try { setStats(await getDatasetStatsTop(dsId)) } catch { }
        try { const r = await myProjectRole(projectId); setRole(r.role) } catch { }
        try { setPending(await listDatasetApprovalsTop(dsId, 'pending')) } catch { }
      } catch (e: any) { setError(e.message) }
    })()
  }, [projectId, dsId])

  useEffect(() => {
    // Live-update stats on approval notifications
    const unsub = subscribeNotifications(async (evt) => {
      if (evt?.type === 'change_approved' && Number(evt?.dataset_id) === dsId) {
        try { setStats(await getDatasetStatsTop(dsId)) } catch { }
      }
    })
    return () => { try { unsub() } catch { } }
  }, [dsId])

  const owner = useMemo(() => stats?.owner_name || project?.owner_email || project?.owner || '', [stats, project])

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {toast && <Alert type="success" message={toast} onClose={() => setToast('')} autoDismiss={true} />}

      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl shadow-slate-900/20">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold border border-white/10 text-blue-200">
              <span className="opacity-70">{project?.name || 'Project'}</span>
            </span>
          </div>

          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 backdrop-blur-md">
                  <Database className="w-8 h-8 text-blue-300" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold mb-1 tracking-tight">{dataset?.name || `Dataset #${dsId}`}</h1>
                  <p className="text-slate-300 text-sm">
                    {stats?.table_location || 'Loading...'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Rows</div>
                  <div className="text-2xl font-bold">{(stats?.row_count ?? 0).toLocaleString()}</div>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-400 opacity-50" />
              </div>
            </div>

            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Columns</div>
                  <div className="text-2xl font-bold">{(stats?.column_count ?? 0).toLocaleString()}</div>
                </div>
                <Table2 className="w-8 h-8 text-purple-400 opacity-50" />
              </div>
            </div>

            <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Pending Approvals</div>
                  <div className="text-2xl font-bold">{pending.length}</div>
                </div>
                <FileCheck className="w-8 h-8 text-blue-400 opacity-50" />
              </div>
            </div>
          </div>
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <ActionCard
          to={`/projects/${projectId}/datasets/${dsId}/view`}
          icon={<Eye className="w-8 h-8" />}
          title="View Data"
          description="Browse and explore dataset"
        />

        <ActionCard
          to={`/projects/${projectId}/datasets/${dsId}/append`}
          icon={<Plus className="w-8 h-8" />}
          title="Append Data"
          description={role === 'viewer' ? 'Requires contributor role' : 'Upload and submit changes'}
          disabled={role === 'viewer'}
        />

        <ActionCard
          to={`/projects/${projectId}/labs?dataset=${dsId}`}
          icon={<Terminal className="w-8 h-8" />}
          title="Experimental"
          description="Explore beta features"
        />

        <ActionCard
          to={`/projects/${projectId}/datasets/${dsId}/settings`}
          icon={<Settings className="w-8 h-8" />}
          title="Settings"
          description="Configure and manage"
        />
      </div>

      {/* Pending Approvals Section */}
      {pending.length > 0 && (
        <div className="bg-[#0f172a] rounded-3xl shadow-lg border border-slate-800 overflow-hidden">
          <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800 shadow-sm">
                <FileCheck className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Pending Approvals</h3>
                <p className="text-xs text-slate-400">{pending.length} change{pending.length !== 1 ? 's' : ''} awaiting review</p>
              </div>
            </div>
            <Link
              to={`/projects/${projectId}/datasets/${dsId}/approvals`}
              className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 group no-underline"
            >
              View all
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <ul className="divide-y divide-slate-800">
            {pending.slice(0, 5).map((ch: any) => (
              <li key={ch.id} className="p-4 hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white">{ch.title || ch.type}</span>
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-900/30 text-blue-300 rounded-full border border-blue-800">
                        #{ch.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      Submitted {ch.created_at ? new Date(ch.created_at).toLocaleString() : ''}
                    </div>
                  </div>
                  <Link
                    to={`/projects/${projectId}/datasets/${dsId}/changes/${ch.id}`}
                    className="px-4 py-2 text-sm font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-lg transition-all no-underline"
                  >
                    Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pending.length === 0 && (
        <div className="bg-[#0f172a] rounded-3xl shadow-lg border border-slate-800 p-8 text-center">
          <div className="inline-flex p-4 rounded-full bg-slate-900 mb-4">
            <FileCheck className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">All Clear!</h3>
          <p className="text-sm text-slate-400">There are no pending approvals at this time.</p>
        </div>
      )}
    </div>
  )
}

function ActionCard({ to, icon, title, description, disabled }: {
  to: string
  icon: React.ReactNode
  title: string
  description: string
  disabled?: boolean
}) {
  const Cmp: any = disabled ? 'div' : Link

  return (
    <Cmp
      to={disabled ? undefined : to}
      className={`group relative overflow-hidden rounded-3xl bg-[#0f172a] shadow-lg border border-slate-800 p-6 transition-all duration-300 no-underline ${disabled
        ? 'opacity-50 cursor-not-allowed'
        : 'hover:shadow-xl hover:-translate-y-1 hover:border-slate-700'
        }`}
      title={disabled ? description : undefined}
      aria-disabled={disabled}
    >
      <div className={`absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 ${!disabled && 'group-hover:opacity-100'} transition-opacity duration-300`} />

      <div className="relative z-10">
        <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white mb-4 shadow-lg`}>
          {icon}
        </div>

        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
        <p className="text-sm text-slate-400">{description}</p>

        {!disabled && (
          <div className="mt-4 flex items-center text-sm font-semibold text-blue-400 group-hover:text-blue-300">
            Open
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        )}
      </div>
    </Cmp>
  )
}

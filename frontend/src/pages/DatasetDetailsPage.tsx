import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getDataset, getDatasetStatsTop, getProject, listDatasetApprovalsTop, myProjectRole, subscribeNotifications } from '../api'
import Alert from '../components/Alert'
import { Database, Eye, Plus, Atom, Settings, Clock, Table2, BarChart3, FileCheck, ArrowRight, Terminal, ChevronRight } from 'lucide-react'

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
    <div className="space-y-8 animate-fade-in pb-12">
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {toast && <Alert type="success" message={toast} onClose={() => setToast('')} autoDismiss={true} />}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span className="cursor-pointer hover:text-primary transition-colors" onClick={() => nav(`/projects/${projectId}/datasets`)}>Datasets</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-text font-medium">{dataset?.name || 'Loading...'}</span>
      </div>

      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-surface-1/50 backdrop-blur-sm border border-divider p-8 shadow-lg shadow-black/5">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-xs font-bold border border-primary/20 text-primary shadow-sm">
              <span className="opacity-90">{project?.name || 'Project'}</span>
            </span>
            {stats?.last_update_at && (
              <span className="text-xs text-text-secondary flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {new Date(stats.last_update_at).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-5 mb-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner border border-primary/10">
                  <Database className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold mb-1 tracking-tight text-text font-display">{dataset?.name || `Dataset #${dsId}`}</h1>
                  <p className="text-text-secondary text-sm font-mono bg-surface-2/50 px-2 py-0.5 rounded border border-divider inline-block">
                    {stats?.table_location || 'Loading...'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-2/50 border border-divider rounded-3xl p-5 hover:bg-surface-2 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-secondary text-xs uppercase tracking-wider font-bold mb-1">Total Rows</div>
                  <div className="text-3xl font-bold text-text font-display">{(stats?.row_count ?? 0).toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                  <BarChart3 className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-surface-2/50 border border-divider rounded-3xl p-5 hover:bg-surface-2 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-secondary text-xs uppercase tracking-wider font-bold mb-1">Columns</div>
                  <div className="text-3xl font-bold text-text font-display">{(stats?.column_count ?? 0).toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-xl bg-secondary/10 text-secondary">
                  <Table2 className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-surface-2/50 border border-divider rounded-3xl p-5 hover:bg-surface-2 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-secondary text-xs uppercase tracking-wider font-bold mb-1">Pending Approvals</div>
                  <div className="text-3xl font-bold text-text font-display">{pending.length}</div>
                </div>
                <div className={`p-3 rounded-xl ${pending.length > 0 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                  <FileCheck className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionCard
          to={`/projects/${projectId}/datasets/${dsId}/view`}
          icon={<Eye className="w-6 h-6" />}
          title="View Data"
          description="Browse and explore dataset"
          color="primary"
        />

        <ActionCard
          to={`/projects/${projectId}/datasets/${dsId}/append`}
          icon={<Plus className="w-6 h-6" />}
          title="Append Data"
          description={role === 'viewer' ? 'Requires contributor role' : 'Upload and submit changes'}
          disabled={role === 'viewer'}
          color="success"
        />

        <ActionCard
          to={`/projects/${projectId}/labs?dataset=${dsId}`}
          icon={<Terminal className="w-6 h-6" />}
          title="Experimental"
          description="Explore beta features"
          color="warning"
        />

        <ActionCard
          to={`/projects/${projectId}/datasets/${dsId}/settings`}
          icon={<Settings className="w-6 h-6" />}
          title="Settings"
          description="Configure and manage"
          color="secondary"
        />
      </div>

      {/* Pending Approvals Section */}
      {pending.length > 0 && (
        <div className="bg-surface-1 rounded-3xl shadow-lg shadow-black/5 border border-divider overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-surface-1/50 backdrop-blur-sm px-8 py-6 border-b border-divider flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center shadow-sm border border-warning/20">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-text text-lg">Pending Approvals</h3>
                <p className="text-sm text-text-secondary">{pending.length} change{pending.length !== 1 ? 's' : ''} awaiting review</p>
              </div>
            </div>
            <Link
              to={`/projects/${projectId}/datasets/${dsId}/approvals`}
              className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-sm font-bold text-primary transition-all flex items-center gap-2 group no-underline border border-divider hover:border-primary/30"
            >
              View all
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <ul className="divide-y divide-divider">
            {pending.slice(0, 5).map((ch: any) => (
              <li key={ch.id} className="p-6 hover:bg-surface-2/50 transition-colors group">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-text text-lg group-hover:text-primary transition-colors">{ch.title || ch.type}</span>
                      <span className="px-2.5 py-0.5 text-xs font-bold bg-primary/10 text-primary rounded-full border border-primary/20 shadow-sm">
                        #{ch.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-text-secondary">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        Submitted {ch.created_at ? new Date(ch.created_at).toLocaleString() : ''}
                      </span>
                      {ch.user_id && (
                        <span className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-text-muted"></div>
                          User #{ch.user_id}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    to={`/projects/${projectId}/datasets/${dsId}/changes/${ch.id}`}
                    className="px-5 py-2.5 text-sm font-bold text-primary bg-primary/5 hover:bg-primary hover:text-white rounded-xl transition-all no-underline shadow-sm hover:shadow-md hover:shadow-primary/20"
                  >
                    Review Change
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pending.length === 0 && (
        <div className="bg-surface-1 rounded-3xl shadow-lg shadow-black/5 border border-divider p-12 text-center">
          <div className="inline-flex p-6 rounded-full bg-surface-2 mb-6 shadow-inner">
            <FileCheck className="w-12 h-12 text-success/50" />
          </div>
          <h3 className="text-xl font-bold text-text mb-2 font-display">All Clear!</h3>
          <p className="text-text-secondary max-w-md mx-auto">There are no pending approvals at this time. All changes have been processed.</p>
        </div>
      )}
    </div>
  )
}

function ActionCard({ to, icon, title, description, disabled, color = 'primary' }: {
  to: string
  icon: React.ReactNode
  title: string
  description: string
  disabled?: boolean
  color?: string
}) {
  const Cmp: any = disabled ? 'div' : Link

  const colorClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white',
    success: 'bg-success/10 text-success group-hover:bg-success group-hover:text-white',
    warning: 'bg-warning/10 text-warning group-hover:bg-warning group-hover:text-white',
    secondary: 'bg-secondary/10 text-secondary group-hover:bg-secondary group-hover:text-white',
  }

  return (
    <Cmp
      to={disabled ? undefined : to}
      className={`group relative overflow-hidden rounded-3xl bg-surface-1 shadow-lg shadow-black/5 border border-divider p-6 transition-all duration-300 no-underline ${disabled
        ? 'opacity-50 cursor-not-allowed grayscale'
        : 'hover:shadow-xl hover:-translate-y-1 hover:border-primary/30'
        }`}
      title={disabled ? description : undefined}
      aria-disabled={disabled}
    >
      <div className="relative z-10 flex flex-col h-full">
        <div className={`inline-flex w-12 h-12 items-center justify-center rounded-2xl mb-4 transition-all duration-300 shadow-sm ${colorClasses[color] || colorClasses.primary}`}>
          {icon}
        </div>

        <h3 className="text-lg font-bold text-text mb-1 group-hover:text-primary transition-colors font-display">{title}</h3>
        <p className="text-sm text-text-secondary mb-4 flex-1">{description}</p>

        {!disabled && (
          <div className="flex items-center text-sm font-bold text-primary group-hover:translate-x-1 transition-transform mt-auto">
            Open
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        )}
      </div>
      
      {/* Hover Gradient */}
      {!disabled && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      )}
    </Cmp>
  )
}
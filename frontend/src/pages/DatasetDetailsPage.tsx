import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getDataset, getDatasetStatsTop, getProject, listDatasetApprovalsTop, myProjectRole, subscribeNotifications } from '../api'
import Alert from '../components/Alert'
import { Database, Eye, Plus, Settings, Clock, Table2, BarChart3, FileCheck, ArrowRight, Terminal, ChevronRight } from 'lucide-react'

type Dataset = { id: number; name: string; schema?: string; rules?: string; last_upload_path?: string; last_upload_at?: string }

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
    const unsub = subscribeNotifications(async (evt) => {
      if (evt?.type === 'change_approved' && Number(evt?.dataset_id) === dsId) {
        try { setStats(await getDatasetStatsTop(dsId)) } catch { }
      }
    })
    return () => { try { unsub() } catch { } }
  }, [dsId])

  return (
    <div className="space-y-6 pb-8">
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {toast && <Alert type="success" message={toast} onClose={() => setToast('')} autoDismiss={true} />}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-text-muted">
        <button onClick={() => nav(`/projects/${projectId}`)} className="hover:text-text-primary transition-colors">
          Datasets
        </button>
        <ChevronRight size={14} />
        <span className="text-text-primary">{dataset?.name || 'Loading...'}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Database size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">{dataset?.name || `Dataset #${dsId}`}</h1>
            <p className="text-sm text-text-muted font-mono mt-0.5">
              {stats?.table_location || 'Loading location...'}
            </p>
          </div>
        </div>
        {stats?.last_update_at && (
          <span className="text-xs text-text-muted flex items-center gap-1.5 bg-surface-2 px-2.5 py-1 rounded-md">
            <Clock size={12} />
            Updated {new Date(stats.last_update_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-2 border border-divider rounded-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted mb-1">Total Rows</p>
              <p className="text-2xl font-semibold text-text-primary">{(stats?.row_count ?? 0).toLocaleString()}</p>
            </div>
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 size={20} className="text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-surface-2 border border-divider rounded-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted mb-1">Columns</p>
              <p className="text-2xl font-semibold text-text-primary">{(stats?.column_count ?? 0).toLocaleString()}</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/10">
              <Table2 size={20} className="text-secondary" />
            </div>
          </div>
        </div>

        <div className="bg-surface-2 border border-divider rounded-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted mb-1">Pending Approvals</p>
              <p className="text-2xl font-semibold text-text-primary">{pending.length}</p>
            </div>
            <div className={`p-2 rounded-lg ${pending.length > 0 ? 'bg-warning/10' : 'bg-success/10'}`}>
              <FileCheck size={20} className={pending.length > 0 ? 'text-warning' : 'text-success'} />
            </div>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionCard
          to={`/projects/${projectId}/datasets/${dsId}/view`}
          icon={<Eye size={20} />}
          title="View Data"
          description="Browse dataset"
        />
        <ActionCard
          to={`/projects/${projectId}/datasets/${dsId}/append`}
          icon={<Plus size={20} />}
          title="Append Data"
          description={role === 'viewer' ? 'Requires contributor' : 'Upload changes'}
          disabled={role === 'viewer'}
        />
        <ActionCard
          to={`/projects/${projectId}/labs?dataset=${dsId}`}
          icon={<Terminal size={20} />}
          title="Experimental"
          description="Beta features"
        />
        <ActionCard
          to={`/projects/${projectId}/datasets/${dsId}/settings`}
          icon={<Settings size={20} />}
          title="Settings"
          description="Configure dataset"
        />
      </div>

      {/* Pending Approvals */}
      {pending.length > 0 && (
        <div className="bg-surface-2 border border-divider rounded-card overflow-hidden">
          <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-warning/10">
                <FileCheck size={16} className="text-warning" />
              </div>
              <div>
                <h3 className="font-medium text-text-primary text-sm">Pending Approvals</h3>
                <p className="text-xs text-text-muted">{pending.length} awaiting review</p>
              </div>
            </div>
            <Link
              to={`/projects/${projectId}/datasets/${dsId}/approvals`}
              className="text-sm text-primary hover:text-primary-hover flex items-center gap-1"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="divide-y divide-divider">
            {pending.slice(0, 5).map((ch: any) => (
              <div key={ch.id} className="px-4 py-3 flex items-center justify-between hover:bg-surface-3 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-text-primary text-sm">{ch.title || ch.type}</span>
                    <span className="text-xs text-text-muted">#{ch.id}</span>
                  </div>
                  <p className="text-xs text-text-muted flex items-center gap-1">
                    <Clock size={10} />
                    {ch.created_at ? new Date(ch.created_at).toLocaleString() : 'Unknown'}
                  </p>
                </div>
                <Link
                  to={`/projects/${projectId}/datasets/${dsId}/changes/${ch.id}`}
                  className="btn btn-sm text-xs"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {pending.length === 0 && (
        <div className="bg-surface-2 border border-divider rounded-card p-8 text-center">
          <div className="inline-flex p-3 rounded-xl bg-surface-3 mb-3">
            <FileCheck size={24} className="text-success" />
          </div>
          <h3 className="font-medium text-text-primary mb-1">All Clear</h3>
          <p className="text-sm text-text-muted">No pending approvals at this time.</p>
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
      className={`bg-surface-2 border border-divider rounded-card p-4 transition-all group ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:border-primary/30 hover:bg-surface-3'
      }`}
    >
      <div className="p-2 rounded-lg bg-surface-3 inline-block mb-3 group-hover:bg-primary/10 transition-colors">
        <span className="text-text-secondary group-hover:text-primary transition-colors">{icon}</span>
      </div>
      <h3 className="font-medium text-text-primary text-sm mb-0.5">{title}</h3>
      <p className="text-xs text-text-muted">{description}</p>
    </Cmp>
  )
}
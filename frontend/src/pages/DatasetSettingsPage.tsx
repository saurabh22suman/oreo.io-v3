import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteDataset, getDataset, getDatasetStatsTop, getProject, myProjectRole } from '../api'
import { DeleteConfirmationDialog } from '../components/ui/DeleteConfirmationDialog'
import Alert from '../components/Alert'
import { Settings, Database, User, Calendar, Table2, BarChart3, AlertTriangle, Trash2, Info, ChevronRight } from 'lucide-react'

export default function DatasetSettingsPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const nav = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<any>(null)
  const [stats, setStats] = useState<{ row_count?: number; column_count?: number; owner_name?: string; table_location?: string; last_update_at?: string } | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [role, setRole] = useState<'owner' | 'contributor' | 'viewer' | null>(null)

  useEffect(() => {
    (async () => {
      try {
        setProject(await getProject(projectId))
        const ds = await getDataset(projectId, dsId); setDataset(ds)
        try { setStats(await getDatasetStatsTop(dsId)) } catch { }
        try { const r = await myProjectRole(projectId); setRole(r.role) } catch { }
      } catch (e: any) { setError(e.message) }
    })()
  }, [projectId, dsId])



  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {toast && <Alert type="success" message={toast} onClose={() => setToast('')} autoDismiss={true} />}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span className="cursor-pointer hover:text-primary transition-colors" onClick={() => nav(`/projects/${projectId}/datasets`)}>Datasets</span>
        <ChevronRight className="w-4 h-4" />
        <span className="cursor-pointer hover:text-primary transition-colors" onClick={() => nav(`/projects/${projectId}/datasets/${dsId}`)}>{dataset?.name || 'Dataset'}</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-text font-medium">Settings</span>
      </div>

      {/* Header */}
      <div className="bg-surface-1/50 backdrop-blur-sm border border-divider rounded-3xl p-8 shadow-lg shadow-black/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-surface-2 text-text-secondary">
            <Settings className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-text font-display tracking-tight">Settings</h1>
            <p className="text-text-secondary text-lg">Manage configuration and danger zone</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">

          {/* Metadata Section */}
          <div className="bg-surface-1 rounded-3xl shadow-lg shadow-black/5 border border-divider overflow-hidden">
            <div className="px-8 py-6 border-b border-divider bg-surface-1/50 backdrop-blur-sm flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shadow-sm border border-primary/20">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-text text-lg">Dataset Information</h3>
                <p className="text-sm text-text-secondary">Overview of metadata and statistics</p>
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Dataset Name */}
                <div className="flex items-start gap-4 group">
                  <div className="p-3 rounded-xl bg-surface-2 mt-1 text-primary group-hover:bg-primary/10 transition-colors">
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <dt className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Dataset Name</dt>
                    <dd className="text-lg font-bold text-text break-words font-display">{dataset?.name || '—'}</dd>
                  </div>
                </div>

                {/* Owner */}
                <div className="flex items-start gap-4 group">
                  <div className="p-3 rounded-xl bg-surface-2 mt-1 text-primary group-hover:bg-primary/10 transition-colors">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <dt className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Owner</dt>
                    <dd className="text-lg font-bold text-text font-display">{stats?.owner_name || dataset?.owner_name || '—'}</dd>
                  </div>
                </div>

                {/* Rows × Columns */}
                <div className="flex items-start gap-4 group">
                  <div className="p-3 rounded-xl bg-surface-2 mt-1 text-primary group-hover:bg-primary/10 transition-colors">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <dt className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Dimensions</dt>
                    <dd className="text-lg font-bold text-text font-display">
                      {(stats?.row_count ?? 0).toLocaleString()} <span className="text-text-secondary text-sm font-normal">rows</span> × {(stats?.column_count ?? 0).toLocaleString()} <span className="text-text-secondary text-sm font-normal">cols</span>
                    </dd>
                  </div>
                </div>

                {/* Last Updated */}
                <div className="flex items-start gap-4 group">
                  <div className="p-3 rounded-xl bg-surface-2 mt-1 text-primary group-hover:bg-primary/10 transition-colors">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <dt className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Last Updated</dt>
                    <dd className="text-lg font-bold text-text font-display">
                      {dataset?.last_upload_at
                        ? new Date(dataset.last_upload_at).toLocaleDateString()
                        : (stats as any)?.last_update_at
                          ? new Date((stats as any).last_update_at).toLocaleDateString()
                          : '—'}
                    </dd>
                  </div>
                </div>

                {/* Table Location - Spans full width */}
                <div className="md:col-span-2 flex items-start gap-4 group">
                  <div className="p-3 rounded-xl bg-surface-2 mt-1 text-primary group-hover:bg-primary/10 transition-colors">
                    <Table2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <dt className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Table Location</dt>
                    <dd className="text-sm font-mono text-text break-all bg-surface-2 px-4 py-3 rounded-xl border border-divider group-hover:border-primary/30 transition-colors">
                      {stats?.table_location || '—'}
                    </dd>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          {role === 'owner' && (
            <div className="rounded-3xl border border-error/20 bg-error/5 overflow-hidden shadow-sm">
              <div className="px-8 py-6 border-b border-error/20 bg-error/10 flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-error/20 text-error shadow-sm">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-error text-lg">Danger Zone</h3>
                  <p className="text-sm text-error/80">Irreversible actions - proceed with caution</p>
                </div>
              </div>

              <div className="p-8 flex items-center justify-between gap-6 flex-wrap">
                <div>
                  <h4 className="font-bold text-text text-lg">Delete Dataset</h4>
                  <p className="text-text-secondary mt-1 max-w-md">
                    Permanently delete this dataset and all its associated data, history, and settings.
                  </p>
                </div>
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="px-6 py-3 rounded-xl border-2 border-error/20 text-error hover:bg-error hover:text-white hover:border-error font-bold transition-all flex items-center gap-2 whitespace-nowrap shadow-sm hover:shadow-error/20"
                >
                  <Trash2 className="w-5 h-5" />
                  Delete Dataset
                </button>
              </div>
            </div>
          )}

          {/* Delete confirmation modal */}
          <DeleteConfirmationDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            itemName={dataset?.name || ''}
            itemType="dataset"
            loading={busy}
            onConfirm={async () => {
              setBusy(true)
              try {
                await deleteDataset(projectId, dsId)
                setDeleteOpen(false)
                setToast('Dataset deleted successfully')
                nav(`/projects/${projectId}`)
              } catch (e: any) {
                setToast(e.message)
              } finally {
                setBusy(false)
              }
            }}
          />


          {role !== 'owner' && (
            <div className="bg-surface-2/50 border border-divider rounded-3xl p-8 text-center">
              <div className="inline-flex p-4 rounded-full bg-surface-2 mb-4 shadow-inner">
                <Info className="w-8 h-8 text-text-secondary" />
              </div>
              <p className="text-lg font-bold text-text mb-2">Limited Access</p>
              <p className="text-text-secondary max-w-md mx-auto">
                You need owner permissions to access advanced settings and delete this dataset.
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          {/* Placeholder for future settings sidebar */}
        </div>
      </div>
    </div>
  )
}
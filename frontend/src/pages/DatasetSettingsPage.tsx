import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteDataset, getDataset, getDatasetStatsTop, getProject, myProjectRole } from '../api'
import Alert from '../components/Alert'
import { Settings, ChevronLeft, Database, User, Calendar, Table2, BarChart3, AlertTriangle, Trash2, Info } from 'lucide-react'

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
  const [confirming, setConfirming] = useState(false)
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

  async function onDelete() {
    if (!confirming) { setConfirming(true); return }
    try {
      setBusy(true)
      await deleteDataset(projectId, dsId)
      setToast('Dataset deleted')
      nav(`/projects/${projectId}`)
    } catch (e: any) { setError(e.message) }
    finally { setBusy(false); setConfirming(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Link
            to={`/projects/${projectId}/datasets/${dsId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white mb-6 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dataset
          </Link>

          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Settings</h1>
              <p className="text-slate-300 text-sm mt-1">{dataset?.name || `Dataset #${dsId}`}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        {toast && <Alert type="success" message={toast} onClose={() => setToast('')} />}

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">

            {/* Metadata Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Overview of dataset information</h3>
                </div>
              </div>

              <div className="p-6 bg-slate-900 dark:bg-slate-950">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Dataset Name */}
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 mt-1">
                      <Database className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Dataset Name</dt>
                      <dd className="text-base font-semibold text-white break-words">{dataset?.name || '—'}</dd>
                    </div>
                  </div>

                  {/* Owner */}
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 mt-1">
                      <User className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Owner</dt>
                      <dd className="text-base font-semibold text-white">{stats?.owner_name || dataset?.owner_name || '—'}</dd>
                    </div>
                  </div>

                  {/* Rows × Columns */}
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 mt-1">
                      <BarChart3 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Rows × Columns</dt>
                      <dd className="text-base font-semibold text-white">
                        {(stats?.row_count ?? 0).toLocaleString()} × {(stats?.column_count ?? 0).toLocaleString()}
                      </dd>
                    </div>
                  </div>

                  {/* Last Updated */}
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 mt-1">
                      <Calendar className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Last Updated</dt>
                      <dd className="text-base font-semibold text-white">
                        {dataset?.last_upload_at
                          ? new Date(dataset.last_upload_at).toLocaleString()
                          : (stats as any)?.last_update_at
                            ? new Date((stats as any).last_update_at).toLocaleString()
                            : '—'}
                      </dd>
                    </div>
                  </div>

                  {/* Table Location - Spans full width */}
                  <div className="md:col-span-2 flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 mt-1">
                      <Table2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Table Location</dt>
                      <dd className="text-sm font-mono text-white break-all bg-slate-800 px-3 py-2 rounded-lg border border-slate-700">
                        {stats?.table_location || '—'}
                      </dd>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            {role === 'owner' && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/30 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-700 dark:text-red-400">Danger Zone</h3>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">Irreversible actions - proceed with caution</p>
                  </div>
                </div>

                <div className="p-6 flex items-center justify-between gap-4 bg-slate-950">
                  <div>
                    <h4 className="font-medium text-white">Delete Dataset</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      Permanently delete this dataset and all its data.
                    </p>
                  </div>
                  <button
                    disabled={busy}
                    onClick={onDelete}
                    className={`px-4 py-2 rounded-lg border font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${confirming
                        ? 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                        : 'border-red-600/50 text-red-500 hover:bg-red-950/50'
                      } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Trash2 className="w-4 h-4" />
                    {busy ? 'Deleting…' : confirming ? 'Confirm Delete' : 'Delete Dataset'}
                  </button>
                </div>

                {confirming && (
                  <div className="px-6 pb-4 bg-slate-950">
                    <div className="bg-red-950/50 border border-red-900/50 rounded-lg p-3">
                      <p className="text-sm text-red-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Warning:</strong> This action cannot be undone. All data will be permanently removed.
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {role !== 'owner' && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl p-6 text-center">
                <Info className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">Limited Access</p>
                <p className="text-sm text-blue-700 dark:text-blue-400">
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
    </div>
  )
}

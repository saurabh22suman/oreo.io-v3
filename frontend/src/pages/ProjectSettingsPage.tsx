import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteProject, getProject, updateProject, myProjectRole } from '../api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '../components/ui/dialog'
import ProjectLayout from '../components/ProjectLayout'
import Card from '../components/Card'
import Alert from '../components/Alert'
import { Settings, Trash2, AlertTriangle, Save, Type, FileText } from 'lucide-react'

export default function ProjectSettingsPage() {
  const { id } = useParams()
  const projectId = Number(id)
  const [project, setProject] = useState<any>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [confirmName, setConfirmName] = useState('')
  const [description, setDescription] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [role, setRole] = useState<'owner' | 'contributor' | 'viewer' | null>(null)
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [p, r] = await Promise.all([
          getProject(projectId),
          myProjectRole(projectId).catch(() => ({ role: null }))
        ])
        if (mounted) {
          setProject(p)
          setName(p?.name || '')
          setDescription(p?.description || '')
          setRole(r.role)
        }
      } catch (e: any) {
        if (mounted) setToast({ type: 'error', message: e.message })
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [projectId])

  return (
    <ProjectLayout project={project} role={role} loading={loading}>
      {toast && <Alert type={toast.type} message={toast.message} onClose={() => setToast(null)} autoDismiss={true} />}

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* General Settings */}
          <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-500" />
                General Settings
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Update your project's core information.
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <Type className="w-4 h-4 text-blue-500" />
                  Project Name
                </label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Q4 Marketing Analysis"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <FileText className="w-4 h-4 text-purple-500" />
                  Description
                </label>
                <textarea
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all min-h-[100px] resize-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Briefly describe this project..."
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  disabled={saving || !name.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-500/20"
                  onClick={async () => {
                    setSaving(true)
                    try {
                      const p = await updateProject(projectId, { name: name.trim(), description })
                      setProject(p)
                      setToast({ type: 'success', message: 'Project updated successfully' })
                    } catch (e: any) { setToast({ type: 'error', message: e.message }) }
                    finally { setSaving(false) }
                  }}
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </Card>

          {/* Danger Zone */}
          <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 overflow-hidden">
            <div className="p-6 border-b border-red-100 dark:border-red-900/30">
              <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </h3>
              <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                Irreversible actions that affect your project.
              </p>
            </div>
            <div className="p-6 flex items-center justify-between gap-4">
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">Delete Project</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Permanently delete this project and all its datasets.
                </p>
              </div>
              <button
                className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 font-medium transition-colors flex items-center gap-2"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="w-4 h-4" />
                Delete Project
              </button>
            </div>
          </div>

        </div>

        <div className="lg:col-span-1">
          {/* Placeholder for future settings sidebar or info */}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md w-full p-0 overflow-hidden rounded-2xl border-0">
          <div className="bg-red-50 dark:bg-red-900/20 p-6 flex flex-col items-center text-center border-b border-red-100 dark:border-red-900/30">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">Delete Project?</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 mt-2">
              This will permanently delete <span className="font-bold text-slate-900 dark:text-white">{project?.name}</span>. This action cannot be undone.
            </DialogDescription>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Type <span className="font-mono font-bold select-all">{project?.name}</span> to confirm
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
                placeholder="Type project name"
                onChange={(e) => setConfirmName(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <DialogClose asChild>
                <button
                  className="px-4 py-2 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  disabled={deleting}
                >
                  Cancel
                </button>
              </DialogClose>
              <button
                className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg shadow-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={deleting || confirmName !== project?.name}
                onClick={async () => {
                  setDeleting(true)
                  try {
                    await deleteProject(projectId)
                    setDeleteOpen(false)
                    nav('/projects')
                  }
                  catch (e: any) { setToast({ type: 'error', message: e.message }) }
                  finally { setDeleting(false) }
                }}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Project'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ProjectLayout>
  )
}

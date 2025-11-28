import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { deleteProject, getProject, updateProject, myProjectRole } from '../api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '../components/ui/dialog'
import ProjectLayout from '../components/ProjectLayout'
import Card from '../components/Card'
import Alert from '../components/Alert'
import { Settings, Trash2, AlertTriangle, Save, Type, FileText, Loader2 } from 'lucide-react'

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

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3 animate-fade-in">
        <div className="lg:col-span-2 space-y-6">

          {/* General Settings */}
          <div className="bg-surface-1 rounded-xl border border-divider shadow-sm overflow-hidden">
            <div className="p-6 border-b border-divider bg-surface-2/30">
              <h3 className="font-bold text-text flex items-center gap-2">
                <Settings className="w-5 h-5 text-text-secondary" />
                General Settings
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                Update your project's core information.
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                  <Type className="w-4 h-4 text-primary" />
                  Project Name
                </label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Q4 Marketing Analysis"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                  <FileText className="w-4 h-4 text-accent" />
                  Description
                </label>
                <textarea
                  className="w-full px-4 py-2.5 rounded-xl border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all min-h-[100px] resize-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Briefly describe this project..."
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  disabled={saving || !name.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl border border-error/20 bg-error/5 overflow-hidden">
            <div className="p-6 border-b border-error/10">
              <h3 className="font-bold text-error flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone
              </h3>
              <p className="text-sm text-error/80 mt-1">
                Irreversible actions that affect your project.
              </p>
            </div>
            <div className="p-6 flex items-center justify-between gap-4">
              <div>
                <h4 className="font-medium text-text">Delete Project</h4>
                <p className="text-sm text-text-secondary mt-1">
                  Permanently delete this project and all its datasets.
                </p>
              </div>
              <button
                className="px-4 py-2 rounded-lg border border-error/20 bg-surface-1 text-error hover:bg-error/10 font-medium transition-colors flex items-center gap-2"
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
        <DialogContent className="max-w-md w-full p-0 overflow-hidden rounded-2xl border-0 bg-surface-1">
          <div className="bg-error/5 p-6 flex flex-col items-center text-center border-b border-error/10">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mb-4 text-error">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-text">Delete Project?</DialogTitle>
            <DialogDescription className="text-text-secondary mt-2">
              This will permanently delete <span className="font-bold text-text">{project?.name}</span>. This action cannot be undone.
            </DialogDescription>
          </div>

          <div className="p-6 bg-surface-1">
            <div className="mb-4">
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Type <span className="font-mono font-bold select-all text-text">{project?.name}</span> to confirm
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-divider bg-surface-2 text-text focus:ring-2 focus:ring-error/20 focus:border-error outline-none transition-all"
                placeholder="Type project name"
                onChange={(e) => setConfirmName(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <DialogClose asChild>
                <button
                  className="px-4 py-2 rounded-xl font-medium text-text-secondary hover:bg-surface-2 transition-colors"
                  disabled={deleting}
                >
                  Cancel
                </button>
              </DialogClose>
              <button
                className="px-6 py-2 rounded-xl bg-error hover:bg-error-hover text-white font-semibold shadow-lg shadow-error/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Yes, Delete Project
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ProjectLayout>
  )
}

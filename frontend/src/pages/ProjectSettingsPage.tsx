import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { deleteProject, getProject, updateProject, myProjectRole } from '../api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '../components/ui/dialog'

export default function ProjectSettingsPage(){
  const { id } = useParams()
  const projectId = Number(id)
  const [project, setProject] = useState<any>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [role, setRole] = useState<'owner'|'contributor'|'viewer'|null>(null)
  const nav = useNavigate()

  useEffect(()=>{ (async()=>{
    try{
      const p = await getProject(projectId)
      setProject(p)
      setName(p?.name || '')
      setDescription(p?.description || '')
    } catch(e:any){ setError(e.message) }
    try{ const r = await myProjectRole(projectId); setRole(r.role) }catch{ setRole(null) }
  })() }, [projectId])

  return (
        <>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">Project: {project?.name || projectId}</h2>
          </div>
          <div className="mb-4 border-b border-gray-200">
            <nav className="flex gap-2">
              <NavLink end to={`/projects/${projectId}`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Datasets</NavLink>
              <NavLink to={`/projects/${projectId}/members`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Members</NavLink>
              {role === 'owner' && (
                <NavLink to={`/projects/${projectId}/settings`} className={({isActive})=>`px-3 py-2 text-sm ${isActive? 'border-b-2 border-primary text-primary' : 'text-gray-700 hover:text-primary'}`}>Settings</NavLink>
              )}
            </nav>
          </div>

          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div className="border border-gray-200 bg-white rounded-md p-4">
                <div className="text-base font-medium mb-3">Project settings</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <label className="block text-xs text-gray-600 mb-1">Name</label>
                    <input className="border border-gray-300 px-3 py-2 w-full rounded" value={name} onChange={e=>setName(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">Description</label>
                    <textarea className="border border-gray-300 px-3 py-2 w-full rounded min-h-[80px]" value={description} onChange={e=>setDescription(e.target.value)} />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button disabled={saving || !name.trim()} className="btn-primary px-3 py-2 text-sm disabled:opacity-60" onClick={async()=>{
                    setError(''); setSaving(true)
                    try{
                      const p = await updateProject(projectId, { name: name.trim(), description })
                      setProject(p)
                    }catch(e:any){ setError(e.message) }
                    finally{ setSaving(false) }
                  }}>Save changes</button>
                </div>
                <div className="text-xs text-gray-500 mt-2">You can rename the project or update its description.</div>
              </div>

              <div className="border border-red-200 bg-red-50 rounded-md p-4">
                <div className="text-base font-medium mb-2 text-red-700">Danger zone</div>
                <div className="text-sm text-gray-700 mb-3">Delete this project and all of its datasets. This action cannot be undone.</div>
                <button className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-100" onClick={()=> setDeleteOpen(true)}>Delete project</button>
              </div>
            </div>
            <div className="lg:col-span-1">
              {/* Reserved for future settings sidebar */}
            </div>
          </div>

          {error && (
            <div className="mt-4 text-sm text-red-600">{error}</div>
          )}

          {/* Delete confirmation modal */}
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent className="max-w-md w-full">
              <DialogHeader>
                <DialogTitle>Delete project?</DialogTitle>
                <DialogDescription>
                  This will permanently delete <span className="font-medium">{project?.name || `Project ${projectId}`}</span> and all of its datasets. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-3 flex items-center justify-end gap-2">
                <DialogClose asChild>
                  <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" disabled={deleting}>Cancel</button>
                </DialogClose>
                <button
                  className="rounded-md bg-red-600 text-white px-3 py-1.5 text-sm hover:bg-red-700 disabled:opacity-60"
                  disabled={deleting}
                  onClick={async()=>{
                    setError(''); setDeleting(true)
                    try { await deleteProject(projectId); setDeleteOpen(false); nav('/projects') }
                    catch(e:any){ setError(e.message) }
                    finally { setDeleting(false) }
                  }}
                >{deleting ? 'Deleting…' : 'Delete'}</button>
              </div>
            </DialogContent>
          </Dialog>
  </>
  )
}

import React, { useState } from 'react'
import { createProject } from '../api'

type Props = {
  open: boolean
  onClose: () => void
  onCreate: () => void
}

export default function ProjectModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      await createProject(name.trim(), description.trim())
      setName('')
      setDescription('')
      onCreate()
      onClose()
    } catch (err) {
      console.error('create project failed', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg p-6">
        <div className="card">
          <h2 className="text-xl font-bold">Create Project</h2>
          <form className="mt-4" onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Project Name</label>
              <input required value={name} onChange={e => setName(e.target.value)} className="w-full border px-3 py-2" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Project Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border px-3 py-2" rows={4} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 font-semibold bg-gray-200">Close</button>
              <button type="submit" disabled={loading} className="px-4 py-2 btn-primary bold">
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

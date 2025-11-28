import React, { useState } from 'react'
import { createProject } from '../api'
import { X, FolderPlus, Type, FileText, Loader2 } from 'lucide-react'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg transform transition-all duration-300 animate-modal-open">
        <div className="relative overflow-hidden rounded-card bg-surface-1 shadow-2xl border border-divider">

          {/* Header with Gradient */}
          <div className="relative px-6 py-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-divider">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-gradient shadow-lg shadow-primary/20">
                  <FolderPlus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text">Create Project</h2>
                  <p className="text-sm text-text-secondary">Start a new data workspace</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="label flex items-center gap-2">
                  <Type className="w-4 h-4 text-primary" />
                  Project Name
                </label>
                <div className="relative">
                  <input
                    required
                    value={name}
                    maxLength={20}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g., Q4 Sales Analysis"
                    className="input pr-20"
                  />
                  <div className="absolute right-3 top-3.5 text-xs text-text-muted font-medium">
                    {20 - name.length} chars left
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="label flex items-center gap-2">
                  <FileText className="w-4 h-4 text-secondary" />
                  Description <span className="text-text-muted font-normal normal-case">(Optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Briefly describe the purpose of this project..."
                  className="textarea"
                  rows={4}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="btn btn-primary"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  'Create Project'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import ProjectCard from '../components/ProjectCard'
import ProjectModal from '../components/ProjectModal'
import { listProjects } from '../api'

type Project = {
  id: string
  name: string
  description?: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await listProjects()
      setProjects(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Projects</h1>
        <button onClick={() => setOpen(true)} className="px-4 py-2 bg-slate-800 text-white font-bold rounded-md">+ Create Project</button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      <ProjectModal open={open} onClose={() => setOpen(false)} onCreate={() => load()} />
    </div>
  )
}

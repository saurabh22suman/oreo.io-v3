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
      {/* Intro section */}
      <div className="mb-6 flex gap-6 items-center">
        <div className="w-48 flex-shrink-0">
          {/* reuse mascot component from login/register */}
          <img src="/images/dutch_rabbit.svg" alt="Mascot explaining project section" className="w-full mascot-bounce" />
        </div>
        <div className="flex-1 card">
          <h1 className="text-2xl card-title">Projects</h1>
          <p className="muted-small mt-2">The project is the collection for your similar purpose datasets, to keep things aligned. You can add your members to the project to collaboratively take care of your data.</p>
        </div>
        <div>
          <button onClick={() => setOpen(true)} className="px-4 py-2 btn-primary bold">+ Create Project</button>
        </div>
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

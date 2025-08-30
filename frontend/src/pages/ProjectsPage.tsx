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
      <div className="mb-6 flex flex-col md:flex-row gap-6 items-start">
        <div className="w-36 flex-shrink-0">
          {/* keep existing mascot as requested */}
          <img src="/images/dutch_rabbit.svg" alt="Mascot" className="w-full mascot-bounce" />
        </div>
        <div className="flex-1 rounded-lg p-5" style={{ background: 'linear-gradient(180deg,#ffffff 0%, #fbfdff 100%)' }}>
          <h1 className="text-3xl font-extrabold text-slate-900">Projects</h1>
          <p className="muted-small mt-2 max-w-2xl">Organize related datasets into projects, invite members, and collaborate with clear ownership and roles.</p>
        </div>
        <div className="self-start">
          <button onClick={() => setOpen(true)} className="create-cta inline-flex items-center px-5 py-2 rounded-md">+ Create Project</button>
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p, i) => (
            <div key={p.id} style={{ animation: `cardFadeIn 320ms ease ${i * 40}ms both` }}>
              <ProjectCard project={p} />
            </div>
          ))}
        </div>
      )}

      <ProjectModal open={open} onClose={() => setOpen(false)} onCreate={() => load()} />
    </div>
  )
}

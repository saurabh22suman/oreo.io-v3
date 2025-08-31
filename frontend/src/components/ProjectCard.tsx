import React from 'react'
import { useNavigate } from 'react-router-dom'

type Project = {
  id: string
  name: string
  description?: string
}

export default function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate()
  return (
    <div className="project-card group p-4 flex flex-col h-full rounded-lg backdrop-blur-sm">
      <div className="header rounded-md mb-3 p-3 text-white">
        <h3 className="text-lg font-bold leading-tight">{project.name}</h3>
      </div>

      <p className="text-sm text-slate-700 mt-2 flex-1">{project.description || 'No description'}</p>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="avatar-placeholder w-10 h-10 rounded-full bg-white/30 flex items-center justify-center text-white shadow-sm">{project.name.charAt(0).toUpperCase()}</div>
          <div className="text-xs text-slate-500">Updated 2 days ago</div>
        </div>

        <button onClick={() => navigate(`/projects/${project.id}`)} className="cta-btn inline-flex items-center px-4 py-2 rounded-md">
          Open
        </button>
      </div>
    </div>
  )
}

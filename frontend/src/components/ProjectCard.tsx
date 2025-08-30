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
    <div className="card p-4 flex flex-col h-full">
      <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
      <p className="text-sm text-gray-600 mt-2 flex-1">{project.description || 'No description'}</p>
      <div className="mt-4 flex items-center justify-end">
        <button onClick={() => navigate(`/projects/${project.id}`)} className="inline-flex items-center px-3 py-1.5 btn-primary bold">
          Open
        </button>
      </div>
    </div>
  )
}

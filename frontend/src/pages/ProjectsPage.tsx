import React, { useEffect, useState, useMemo } from 'react'
import ProjectModal from '../components/ProjectModal'
import { listProjects } from '../api'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, Plus, Search, Clock, Database, ArrowRight, LayoutGrid, List, ArrowUpDown } from 'lucide-react'

type Project = {
  id: string
  name: string
  description?: string
  role?: string
  datasetCount?: number
  updated_at?: string
  modified?: string
  last_activity?: string
  lastModified?: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'datasets' | 'modified'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const navigate = useNavigate()

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

  useEffect(() => {
    const handler = () => load()
    window.addEventListener('dataset:created', handler)
    return () => window.removeEventListener('dataset:created', handler)
  }, [])

  const filteredAndSorted = useMemo(() => {
    let result = [...projects]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
    }

    result.sort((a, b) => {
      if (sortBy === 'name') return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      if (sortBy === 'datasets') return sortDir === 'asc' ? (a.datasetCount || 0) - (b.datasetCount || 0) : (b.datasetCount || 0) - (a.datasetCount || 0)

      const getTime = (p: Project) => {
        const v = p.modified || p.updated_at || p.last_activity || p.lastModified
        return v ? new Date(v).getTime() : 0
      }

      return sortDir === 'asc' ? getTime(a) - getTime(b) : getTime(b) - getTime(a)
    })
    return result
  }, [projects, sortBy, sortDir, searchQuery])

  const getLastModified = (p: Project) => {
    const v = p.modified || p.updated_at || p.last_activity || p.lastModified
    return v ? new Date(v).toLocaleDateString() : '—'
  }

  const toggleSort = (field: 'name' | 'datasets' | 'modified') => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary mb-1">Projects</h1>
          <p className="text-sm text-text-secondary">Manage your data workspaces</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn btn-primary">
          <Plus size={18} />
          New Project
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 py-2"
          />
        </div>
        
        {/* View & Sort Controls */}
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-surface-2 rounded-lg p-0.5 border border-divider">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-surface-3 text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-surface-3 text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <List size={16} />
            </button>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1">
            {(['name', 'datasets', 'modified'] as const).map((field) => (
              <button 
                key={field}
                onClick={() => toggleSort(field)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1
                  ${sortBy === field 
                    ? 'bg-primary/10 text-primary border border-primary/20' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-3'
                  }`}
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
                {sortBy === field && <ArrowUpDown size={12} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Projects */}
      {loading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-card bg-surface-2 border border-divider animate-pulse" />
          ))}
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="text-center py-16 bg-surface-2 rounded-card border border-divider">
          <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center mx-auto mb-4">
            <FolderKanban size={24} className="text-text-muted" />
          </div>
          <h3 className="font-medium text-text-primary mb-1">
            {searchQuery ? 'No projects found' : 'No projects yet'}
          </h3>
          <p className="text-sm text-text-secondary mb-4">
            {searchQuery ? `No projects match "${searchQuery}"` : 'Create your first project to get started'}
          </p>
          {!searchQuery && (
            <button onClick={() => setOpen(true)} className="btn btn-primary text-sm">
              <Plus size={16} />
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {filteredAndSorted.map((project) => (
            <div 
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className={`
                bg-surface-2 border border-divider rounded-card p-5 cursor-pointer 
                hover:border-primary/30 hover:bg-surface-3/50 transition-all group
                ${viewMode === 'list' ? 'flex items-center gap-5' : ''}
              `}
            >
              {/* Icon */}
              <div className={`
                rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold
                ${viewMode === 'grid' ? 'w-10 h-10 mb-4' : 'w-10 h-10 flex-shrink-0'}
              `}>
                {project.name.charAt(0).toUpperCase()}
              </div>

              {/* Content */}
              <div className={`${viewMode === 'list' ? 'flex-1 min-w-0' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-text-primary group-hover:text-primary transition-colors truncate">
                    {project.name}
                  </h3>
                  <span className="text-[10px] font-medium text-text-muted bg-surface-3 px-1.5 py-0.5 rounded">
                    {project.role || 'Owner'}
                  </span>
                </div>
                <p className="text-sm text-text-secondary line-clamp-1">
                  {project.description || 'No description'}
                </p>

                {/* Meta */}
                <div className={`flex items-center gap-4 text-xs text-text-muted ${viewMode === 'grid' ? 'mt-4 pt-4 border-t border-divider' : 'mt-2'}`}>
                  <span className="flex items-center gap-1">
                    <Database size={12} />
                    {project.datasetCount || 0} datasets
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {getLastModified(project)}
                  </span>
                </div>
              </div>

              {/* Arrow */}
              {viewMode === 'list' && (
                <ArrowRight size={16} className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}

      <ProjectModal open={open} onClose={() => setOpen(false)} onCreate={load} />
    </div>
  )
}

import React, { useEffect, useState, useMemo } from 'react'
import ProjectModal from '../components/ProjectModal'
import { listProjects, currentUser } from '../api'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus, Search, Clock, Database, ArrowRight, User, Filter, ArrowUpDown, LayoutGrid, List } from 'lucide-react'

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
    const handler = (e: any) => { try { const pid = e?.detail?.projectId; if (!pid) load(); else load() } catch { } }
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
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-surface-1/80 backdrop-blur-xl border border-divider p-8 shadow-2xl shadow-black/5">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-xs font-bold border border-primary/20 text-primary shadow-sm">
                Workspaces
              </span>
            </div>
            <h1 className="text-4xl font-bold mb-4 tracking-tight text-text font-display drop-shadow-sm">Projects</h1>
            <p className="text-text-secondary max-w-lg text-base leading-relaxed">
              Manage your data workspaces and collaborations. Create new projects to organize your datasets and invite team members.
            </p>
          </div>
           <div className="flex items-center gap-3">
              <button
                onClick={() => setOpen(true)}
                className="btn btn-primary flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
              >
                <Plus className="w-5 h-5" />
                Create Project
              </button>
            </div>
        </div>
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-surface-1/50 p-2 rounded-2xl border border-divider backdrop-blur-sm">
        <div className="relative w-full sm:w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-1 border border-divider rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 px-2">
          <div className="flex items-center gap-2 border-r border-divider pr-4">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-surface-2 text-primary' : 'text-text-secondary hover:bg-surface-2 hover:text-text'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-surface-2 text-primary' : 'text-text-secondary hover:bg-surface-2 hover:text-text'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-secondary whitespace-nowrap hidden sm:inline">Sort by:</span>
            <button 
              onClick={() => toggleSort('name')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 whitespace-nowrap
                ${sortBy === 'name' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-surface-1 border-divider text-text-secondary hover:border-primary/30'}`}
            >
              Name {sortBy === 'name' && <ArrowUpDown className="w-3 h-3" />}
            </button>
            <button 
              onClick={() => toggleSort('datasets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 whitespace-nowrap
                ${sortBy === 'datasets' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-surface-1 border-divider text-text-secondary hover:border-primary/30'}`}
            >
              Datasets {sortBy === 'datasets' && <ArrowUpDown className="w-3 h-3" />}
            </button>
            <button 
              onClick={() => toggleSort('modified')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1 whitespace-nowrap
                ${sortBy === 'modified' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-surface-1 border-divider text-text-secondary hover:border-primary/30'}`}
            >
              Last Modified {sortBy === 'modified' && <ArrowUpDown className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {[1, 2, 3].map(i => (
            <div key={i} className={`rounded-2xl bg-surface-1 border border-divider animate-pulse ${viewMode === 'grid' ? 'h-48' : 'h-24'}`}></div>
          ))}
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="text-center py-20 rounded-3xl bg-surface-1 border border-divider border-dashed">
          <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted shadow-inner">
            <FolderOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-text mb-1">No projects found</h3>
          <p className="text-text-secondary mb-6 max-w-xs mx-auto">
            {searchQuery ? `No projects match "${searchQuery}"` : "Get started by creating your first project workspace."}
          </p>
          {!searchQuery && (
            <button onClick={() => setOpen(true)} className="btn btn-primary shadow-lg shadow-primary/20">
              Create Project
            </button>
          )}
        </div>
      ) : (
        <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {filteredAndSorted.map((project) => (
            <div 
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className={`group relative bg-surface-1 hover:bg-surface-2/50 border border-divider hover:border-primary/30 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 cursor-pointer flex ${viewMode === 'grid' ? 'flex-col p-6 h-full' : 'flex-row items-center p-4 gap-6'}`}
            >
              <div className={`flex items-start justify-between ${viewMode === 'grid' ? 'mb-4 w-full' : 'mb-0'}`}>
                <div className={`rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300 shadow-sm border border-primary/10 ${viewMode === 'grid' ? 'w-12 h-12' : 'w-10 h-10'}`}>
                  <FolderOpen className={`${viewMode === 'grid' ? 'w-6 h-6' : 'w-5 h-5'}`} />
                </div>
                {viewMode === 'grid' && (
                  <div className="px-2.5 py-1 rounded-lg bg-surface-2 border border-divider text-xs font-medium text-text-secondary group-hover:border-primary/20 transition-colors">
                    {project.role || 'Owner'}
                  </div>
                )}
              </div>

              <div className={`${viewMode === 'grid' ? 'flex-1' : 'flex-1 min-w-0'}`}>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-xl font-bold text-text group-hover:text-primary transition-colors line-clamp-1">
                    {project.name}
                  </h3>
                  {viewMode === 'list' && (
                    <div className="px-2 py-0.5 rounded-md bg-surface-2 border border-divider text-[10px] font-medium text-text-secondary">
                      {project.role || 'Owner'}
                    </div>
                  )}
                </div>
                <p className="text-sm text-text-secondary line-clamp-2">
                  {project.description || 'No description provided for this project.'}
                </p>
              </div>

              <div className={`${viewMode === 'grid' ? 'pt-4 border-t border-divider w-full' : 'flex items-center gap-8 border-l border-divider pl-6'}`}>
                <div className={`flex items-center ${viewMode === 'grid' ? 'justify-between w-full' : 'gap-8'}`}>
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <div className="flex items-center gap-1.5" title="Datasets">
                      <Database className="w-3.5 h-3.5" />
                      <span>{project.datasetCount || 0} <span className="hidden sm:inline">Datasets</span></span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Last Modified">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{getLastModified(project)}</span>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 text-primary transition-all ${viewMode === 'grid' ? 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0' : 'group-hover:translate-x-1'}`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectModal open={open} onClose={() => setOpen(false)} onCreate={load} />
    </div>
  )
}

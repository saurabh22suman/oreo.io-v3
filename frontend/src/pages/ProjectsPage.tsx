import React, { useEffect, useState, useMemo } from 'react'
import ProjectModal from '../components/ProjectModal'
import { listProjects, currentUser } from '../api'
import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import { FolderOpen, Plus, Search, Clock, Database, ArrowRight, User } from 'lucide-react'

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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section with Mascot */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl shadow-slate-900/20">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold border border-white/10 text-blue-200">
                Workspaces
              </span>
            </div>
            <h1 className="text-4xl font-bold mb-3 tracking-tight">Projects</h1>
            <p className="text-slate-300 max-w-md text-sm leading-relaxed">
              Manage your data workspaces and collaborations. Create new projects to organize your datasets and invite team members.
            </p>

            <div className="mt-8">
              <button
                onClick={() => setOpen(true)}
                className="group relative px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:-translate-y-0.5 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create New Project
              </button>
            </div>
          </div>

          {/* Mascot Image */}
          <div className="hidden md:block relative w-56 h-56 -mr-4 -mb-8">
            <img
              src="/images/oreo_rabbit.png"
              alt="Oreo Mascot"
              className="w-full h-full object-contain drop-shadow-2xl transform hover:scale-105 transition-transform duration-500 opacity-90"
            />
          </div>
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* Projects Table Card */}
      <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-white dark:bg-slate-800/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            All Projects
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 font-medium">
              {projects.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading projects...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors" onClick={() => { setSortBy('name'); setSortDir(sortBy === 'name' && sortDir === 'asc' ? 'desc' : 'asc') }}>
                    Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right cursor-pointer hover:text-primary transition-colors" onClick={() => { setSortBy('datasets'); setSortDir(sortBy === 'datasets' && sortDir === 'asc' ? 'desc' : 'asc') }}>
                    Datasets {sortBy === 'datasets' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                    Role
                  </th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right cursor-pointer hover:text-primary transition-colors" onClick={() => { setSortBy('modified'); setSortDir(sortBy === 'modified' && sortDir === 'asc' ? 'desc' : 'asc') }}>
                    Last Modified {sortBy === 'modified' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500">
                      {searchQuery ? 'No projects match your search.' : 'No projects found. Create one to get started.'}
                    </td>
                  </tr>
                ) : (
                  filteredAndSorted.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <td className="py-2 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                            <FolderOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                              {p.name}
                            </div>
                            {p.description && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                                {p.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-6 text-right">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
                          <Database className="w-3.5 h-3.5" />
                          {p.datasetCount || 0}
                        </div>
                      </td>
                      <td className="py-2 px-6 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.role === 'owner' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                          p.role === 'contributor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                          {(p.role || 'Viewer').charAt(0).toUpperCase() + (p.role || 'viewer').slice(1)}
                        </span>
                      </td>
                      <td className="py-2 px-6 text-right text-sm text-slate-500 dark:text-slate-400">
                        <div className="flex items-center justify-end gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {getLastModified(p)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ProjectModal open={open} onClose={() => setOpen(false)} onCreate={() => load()} />
    </div>
  )
}

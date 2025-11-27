import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject, listDatasets, myProjectRole } from '../api'
import ProjectLayout from '../components/ProjectLayout'
import Card from '../components/Card'
import Alert from '../components/Alert'
import { Database, Search, LayoutDashboard, FileText, Plus, ArrowRight, Clock } from 'lucide-react'

type Dataset = { id: number; name: string; schema?: string; rules?: string; last_upload_at?: string; last_upload_path?: string }

export default function DatasetsPage() {
  const { id } = useParams()
  const projectId = Number(id)
  const [project, setProject] = useState<any>(null)
  const [items, setItems] = useState<Dataset[]>([])
  const navigate = useNavigate()
  const [role, setRole] = useState<'owner' | 'contributor' | 'viewer' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'modified'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [p, d, r] = await Promise.all([
          getProject(projectId),
          listDatasets(projectId),
          myProjectRole(projectId).catch(() => ({ role: null }))
        ])
        if (mounted) {
          setProject(p)
          setItems(d)
          setRole(r.role)
        }
      } catch (e: any) {
        if (mounted) setError(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [projectId])

  const features = [
    {
      label: 'New Dataset',
      icon: Database,
      path: `/projects/${projectId}/datasets/new`,
      color: 'blue',
      desc: 'Upload or connect data',
      allowed: role && role !== 'viewer'
    },
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: `/projects/${projectId}/dashboard`,
      color: 'emerald',
      desc: 'Visualize insights',
      allowed: true
    }
  ]

  return (
    <ProjectLayout project={project} role={role} loading={loading}>
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {features.map((feature, i) => (
          feature.allowed ? (
            <div
              key={i}
              onClick={() => navigate(feature.path)}
              className="group relative overflow-hidden p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-transparent transition-all duration-500 cursor-pointer shadow-lg shadow-slate-200/50 dark:shadow-none hover:shadow-2xl hover:-translate-y-1"
            >
              <div className={`absolute inset-0 bg-gradient-to-br from-${feature.color}-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className={`absolute inset-0 bg-gradient-to-r from-${feature.color}-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-${feature.color}-500 to-${feature.color}-600 text-white flex items-center justify-center mb-4 shadow-lg shadow-${feature.color}-500/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                    <feature.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-${feature.color}-600 dark:group-hover:text-${feature.color}-400 transition-colors">
                    {feature.label}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">{feature.desc}</p>
                </div>
                <div className={`p-2 rounded-full bg-${feature.color}-50 dark:bg-${feature.color}-900/20 text-${feature.color}-600 dark:text-${feature.color}-400 opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-500`}>
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          ) : (
            <div key={i} className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed grayscale">
              <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center mb-4">
                <feature.icon className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-500 dark:text-slate-400 mb-2">{feature.label}</h3>
              <p className="text-slate-400 font-medium">{feature.desc}</p>
            </div>
          )
        ))}
      </div>

      {/* Datasets List */}
      <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-white dark:bg-slate-800/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Datasets
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 font-medium">
              {items.length}
            </span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors" onClick={() => { setSortBy('name'); setSortDir(sortBy === 'name' && sortDir === 'asc' ? 'desc' : 'asc') }}>
                  Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right cursor-pointer hover:text-primary transition-colors" onClick={() => { setSortBy('type'); setSortDir(sortBy === 'type' && sortDir === 'asc' ? 'desc' : 'asc') }}>
                  Type {sortBy === 'type' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right cursor-pointer hover:text-primary transition-colors" onClick={() => { setSortBy('modified'); setSortDir(sortBy === 'modified' && sortDir === 'asc' ? 'desc' : 'asc') }}>
                  Last Modified {sortBy === 'modified' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-500">
                    No datasets found. Create one to get started.
                  </td>
                </tr>
              ) : (
                items
                  .sort((a, b) => {
                    if (sortBy === 'name') return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
                    if (sortBy === 'type') return sortDir === 'asc' ? ((a.schema || '').localeCompare(b.schema || '')) : ((b.schema || '').localeCompare(a.schema || ''))
                    if (sortBy === 'modified') return sortDir === 'asc' ? (new Date(a.last_upload_at || 0).getTime() - new Date(b.last_upload_at || 0).getTime()) : (new Date(b.last_upload_at || 0).getTime() - new Date(a.last_upload_at || 0).getTime())
                    return 0
                  })
                  .map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => navigate(`/projects/${projectId}/datasets/${d.id}`)}
                      className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <td className="py-2 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Database className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors">
                            {d.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-6 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${d.schema ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {d.schema ? 'Dataset' : 'File'}
                        </span>
                      </td>
                      <td className="py-2 px-6 text-right text-sm text-slate-500 dark:text-slate-400">
                        <div className="flex items-center justify-end gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {d.last_upload_at ? new Date(d.last_upload_at).toLocaleDateString() : '—'}
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </ProjectLayout>
  )
}

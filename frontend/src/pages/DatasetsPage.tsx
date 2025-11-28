import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject, listDatasets, myProjectRole } from '../api'
import ProjectLayout from '../components/ProjectLayout'
import Alert from '../components/Alert'
import { Database, Search, LayoutDashboard, FileText, Plus, ArrowRight, Clock, Filter, Table, BarChart3 } from 'lucide-react'

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
  const [search, setSearch] = useState('')

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

  const filteredItems = items.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  const features = [
    {
      label: 'New Dataset',
      icon: Database,
      path: `/projects/${projectId}/datasets/new`,
      color: 'primary',
      desc: 'Upload or connect data',
      allowed: role && role !== 'viewer'
    },
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: `/projects/${projectId}/dashboard`,
      color: 'secondary',
      desc: 'Visualize insights',
      allowed: true
    }
  ]

  return (
    <ProjectLayout project={project} role={role} loading={loading}>
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <div className="animate-fade-in space-y-8">
        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            feature.allowed ? (
              <div
                key={i}
                onClick={() => navigate(feature.path)}
                className="group relative overflow-hidden p-8 rounded-3xl bg-surface-1 border border-divider hover:border-primary/30 transition-all duration-300 cursor-pointer shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
              >
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <div className={`w-14 h-14 rounded-2xl bg-${feature.color}/10 text-${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-inner`}>
                      <feature.icon className="w-7 h-7" />
                    </div>
                    <h3 className="text-xl font-bold text-text mb-2 group-hover:text-primary transition-colors font-display">
                      {feature.label}
                    </h3>
                    <p className="text-text-secondary leading-relaxed">{feature.desc}</p>
                  </div>
                  <div className={`p-3 rounded-full bg-surface-2 text-text-secondary group-hover:text-primary group-hover:bg-primary/10 transition-colors shadow-sm`}>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
                {/* Decorative background */}
                <div className={`absolute -bottom-10 -right-10 w-40 h-40 bg-${feature.color}/5 rounded-full blur-3xl group-hover:bg-${feature.color}/10 transition-colors duration-500`}></div>
              </div>
            ) : (
              <div key={i} className="p-8 rounded-3xl bg-surface-2/50 border border-divider opacity-60 cursor-not-allowed grayscale">
                <div className="w-14 h-14 rounded-2xl bg-surface-3 flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-text-muted" />
                </div>
                <h3 className="text-xl font-bold text-text-muted mb-2 font-display">{feature.label}</h3>
                <p className="text-text-muted">{feature.desc}</p>
              </div>
            )
          ))}
        </div>

        {/* Datasets List */}
        <div className="bg-surface-1 border border-divider rounded-3xl overflow-hidden shadow-xl shadow-black/5">
          <div className="p-6 border-b border-divider flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-2/30 backdrop-blur-sm">
            <h3 className="font-bold text-text flex items-center gap-3 text-lg">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Table className="w-5 h-5" />
              </div>
              Datasets
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-surface-2 text-text-secondary border border-divider shadow-sm">
                {items.length}
              </span>
            </h3>
            
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Search datasets..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2.5 rounded-xl bg-surface-2 border border-divider text-sm text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none w-full sm:w-72 transition-all shadow-sm"
              />
            </div>
          </div>

          {items.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-20 h-20 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-6 text-text-muted shadow-inner">
                <Database className="w-10 h-10 opacity-50" />
              </div>
              <h4 className="text-xl font-bold text-text mb-2 font-display">No datasets yet</h4>
              <p className="text-text-secondary mb-8 max-w-xs mx-auto leading-relaxed">Upload your first dataset to start analyzing and visualizing your data.</p>
              {role && role !== 'viewer' && (
                <button 
                  onClick={() => navigate(`/projects/${projectId}/datasets/new`)} 
                  className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-5 h-5" />
                  Add Dataset
                </button>
              )}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted">
                <Search className="w-8 h-8 opacity-50" />
              </div>
              <h4 className="text-lg font-bold text-text mb-1">No matches found</h4>
              <p className="text-text-secondary">Try adjusting your search terms</p>
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {filteredItems.map((dataset) => (
                <div 
                  key={dataset.id}
                  onClick={() => navigate(`/projects/${projectId}/datasets/${dataset.id}`)}
                  className="group p-5 hover:bg-surface-2/50 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary font-bold shadow-sm group-hover:scale-110 transition-transform duration-300 border border-primary/10">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-text text-lg group-hover:text-primary transition-colors">{dataset.name}</h4>
                      <div className="flex items-center gap-4 text-xs text-text-secondary mt-1.5">
                        {dataset.last_upload_at && (
                          <span className="flex items-center gap-1.5 bg-surface-2 px-2 py-0.5 rounded-md border border-divider">
                            <Clock className="w-3 h-3" />
                            {new Date(dataset.last_upload_at).toLocaleDateString()}
                          </span>
                        )}
                        {dataset.schema ? (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-success/10 text-success border border-success/20 font-medium">
                            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
                            Schema Defined
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-warning/10 text-warning border border-warning/20 font-medium">
                            <div className="w-1.5 h-1.5 rounded-full bg-warning"></div>
                            No Schema
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 flex items-center gap-2">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">View Details</span>
                    </div>
                    <div className="p-2 rounded-full bg-surface-2 text-text-secondary group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProjectLayout>
  )
}

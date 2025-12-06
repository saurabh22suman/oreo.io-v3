import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject, listDatasets, myProjectRole } from '../api'
import ProjectLayout from '../components/ProjectLayout'
import Alert from '../components/Alert'
import { Database, Search, Plus, ArrowRight, Clock, FileText, Table } from 'lucide-react'

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

  return (
    <ProjectLayout project={project} role={role} loading={loading}>
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <div className="space-y-6 animate-fade-in">
        {/* Quick Actions */}
        {role && role !== 'viewer' && (
          <div 
            onClick={() => navigate(`/projects/${projectId}/datasets/new`)}
            className="bg-surface-2 border border-divider rounded-card p-5 cursor-pointer hover:border-primary/30 hover:bg-surface-3/50 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                <Plus size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-text-primary group-hover:text-primary transition-colors">New Dataset</h3>
                <p className="text-sm text-text-secondary">Upload or connect data</p>
              </div>
              <ArrowRight size={16} className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        )}

        {/* Datasets List */}
        <div className="bg-surface-2 border border-divider rounded-card overflow-hidden">
          <div className="px-5 py-4 border-b border-divider flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Table size={18} className="text-text-secondary" />
              <h2 className="font-semibold text-text-primary">Datasets</h2>
              <span className="text-xs font-medium text-text-muted bg-surface-3 px-2 py-0.5 rounded">
                {items.length}
              </span>
            </div>
            
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-3 border border-divider text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none w-full sm:w-48 transition-all"
              />
            </div>
          </div>

          {items.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center mx-auto mb-4">
                <Database size={24} className="text-text-muted" />
              </div>
              <h4 className="font-medium text-text-primary mb-1">No datasets yet</h4>
              <p className="text-sm text-text-secondary mb-4">Upload your first dataset to get started</p>
              {role && role !== 'viewer' && (
                <button 
                  onClick={() => navigate(`/projects/${projectId}/datasets/new`)} 
                  className="btn btn-primary text-sm"
                >
                  <Plus size={16} />
                  Add Dataset
                </button>
              )}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-text-muted" />
              </div>
              <h4 className="font-medium text-text-primary mb-1">No matches</h4>
              <p className="text-sm text-text-secondary">Try adjusting your search</p>
            </div>
          ) : (
            <div className="divide-y divide-divider">
              {filteredItems.map((dataset) => (
                <div 
                  key={dataset.id}
                  onClick={() => navigate(`/projects/${projectId}/datasets/${dataset.id}`)}
                  className="px-5 py-4 hover:bg-surface-3/50 transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h4 className="font-medium text-text-primary group-hover:text-primary transition-colors">{dataset.name}</h4>
                      <div className="flex items-center gap-3 mt-0.5">
                        {dataset.last_upload_at && (
                          <span className="text-xs text-text-muted flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(dataset.last_upload_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProjectLayout>
  )
}

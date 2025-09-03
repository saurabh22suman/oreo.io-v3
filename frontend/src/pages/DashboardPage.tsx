import PageHeader from '../components/PageHeader'
import Card from '../components/Card'
import { useEffect, useMemo, useState } from 'react'
import { listProjects } from '../api'
import { useUser } from '../context/UserContext'
import { useNavigate } from 'react-router-dom'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'name'|'datasets'|'updated_at'>('name')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')

  const { user } = useUser()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    listProjects()
      .then(p => { if (mounted) setProjects(p || []) })
      .catch(() => { if (mounted) setProjects([]) })
      .finally(() => { if (mounted) setLoading(false) })
    if (mounted && user?.email) setUsername(user.email.split('@')[0])
    return () => { mounted = false }
  }, [user])

  // Aggregate counts for cards and use a normalized field for table (supports API keys datasetCount or datasets_count)
  const totalDatasets = useMemo(() => {
    try {
      return projects.reduce((sum, p:any) => sum + (p.datasets_count ?? p.datasetCount ?? 0), 0)
    } catch { return 0 }
  }, [projects])

  return (
    <>
          <PageHeader title={<>Welcome, <span className="text-indigo-700">{username || 'User'}</span> 👋</>} subtitle={"Here's what's happening with your workspace today."} actions={<> 
            <button onClick={() => navigate('/projects')} className="btn-primary bold px-4 py-2">Create New Project</button>
          </>} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card><div className="text-3xl font-bold text-indigo-700">{projects.length}</div><div className="text-sm text-gray-500">Projects</div></Card>
            <Card><div className="text-3xl font-bold text-indigo-700">{totalDatasets}</div><div className="text-sm text-gray-500">Datasets</div></Card>
            <Card><div className="text-3xl font-bold text-indigo-700">5</div><div className="text-sm text-gray-500">Pending Approvals</div></Card>
          </div>

          <div className="mt-8">
            {loading ? (
              <div className="text-gray-500">Loading projects...</div>
            ) : projects.length === 0 ? (
              <Card className="text-center">
                <h3 className="text-lg font-semibold">You have no projects yet</h3>
                <p className="text-sm text-gray-500 mt-2">Create your first project to get started.</p>
                <div className="mt-4">
                  <button onClick={() => navigate('/projects')} className="bg-indigo-600 text-white px-4 py-2 rounded-xl">Create New Project</button>
                </div>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Your Projects</h3>
                  <div className="text-sm text-gray-500">{projects.length} projects</div>
                </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left table-auto">
                        <thead>
                          <tr className="text-sm text-gray-600">
                            <th className="py-3 px-4">
                              <button
                                className="inline-flex items-center gap-2"
                                onClick={() => {
                                  if (sortBy === 'name') setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                                  else { setSortBy('name'); setSortDir('asc') }
                                }}
                                aria-label={`Sort by name ${sortBy === 'name' ? sortDir : ''}`}
                              >
                                Name
                                <span className="text-xs text-gray-400">{sortBy === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                              </button>
                            </th>
                            <th className="py-3 px-4">
                              <button
                                className="inline-flex items-center gap-2"
                                onClick={() => {
                                  if (sortBy === 'datasets') setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                                  else { setSortBy('datasets'); setSortDir('desc') }
                                }}
                                aria-label={`Sort by dataset count ${sortBy === 'datasets' ? sortDir : ''}`}
                              >
                                Datasets
                                <span className="text-xs text-gray-400">{sortBy === 'datasets' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                              </button>
                            </th>
                            <th className="py-3 px-4">
                              <button
                                className="inline-flex items-center gap-2"
                                onClick={() => {
                                  if (sortBy === 'updated_at') setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                                  else { setSortBy('updated_at'); setSortDir('desc') }
                                }}
                                aria-label={`Sort by last modified ${sortBy === 'updated_at' ? sortDir : ''}`}
                              >
                                Last Modified
                                <span className="text-xs text-gray-400">{sortBy === 'updated_at' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/** sort projects client-side for the dashboard table */}
                          {(() => {
              const sorted = [...projects]
                            sorted.sort((a: any, b: any) => {
                              if (sortBy === 'name') {
                                const an = (a.name || '').toLowerCase()
                                const bn = (b.name || '').toLowerCase()
                                if (an < bn) return sortDir === 'asc' ? -1 : 1
                                if (an > bn) return sortDir === 'asc' ? 1 : -1
                                return 0
                              }
                              if (sortBy === 'datasets') {
                const av = (a.datasets_count ?? a.datasetCount ?? 0) as number
                const bv = (b.datasets_count ?? b.datasetCount ?? 0) as number
                                return sortDir === 'asc' ? av - bv : bv - av
                              }
                              // updated_at
                              const at = a.updated_at ? new Date(a.updated_at).getTime() : 0
                              const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0
                              return sortDir === 'asc' ? at - bt : bt - at
                            })
                            return sorted.map((p: any) => (
                              <tr
                                key={p.id}
                                className="border-t cursor-pointer hover:bg-gray-50"
                                onClick={() => navigate(`/projects/${p.id}`)}
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/projects/${p.id}`) } }}
                              >
                                <td className="py-3 px-4">
                                  <div className="max-w-[420px] truncate font-semibold text-gray-800" title={p.name}>{p.name}</div>
                                </td>
                                <td className="py-3 px-4 text-sm text-gray-500">{p.datasets_count ?? p.datasetCount ?? 0}</td>
                                <td className="py-3 px-4 text-sm text-gray-500">{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : ''}</td>
                              </tr>
                            ))
                          })()}
                        </tbody>
                      </table>
                    </div>
              </>
            )}
          </div>


          <div className="mt-8">
            <Card className="text-center">
              <h2 className="text-xl font-bold mb-4">Charts</h2>
              <div className="h-48 flex items-center justify-center text-gray-400">[Chart Placeholder]</div>
            </Card>
          </div>
    </>
  )
}
 

import Sidebar from '../components/Sidebar'
import Footer from '../components/Footer'
import { useEffect, useState } from 'react'
import { listProjects } from '../api'
import { useUser } from '../context/UserContext'
import { useNavigate } from 'react-router-dom'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  const { user } = useUser()
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    listProjects().then(p => { if (mounted) setProjects(p || []) }).catch(() => { if (mounted) setProjects([]) }).finally(() => { if (mounted) setLoading(false) })
  if(mounted && user?.email) setUsername(user.email.split('@')[0])
    return () => { mounted = false }
  }, [])

  // compute left margin to match tailwind w-64 (16rem = 256px) and w-20 (5rem = 80px)
  const mainMarginLeft = collapsed ? 80 : 256

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <div className={`flex-1 layout-with-sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-slot">
          <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        </div>

        <main className="main p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Welcome, <span className="text-indigo-700">{username || 'User'}</span> 👋</h1>
                <p className="text-sm text-gray-500 mt-1">Here's what's happening with your workspace today.</p>
              </div>
              <div className="flex items-center gap-3">
                {projects.length > 0 && (<button onClick={() => navigate('/projects')} className="border border-gray-200 px-3 py-2 hover:shadow">Resume Previous Project</button>)}
                <button onClick={() => navigate('/projects')} className="btn-primary bold px-4 py-2">Create New Project</button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
              <div className="card">
                <div className="text-3xl font-bold text-indigo-700">{projects.length}</div>
                <div className="text-sm text-gray-500">Projects</div>
              </div>
              <div className="card">
                <div className="text-3xl font-bold text-indigo-700">34</div>
                <div className="text-sm text-gray-500">Datasets</div>
              </div>
              <div className="card">
                <div className="text-3xl font-bold text-indigo-700">5</div>
                <div className="text-sm text-gray-500">Pending Approvals</div>
              </div>
            </div>

            {/* Projects area */}
            <div className="mt-8">
              {loading ? (
                <div className="text-gray-500">Loading projects...</div>
              ) : projects.length === 0 ? (
                <div className="card text-center">
                  <h3 className="text-lg font-semibold">You have no projects yet</h3>
                  <p className="text-sm text-gray-500 mt-2">Create your first project to get started.</p>
                  <div className="mt-4">
                    <button onClick={() => navigate('/projects')} className="bg-indigo-600 text-white px-4 py-2 rounded-xl">Create New Project</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Your Projects</h3>
                    <div className="text-sm text-gray-500">{projects.length} projects</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {projects.map(p => (
                        <div key={p.id} className="card p-4 min-h-[120px]">
                          <div className="flex items-center justify-between h-full">
                            <div>
                              <div className="font-semibold text-gray-800">{p.name}</div>
                              <div className="text-xs text-gray-400">{p.datasets_count || 0} datasets</div>
                            </div>
                            <div className="text-sm text-gray-500">{p.updated_at ? new Date(p.updated_at).toLocaleDateString() : ''}</div>
                          </div>
                        </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recent Changes */}
            <div className="mt-8 bg-white rounded-2xl shadow p-6">
              <h2 className="text-xl font-bold mb-4">Recent Changes</h2>
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="py-2 px-4">Project</th>
                    <th className="py-2 px-4">Dataset</th>
                    <th className="py-2 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 px-4">Demo Project</td>
                    <td className="py-2 px-4">Customers</td>
                    <td className="py-2 px-4"><span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">Approved</span></td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4">Demo Project</td>
                    <td className="py-2 px-4">Sales</td>
                    <td className="py-2 px-4"><span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">Pending</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Charts */}
            <div className="mt-8 bg-white rounded-2xl shadow p-6 text-center">
              <h2 className="text-xl font-bold mb-4">Charts</h2>
              <div className="h-48 flex items-center justify-center text-gray-400">[Chart Placeholder]</div>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProjects, getInboxUnreadCount } from '../api'
import Card from '../components/Card'
import ProjectModal from '../components/ProjectModal'
import { Plus, Activity, ArrowRight, Clock, CheckCircle2, AlertCircle, Folder, Bell } from 'lucide-react'

export default function DashboardPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [projs, unread] = await Promise.all([
          listProjects(),
          getInboxUnreadCount()
        ])
        if (mounted) {
          setProjects(projs || [])
          setUnreadCount(unread)

          // Mock activities for now, but using real project names if available
          const activities = [
            { id: 1, type: 'update', message: 'Dataset "Q3 Sales" updated', project: projs?.[0]?.name || 'Marketing Analytics', time: '2h ago' },
            { id: 2, type: 'create', message: 'New project created', project: projs?.[1]?.name || 'Customer Churn', time: '5h ago' },
            { id: 3, type: 'alert', message: 'Data validation warning', project: projs?.[0]?.name || 'Marketing Analytics', time: '1d ago' },
          ]
          setRecentActivities(activities)
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section with Mascot */}
      <div className="relative overflow-hidden rounded-3xl bg-surface-1/80 backdrop-blur-xl border border-divider p-8 shadow-2xl shadow-black/5">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-xs font-bold border border-primary/20 text-primary shadow-sm">
                v0.3.1 Beta
              </span>
              <span className="text-text-secondary text-sm font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                System Operational
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-text font-display drop-shadow-sm">
              Welcome back!
            </h1>
            <p className="text-text-secondary max-w-lg text-base leading-relaxed">
              Here's what's happening in your data universe today. Manage your projects, check alerts, and collaborate with your team.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => setOpen(true)}
                className="btn btn-primary flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
              >
                <Plus className="w-5 h-5" />
                Create Project
              </button>
              <button
                onClick={() => navigate('/projects')}
                className="px-5 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text font-bold border border-divider transition-colors hover:border-text-muted"
              >
                View All Projects
              </button>
            </div>
          </div>

          {/* Mascot Image */}
          <div className="hidden md:block relative w-72 h-72 -mr-12 -mb-16 perspective-1000">
            <img
              src="/images/oreo_rabbit.png"
              alt="Oreo Mascot"
              className="w-full h-full object-contain drop-shadow-2xl transform hover:scale-105 hover:rotate-3 transition-all duration-500 opacity-90"
            />
          </div>
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Quick Actions */}
        <div className="lg:col-span-2 space-y-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-6 rounded-2xl bg-surface-1 border border-divider hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform shadow-inner">
                  <Folder className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-full border border-success/20">+12%</span>
              </div>
              <h3 className="text-3xl font-bold text-text mb-1 tracking-tight">{projects.length}</h3>
              <p className="text-sm text-text-secondary font-medium">Active Projects</p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-1 border border-divider hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-secondary/10 text-secondary group-hover:scale-110 transition-transform shadow-inner">
                  <Activity className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-text-muted bg-surface-2 px-2 py-1 rounded-full border border-divider">Last 24h</span>
              </div>
              <h3 className="text-3xl font-bold text-text mb-1 tracking-tight">{recentActivities.length}</h3>
              <p className="text-sm text-text-secondary font-medium">Recent Activities</p>
            </div>

             <div className="p-6 rounded-2xl bg-surface-1 border border-divider hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5 group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-xl bg-warning/10 text-warning group-hover:scale-110 transition-transform shadow-inner">
                  <Bell className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-text-muted bg-surface-2 px-2 py-1 rounded-full border border-divider">Inbox</span>
              </div>
              <h3 className="text-3xl font-bold text-text mb-1 tracking-tight">{unreadCount}</h3>
              <p className="text-sm text-text-secondary font-medium">Unread Notifications</p>
            </div>
          </div>

          {/* Recent Projects */}
          <div className="rounded-2xl bg-surface-1 border border-divider overflow-hidden shadow-sm">
            <div className="p-6 border-b border-divider flex items-center justify-between bg-surface-1/50 backdrop-blur-sm">
              <h3 className="font-bold text-lg text-text flex items-center gap-2">
                <Folder className="w-5 h-5 text-primary" /> Recent Projects
              </h3>
              <button onClick={() => navigate('/projects')} className="text-sm text-primary hover:text-primary-hover font-bold flex items-center gap-1 hover:underline decoration-2 underline-offset-4">
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-divider">
              {loading ? (
                <div className="p-12 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : projects.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted shadow-inner">
                    <Plus className="w-8 h-8" />
                  </div>
                  <h4 className="text-text font-bold mb-1">No projects yet</h4>
                  <p className="text-sm text-text-secondary mb-6 max-w-xs mx-auto">Create your first project to start managing your datasets and workflows.</p>
                  <button onClick={() => setOpen(true)} className="btn btn-primary text-sm shadow-lg shadow-primary/20">Create Project</button>
                </div>
              ) : (
                projects.slice(0, 3).map((project) => (
                  <div key={project.name} className="p-5 hover:bg-surface-2/50 transition-colors flex items-center justify-between group cursor-pointer" onClick={() => navigate(`/projects/${project.name}`)}>
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-xl shadow-sm border border-primary/10 group-hover:scale-105 transition-transform">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-text group-hover:text-primary transition-colors text-lg">{project.name}</h4>
                        <p className="text-sm text-text-secondary line-clamp-1">{project.description || 'No description provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-xs font-medium text-text-muted bg-surface-2 px-2 py-1 rounded border border-divider">Updated 2h ago</span>
                      <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-text-muted group-hover:bg-primary group-hover:text-white transition-colors">
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Activity Feed */}
        <div className="space-y-8">
          <div className="rounded-2xl bg-surface-1 border border-divider p-6 h-full shadow-sm">
            <h3 className="font-bold text-lg text-text mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Activity Feed
            </h3>
            
            <div className="space-y-8 relative pl-2">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-3 bottom-3 w-0.5 bg-divider/50"></div>

              {recentActivities.map((activity, i) => (
                <div key={i} className="relative pl-10 group">
                  <div className={`absolute left-0 top-0 w-10 h-10 rounded-xl border-4 border-surface-1 flex items-center justify-center shadow-sm z-10 transition-transform group-hover:scale-110
                    ${activity.type === 'alert' ? 'bg-danger/10 text-danger' : 
                      activity.type === 'create' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {activity.type === 'alert' ? <AlertCircle className="w-5 h-5" /> : 
                     activity.type === 'create' ? <Plus className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  
                  <div className="bg-surface-2/30 p-4 rounded-xl border border-divider/50 hover:border-primary/20 hover:bg-surface-2/50 transition-colors">
                    <p className="text-sm font-bold text-text mb-1">{activity.message}</p>
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <span className="font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded">{activity.project}</span>
                      <span>•</span>
                      <span className="text-text-muted">{activity.time}</span>
                    </div>
                  </div>
                </div>
              ))}

              {recentActivities.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-3 text-text-muted">
                    <Bell className="w-6 h-6" />
                  </div>
                  <p className="text-sm text-text-secondary">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ProjectModal open={open} onClose={() => setOpen(false)} onCreate={() => window.location.reload()} />
    </div>
  )
}

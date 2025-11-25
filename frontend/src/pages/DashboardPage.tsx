import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProjects, getInboxUnreadCount } from '../api'
import Card from '../components/Card'
import ProjectModal from '../components/ProjectModal'
import { Plus, Activity, ArrowRight, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section with Mascot */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl shadow-slate-900/20">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold border border-white/10 text-blue-200">
                v0.3.1
              </span>
              <span className="text-slate-300 text-sm font-medium">Welcome back!</span>
            </div>
            <h1 className="text-4xl font-bold mb-3 tracking-tight">Dashboard</h1>
            <p className="text-slate-400 max-w-md text-sm leading-relaxed">
              Here's what's happening in your data universe today. Manage your projects, check alerts, and collaborate with your team.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => setOpen(true)}
                className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:scale-105 transition-all duration-300"
              >
                <Plus className="w-5 h-5" />
                Create Project
              </button>
              <button
                onClick={() => navigate('/projects')}
                className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl backdrop-blur-md border border-white/10 transition-all duration-300"
              >
                View All Projects
              </button>
            </div>
          </div>

          {/* Mascot Image */}
          <div className="hidden md:block relative w-64 h-64 -mr-8 -mb-12">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Quick Actions */}
        <div className="lg:col-span-2 space-y-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => navigate('/projects')}
              className="group cursor-pointer p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                  <Activity className="w-6 h-6" />
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-purple-500 transition-colors">
                  View Projects <ArrowRight className="w-3 h-3" />
                </span>
              </div>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{projects.length}</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Active Projects</p>
            </div>

            <div
              onClick={() => navigate('/inbox')}
              className="group cursor-pointer p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-blue-500 transition-colors">
                  View Inbox <ArrowRight className="w-3 h-3" />
                </span>
              </div>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{unreadCount}</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Pending Approvals</p>
            </div>
          </div>

          {/* Recent Activities */}
          <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-white dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-500" />
                Recent Activity
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${activity.type === 'alert' ? 'bg-red-500 shadow-lg shadow-red-500/50' :
                    activity.type === 'create' ? 'bg-blue-500 shadow-lg shadow-blue-500/50' :
                      'bg-emerald-500 shadow-lg shadow-emerald-500/50'
                    }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">
                      {activity.message}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {activity.project}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{activity.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Quick Tips / Mascot Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl bg-gradient-to-b from-slate-900 to-slate-800 p-6 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Pro Tips
              </h3>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex gap-2">
                  <span className="text-emerald-400">•</span>
                  Use the "Danger Zone" in project settings with caution.
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">•</span>
                  Invite team members to collaborate on datasets.
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">•</span>
                  Check your inbox daily for approval requests.
                </li>
              </ul>
            </div>
            {/* Subtle background pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          </div>
        </div>
      </div>

      <ProjectModal open={open} onClose={() => setOpen(false)} onCreate={() => {
        // Reload projects
        listProjects().then(setProjects)
      }} />
    </div>
  )
}

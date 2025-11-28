import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProjects, getInboxUnreadCount } from '../api'
import ProjectModal from '../components/ProjectModal'
import { Plus, FolderKanban, Bell, Activity, ArrowRight, Clock } from 'lucide-react'

export default function DashboardPage() {
  const [projects, setProjects] = useState<any[]>([])
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
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary mb-1">Welcome back</h1>
          <p className="text-sm text-text-secondary">Here's what's happening with your data projects</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="btn btn-primary"
        >
          <Plus size={18} />
          New Project
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<FolderKanban size={20} />}
          label="Projects"
          value={projects.length}
          onClick={() => navigate('/projects')}
        />
        <StatCard
          icon={<Bell size={20} />}
          label="Notifications"
          value={unreadCount}
          highlight={unreadCount > 0}
          onClick={() => navigate('/inbox')}
        />
        <StatCard
          icon={<Activity size={20} />}
          label="Recent Activity"
          value={projects.length > 0 ? 'Active' : 'None'}
          valueSmall
        />
      </div>

      {/* Recent Projects */}
      <div className="bg-surface-2 rounded-card border border-divider">
        <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">Recent Projects</h2>
          <button 
            onClick={() => navigate('/projects')} 
            className="text-sm text-primary hover:text-primary-glow transition-colors flex items-center gap-1"
          >
            View all <ArrowRight size={14} />
          </button>
        </div>
        
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center mx-auto mb-4">
              <FolderKanban size={24} className="text-text-muted" />
            </div>
            <h3 className="font-medium text-text-primary mb-1">No projects yet</h3>
            <p className="text-sm text-text-secondary mb-4">Create your first project to get started</p>
            <button onClick={() => setOpen(true)} className="btn btn-primary text-sm">
              <Plus size={16} />
              Create Project
            </button>
          </div>
        ) : (
          <div className="divide-y divide-divider">
            {projects.slice(0, 5).map((project) => (
              <div 
                key={project.id || project.name} 
                className="px-5 py-4 hover:bg-surface-3/50 transition-colors cursor-pointer flex items-center justify-between group"
                onClick={() => navigate(`/projects/${project.id || project.name}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary group-hover:text-primary transition-colors">
                      {project.name}
                    </h4>
                    <p className="text-sm text-text-secondary line-clamp-1">
                      {project.description || 'No description'}
                    </p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickAction
          title="Browse Projects"
          description="View and manage all your data projects"
          icon={<FolderKanban size={20} />}
          onClick={() => navigate('/projects')}
        />
        <QuickAction
          title="Check Inbox"
          description="Review notifications and approvals"
          icon={<Bell size={20} />}
          badge={unreadCount > 0 ? unreadCount : undefined}
          onClick={() => navigate('/inbox')}
        />
      </div>

      <ProjectModal open={open} onClose={() => setOpen(false)} onCreate={() => window.location.reload()} />
    </div>
  )
}

function StatCard({ icon, label, value, highlight, valueSmall, onClick }: {
  icon: React.ReactNode
  label: string
  value: string | number
  highlight?: boolean
  valueSmall?: boolean
  onClick?: () => void
}) {
  return (
    <div 
      className={`
        bg-surface-2 rounded-card border border-divider p-5 
        ${onClick ? 'cursor-pointer hover:border-primary/30 hover:bg-surface-3/50' : ''} 
        transition-all
      `}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${highlight ? 'bg-primary/10 text-primary' : 'bg-surface-3 text-text-secondary'}`}>
          {icon}
        </div>
      </div>
      <div className={`font-semibold text-text-primary ${valueSmall ? 'text-lg' : 'text-2xl'}`}>
        {value}
      </div>
      <div className="text-sm text-text-secondary mt-0.5">{label}</div>
    </div>
  )
}

function QuickAction({ title, description, icon, badge, onClick }: {
  title: string
  description: string
  icon: React.ReactNode
  badge?: number
  onClick: () => void
}) {
  return (
    <div 
      className="bg-surface-2 rounded-card border border-divider p-5 cursor-pointer hover:border-primary/30 hover:bg-surface-3/50 transition-all group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-surface-3 text-text-secondary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            {icon}
          </div>
          <div>
            <h3 className="font-medium text-text-primary group-hover:text-primary transition-colors flex items-center gap-2">
              {title}
              {badge !== undefined && badge > 0 && (
                <span className="badge badge-primary">{badge > 99 ? '99+' : badge}</span>
              )}
            </h3>
            <p className="text-sm text-text-secondary mt-0.5">{description}</p>
          </div>
        </div>
        <ArrowRight size={16} className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1" />
      </div>
    </div>
  )
}

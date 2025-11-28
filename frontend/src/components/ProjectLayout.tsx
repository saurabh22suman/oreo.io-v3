import { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ArrowLeft, Database, Users, Settings, LayoutDashboard } from 'lucide-react'

type ProjectLayoutProps = {
    project: any
    role?: string | null
    loading?: boolean
    children: ReactNode
}

export default function ProjectLayout({ project, role, loading, children }: ProjectLayoutProps) {
    const navigate = useNavigate()

    if (loading) {
        return <div className="p-8 text-center text-text-secondary">Loading project...</div>
    }

    if (!project) {
        return <div className="p-8 text-center text-danger">Project not found</div>
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Section */}
            <div className="relative overflow-hidden rounded-3xl bg-surface-1 border border-divider p-8 shadow-lg">
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex-1">
                        <button
                            onClick={() => navigate('/projects')}
                            className="flex items-center gap-2 text-text-secondary hover:text-text transition-colors mb-4 group text-sm font-medium"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Back to Projects
                        </button>

                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-xs font-bold border border-primary/20 text-primary">
                                Project Workspace
                            </span>
                        </div>
                        <h1 className="text-4xl font-bold mb-3 tracking-tight text-text font-display">{project.name}</h1>
                        <p className="text-text-secondary max-w-md text-sm leading-relaxed">
                            {project.description || 'Manage your datasets, collaborate with members, and configure project settings.'}
                        </p>
                    </div>
                </div>

                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-divider">
                <nav className="flex gap-8">
                    <NavLink
                        end
                        to={`/projects/${project.id}`}
                        className={({ isActive }) => `
              flex items-center gap-2 pb-4 text-sm font-medium border-b-2 transition-all
              ${isActive
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-text hover:border-divider'
                            }
            `}
                    >
                        <Database className="w-4 h-4" />
                        Datasets
                    </NavLink>
                    <NavLink
                        to={`/projects/${project.id}/members`}
                        className={({ isActive }) => `
              flex items-center gap-2 pb-4 text-sm font-medium border-b-2 transition-all
              ${isActive
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-text hover:border-divider'
                            }
            `}
                    >
                        <Users className="w-4 h-4" />
                        Members
                    </NavLink>
                    {role === 'owner' && (
                        <NavLink
                            to={`/projects/${project.id}/settings`}
                            className={({ isActive }) => `
                flex items-center gap-2 pb-4 text-sm font-medium border-b-2 transition-all
                ${isActive
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-text-secondary hover:text-text hover:border-divider'
                                }
              `}
                        >
                            <Settings className="w-4 h-4" />
                            Settings
                        </NavLink>
                    )}
                </nav>
            </div>

            {/* Content */}
            <div className="animate-fade-in">
                {children}
            </div>
        </div>
    )
}

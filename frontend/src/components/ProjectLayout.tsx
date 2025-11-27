import { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ArrowLeft, Database, Users, Settings } from 'lucide-react'

type ProjectLayoutProps = {
    project: any
    role?: string | null
    loading?: boolean
    children: ReactNode
}

export default function ProjectLayout({ project, role, loading, children }: ProjectLayoutProps) {
    const navigate = useNavigate()

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading project...</div>
    }

    if (!project) {
        return <div className="p-8 text-center text-red-500">Project not found</div>
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section with Mascot */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl shadow-slate-900/20">
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex-1">
                        <button
                            onClick={() => navigate('/projects')}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4 group"
                        >
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            Back to Projects
                        </button>

                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold border border-white/10 text-blue-200">
                                Project Workspace
                            </span>
                        </div>
                        <h1 className="text-4xl font-bold mb-3 tracking-tight">{project.name}</h1>
                        <p className="text-slate-300 max-w-md text-sm leading-relaxed">
                            {project.description || 'Manage your datasets, collaborate with members, and configure project settings.'}
                        </p>
                    </div>

                    {/* Mascot Image */}
                    <div className="hidden md:block relative w-48 h-48 -mr-4 -mb-8">
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

            {/* Navigation Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="flex gap-6">
                    <NavLink
                        end
                        to={`/projects/${project.id}`}
                        className={({ isActive }) => `
              flex items-center gap-2 pb-4 text-sm font-medium border-b-2 transition-all
              ${isActive
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300'
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
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300'
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
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300'
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
            <div>
                {children}
            </div>
        </div>
    )
}

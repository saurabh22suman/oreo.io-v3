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
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!project) {
        return (
            <div className="text-center py-12">
                <p className="text-danger">Project not found</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate('/projects')}
                    className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4 group"
                >
                    <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to Projects
                </button>

                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-text-primary mb-1">{project.name}</h1>
                        <p className="text-sm text-text-secondary">
                            {project.description || 'Manage datasets, members, and settings'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-divider">
                <nav className="flex gap-6">
                    <NavLink
                        end
                        to={`/projects/${project.id}`}
                        className={({ isActive }) => `
                            flex items-center gap-2 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors
                            ${isActive
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-text-primary'
                            }
                        `}
                    >
                        <Database size={16} />
                        Datasets
                    </NavLink>
                    <NavLink
                        to={`/projects/${project.id}/members`}
                        className={({ isActive }) => `
                            flex items-center gap-2 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors
                            ${isActive
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-text-primary'
                            }
                        `}
                    >
                        <Users size={16} />
                        Members
                    </NavLink>
                    {role === 'owner' && (
                        <NavLink
                            to={`/projects/${project.id}/settings`}
                            className={({ isActive }) => `
                                flex items-center gap-2 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors
                                ${isActive
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-text-secondary hover:text-text-primary'
                                }
                            `}
                        >
                            <Settings size={16} />
                            Settings
                        </NavLink>
                    )}
                </nav>
            </div>

            {/* Content */}
            <div>{children}</div>
        </div>
    )
}

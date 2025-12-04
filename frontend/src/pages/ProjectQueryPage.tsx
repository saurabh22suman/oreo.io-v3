import { useEffect, useState } from 'react'
import { Link, useSearchParams, useParams, useNavigate } from 'react-router-dom'
import { 
    RotateCcw, ShieldCheck, FileSearch, ArrowRight, FlaskConical, Pencil, Code2,
    AlertCircle, ArrowLeft, Database
} from 'lucide-react'
import { getDataset } from '../api'

type FeatureStatus = 'stable' | 'beta' | 'experimental'

type Feature = {
    id: string
    icon: React.ReactNode
    title: string
    description: string
    status: FeatureStatus
    path: string
}

export default function ProjectQueryPage() {
    const { id } = useParams<{ id: string }>()
    const [searchParams] = useSearchParams()
    const datasetId = searchParams.get('dataset')
    const [dataset, setDataset] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        if (datasetId && id) {
            setLoading(true)
            getDataset(Number(id), Number(datasetId))
                .then(setDataset)
                .catch(() => {})
                .finally(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [id, datasetId])

    const features: Feature[] = [
        {
            id: 'live-editor',
            icon: <Pencil size={16} />,
            title: 'Live Editor',
            description: 'Edit dataset cells directly with real-time validation and change tracking.',
            status: 'beta',
            path: datasetId ? `/projects/${id}/datasets/${datasetId}/live-edit` : '#',
        },
        {
            id: 'snapshots',
            icon: <RotateCcw size={16} />,
            title: 'Snapshots',
            description: 'View and restore previous versions of your dataset with full audit trail.',
            status: 'beta',
            path: datasetId ? `/projects/${id}/datasets/${datasetId}/snapshots` : '#',
        },
        {
            id: 'rules',
            icon: <ShieldCheck size={16} />,
            title: 'Business Rules',
            description: 'Define and enforce data quality rules and validation constraints.',
            status: 'stable',
            path: datasetId ? `/projects/${id}/datasets/${datasetId}/rules` : '#',
        },
        {
            id: 'audit',
            icon: <FileSearch size={16} />,
            title: 'Audit Log',
            description: 'Track all changes, access logs, and user activity with timestamps.',
            status: 'beta',
            path: datasetId ? `/projects/${id}/datasets/${datasetId}/audit` : '#',
        },
        {
            id: 'developer',
            icon: <Code2 size={16} />,
            title: 'Developer Tools',
            description: 'Run custom SQL queries and share results with public links.',
            status: 'beta',
            path: datasetId ? `/projects/${id}/datasets/${datasetId}/developer` : '#',
        },
    ]

    const getStatusBadge = (status: FeatureStatus) => {
        const styles = {
            stable: 'bg-success/10 text-success',
            beta: 'bg-info/10 text-info',
            experimental: 'bg-warning/10 text-warning',
        }
        return (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${styles[status]}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <button 
                            onClick={() => navigate(datasetId ? `/projects/${id}/datasets/${datasetId}` : `/projects/${id}`)}
                            className="text-text-muted hover:text-text-primary transition-colors"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <h1 className="text-2xl font-semibold text-text-primary">Experimental Features</h1>
                    </div>
                    <p className="text-sm text-text-secondary">Try cutting-edge tools in development</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FlaskConical size={20} className="text-primary" />
                </div>
            </div>

            {/* Dataset Info */}
            {datasetId && (
                <div className="bg-surface-2 border border-divider rounded-card p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Database size={18} className="text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-text-muted">Working with</p>
                            {loading ? (
                                <div className="h-5 w-32 bg-surface-3 rounded animate-pulse" />
                            ) : (
                                <p className="font-medium text-text-primary">{dataset?.name || 'Unknown Dataset'}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* No dataset warning */}
            {!datasetId && (
                <div className="text-center py-16 bg-surface-2 rounded-card border border-divider">
                    <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={24} className="text-warning" />
                    </div>
                    <h3 className="font-medium text-text-primary mb-1">No dataset selected</h3>
                    <p className="text-sm text-text-secondary mb-4">
                        Select a dataset from the project page to access experimental features
                    </p>
                    <button 
                        onClick={() => navigate(`/projects/${id}`)} 
                        className="btn btn-primary text-sm"
                    >
                        Go to Project
                    </button>
                </div>
            )}

            {/* Features Grid */}
            {datasetId && (
                <>
                    {loading ? (
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="h-32 rounded-card bg-surface-2 border border-divider animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {features.map((feature) => (
                                <Link
                                    key={feature.id}
                                    to={feature.path}
                                    className="bg-surface-2 border border-divider rounded-card p-5 cursor-pointer hover:border-primary/30 hover:bg-surface-3/50 transition-all group"
                                >
                                    {/* Icon */}
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
                                        {feature.icon}
                                    </div>

                                    {/* Content */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-medium text-text-primary group-hover:text-primary transition-colors">
                                            {feature.title}
                                        </h3>
                                        {getStatusBadge(feature.status)}
                                    </div>
                                    <p className="text-sm text-text-secondary line-clamp-2">
                                        {feature.description}
                                    </p>

                                    {/* Footer */}
                                    <div className="flex items-center gap-1 text-xs text-primary font-medium mt-4 pt-4 border-t border-divider group-hover:translate-x-0.5 transition-transform">
                                        Open
                                        <ArrowRight size={12} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

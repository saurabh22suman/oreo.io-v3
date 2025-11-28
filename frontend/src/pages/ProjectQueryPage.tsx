import { ReactNode } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import { RotateCcw, ShieldCheck, FileSearch, ArrowRight, FlaskConical, Pencil } from 'lucide-react'

export default function ProjectQueryPage() {
    const { id } = useParams<{ id: string }>()
    const [searchParams] = useSearchParams()
    const datasetId = searchParams.get('dataset')

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Section with Mascot */}
            <div className="relative overflow-hidden rounded-3xl bg-surface-1 border border-divider p-8 shadow-lg">
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-xs font-bold border border-primary/20 text-primary flex items-center gap-2">
                                <FlaskConical className="w-3 h-3" />
                                Oreo Labs
                            </span>
                        </div>
                        <h1 className="text-4xl font-bold mb-3 tracking-tight text-text font-display">Experimental Features</h1>
                        <p className="text-text-secondary max-w-md text-sm leading-relaxed">
                            Explore our experimental features in beta versions. These tools are in active development and may change.
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
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FeatureCard
                    icon={<Pencil className="w-6 h-6" />}
                    title="Live Editor"
                    description="Edit dataset cells directly with real-time validation and change tracking."
                    color="accent"
                    to={datasetId ? `/projects/${id}/datasets/${datasetId}/live-edit` : '#'}
                />

                <FeatureCard
                    icon={<RotateCcw className="w-6 h-6" />}
                    title="Snapshots"
                    description="View previous snapshots of data or restore it."
                    color="primary"
                    to={datasetId ? `/projects/${id}/datasets/${datasetId}/snapshots` : '#'}
                />

                <FeatureCard
                    icon={<ShieldCheck className="w-6 h-6" />}
                    title="Rules"
                    description="Define and enforce data quality rules and validation policies."
                    color="success"
                    to={datasetId ? `/projects/${id}/datasets/${datasetId}/rules` : '#'}
                />

                <FeatureCard
                    icon={<FileSearch className="w-6 h-6" />}
                    title="Audit"
                    description="Track changes, access logs, and monitor security events."
                    color="warning"
                    to={datasetId ? `/projects/${id}/datasets/${datasetId}/audit` : '#'}
                />
            </div>
        </div>
    )
}

function FeatureCard({ icon, title, description, color, to }: {
    icon: ReactNode
    title: string
    description: string
    color: 'primary' | 'accent' | 'success' | 'warning'
    to: string
}) {
    return (
        <Link
            to={to}
            className="group relative overflow-hidden rounded-2xl p-6 bg-surface-1 border border-divider transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/30"
        >
            <div className="relative z-10">
                <div className={`inline-flex p-3 rounded-xl bg-${color}/10 text-${color} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    {icon}
                </div>

                <h3 className="text-xl font-bold text-text mb-2 group-hover:text-primary transition-colors">{title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-6">
                    {description}
                </p>

                <div className={`flex items-center text-sm font-bold text-${color} group-hover:translate-x-1 transition-transform`}>
                    Explore
                    <ArrowRight className="w-4 h-4 ml-1" />
                </div>
            </div>
        </Link>
    )
}

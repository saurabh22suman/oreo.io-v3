import { ReactNode } from 'react'
import { Link, useSearchParams, useParams } from 'react-router-dom'
import { RotateCcw, ShieldCheck, FileSearch, ArrowRight, FlaskConical, Pencil } from 'lucide-react'

export default function ProjectQueryPage() {
    const { id } = useParams<{ id: string }>()
    const [searchParams] = useSearchParams()
    const datasetId = searchParams.get('dataset')

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section with Mascot */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 p-8 text-white shadow-2xl shadow-indigo-900/20">
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold border border-white/10 text-indigo-200 flex items-center gap-2">
                                <FlaskConical className="w-3 h-3" />
                                Oreo Labs
                            </span>
                        </div>
                        <h1 className="text-4xl font-bold mb-3 tracking-tight">Experimental Features</h1>
                        <p className="text-indigo-200 max-w-md text-sm leading-relaxed">
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
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FeatureCard
                    icon={<Pencil className="w-8 h-8" />}
                    title="Live Editor"
                    description="Edit dataset cells directly with real-time validation and change tracking."
                    color="purple"
                    to={datasetId ? `/projects/${id}/datasets/${datasetId}/live-edit` : '#'}
                />

                <FeatureCard
                    icon={<RotateCcw className="w-8 h-8" />}
                    title="Snapshots"
                    description="View previous snapshots of data or restore it."
                    color="blue"
                    to={datasetId ? `/projects/${id}/datasets/${datasetId}/snapshots` : '#'}
                />

                <FeatureCard
                    icon={<ShieldCheck className="w-8 h-8" />}
                    title="Rules"
                    description="Define and enforce data quality rules and validation policies."
                    color="emerald"
                    to={datasetId ? `/projects/${id}/datasets/${datasetId}/rules` : '#'}
                />

                <FeatureCard
                    icon={<FileSearch className="w-8 h-8" />}
                    title="Audit"
                    description="Track changes, access logs, and monitor security events."
                    color="amber"
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
    color: 'blue' | 'emerald' | 'amber' | 'purple'
    to: string
}) {
    const colors = {
        blue: 'from-blue-500 to-indigo-500 text-blue-600',
        emerald: 'from-emerald-500 to-teal-500 text-emerald-600',
        amber: 'from-amber-500 to-orange-500 text-amber-600',
        purple: 'from-purple-500 to-pink-500 text-purple-600',
    }

    const bgColors = {
        blue: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30',
        amber: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30',
        purple: 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30',
    }

    return (
        <Link
            to={to}
            className={`group relative overflow-hidden rounded-2xl p-6 border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${bgColors[color]}`}
        >
            <div className="relative z-10">
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${colors[color].split(' ').slice(0, 2).join(' ')} text-white mb-4 shadow-lg`}>
                    {icon}
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
                    {description}
                </p>

                <div className={`flex items-center text-sm font-bold ${colors[color].split(' ').pop()} group-hover:opacity-80 transition-opacity`}>
                    Explore
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
            </div>

            {/* Hover Gradient Overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${colors[color].split(' ').slice(0, 2).join(' ')} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
        </Link>
    )
}

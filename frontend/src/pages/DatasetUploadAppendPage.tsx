import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, Plus, ArrowRight, Workflow, ArrowLeft } from 'lucide-react'

export default function DatasetUploadAppendPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)

  return (
    <div className="min-h-screen bg-surface-1 text-text animate-fade-in">
      {/* Header Section */}
      <div className="bg-surface-1/50 backdrop-blur-sm border-b border-divider sticky top-0 z-40">
        <div className="max-w-full px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to={`/projects/${projectId}/datasets/${dsId}`}
              className="p-2 rounded-full hover:bg-surface-2 text-text-secondary hover:text-text transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text leading-tight font-display tracking-tight">Append Data</h1>
                <p className="text-text-secondary text-sm mt-1 font-medium">
                  Use the new approval workflow
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-surface-1/50 backdrop-blur-sm rounded-3xl border border-divider shadow-lg shadow-black/5 overflow-hidden">
          <div className="bg-surface-2/50 px-8 py-6 border-b border-divider flex items-center gap-4">
            <div className="p-3 rounded-xl bg-surface-1 shadow-sm border border-divider">
              <Workflow className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text">New Approval Workflow Available</h3>
              <p className="text-sm text-text-secondary font-medium">Enhanced data management with reviews</p>
            </div>
          </div>

          <div className="p-12 text-center">
            <div className="max-w-2xl mx-auto">
              <div className="inline-flex p-6 rounded-full bg-surface-2 mb-8 shadow-inner">
                <Workflow className="w-16 h-16 text-text-muted" />
              </div>

              <h2 className="text-3xl font-bold text-text mb-4 font-display tracking-tight">
                This Page Has Been Upgraded
              </h2>

              <p className="text-text-secondary mb-10 text-lg leading-relaxed">
                The legacy upload and append functionality has been replaced with our new <strong className="text-primary">Append Flow</strong> system.
                This provides better data validation, approval workflows, and collaboration features.
              </p>

              <div className="bg-surface-2/50 rounded-2xl p-8 mb-10 text-left border border-divider shadow-sm">
                <h3 className="font-bold text-text mb-6 flex items-center gap-3 text-lg">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <ArrowRight className="w-5 h-5 text-primary" />
                  </div>
                  How to Append Data:
                </h3>
                <ol className="space-y-4 text-base text-text-secondary">
                  <li className="flex gap-4 items-center group">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">1</span>
                    <span className="font-medium">Navigate back to the dataset details page</span>
                  </li>
                  <li className="flex gap-4 items-center group">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">2</span>
                    <span className="font-medium">Click the <strong className="text-text">"Append Data"</strong> action card</span>
                  </li>
                  <li className="flex gap-4 items-center group">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">3</span>
                    <span className="font-medium">Follow the new approval workflow for better collaboration</span>
                  </li>
                </ol>
              </div>

              <Link
                to={`/projects/${projectId}/datasets/${dsId}`}
                className="inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl shadow-lg shadow-primary/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-primary/40"
              >
                <ChevronLeft className="w-5 h-5" />
                Go to Dataset Details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

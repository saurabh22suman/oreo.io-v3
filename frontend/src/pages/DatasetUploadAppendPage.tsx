import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, Plus, ArrowRight, Workflow } from 'lucide-react'

export default function DatasetUploadAppendPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl shadow-slate-900/20">
        <div className="relative z-10">
          <Link
            to={`/projects/${projectId}/datasets/${dsId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white mb-4 transition-colors group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Dataset
          </Link>

          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 backdrop-blur-md">
              <Plus className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Append Data</h1>
              <p className="text-slate-300 text-sm mt-1">Use the new approval workflow</p>
            </div>
          </div>
        </div>

        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white shadow-sm">
            <Workflow className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">New Approval Workflow Available</h3>
            <p className="text-xs text-slate-600">Enhanced data management with reviews</p>
          </div>
        </div>

        <div className="p-8 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex p-4 rounded-full bg-slate-50 mb-6">
              <Workflow className="w-12 h-12 text-slate-600" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              This Page Has Been Upgraded
            </h2>

            <p className="text-slate-600 mb-6 leading-relaxed">
              The legacy upload and append functionality has been replaced with our new <strong>Append Flow</strong> system.
              This provides better data validation, approval workflows, and collaboration features.
            </p>

            <div className="bg-slate-50 rounded-xl p-6 mb-6 text-left border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-blue-600" />
                How to Append Data:
              </h3>
              <ol className="space-y-2 text-sm text-slate-700">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                  <span>Navigate back to the dataset details page</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                  <span>Click the <strong>"Append Data"</strong> action card</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold flex items-center justify-center">3</span>
                  <span>Follow the new approval workflow for better collaboration</span>
                </li>
              </ol>
            </div>

            <Link
              to={`/projects/${projectId}/datasets/${dsId}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:-translate-y-0.5"
            >
              <ChevronLeft className="w-5 h-5" />
              Go to Dataset Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

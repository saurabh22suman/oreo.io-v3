import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
  getDataset, 
  getProject, 
  listDatasetAuditEvents, 
  getAuditEvent,
  AuditEventListItem,
  AuditEventDetail 
} from '../api'
import Alert from '../components/Alert'
import Card from '../components/Card'
import {
  History,
  Pencil,
  Upload,
  FileText,
  Check,
  X,
  GitMerge,
  RotateCcw,
  Columns3,
  Shield,
  CheckCircle,
  Clock,
  ChevronRight,
  ArrowLeft,
  Filter,
  Loader2,
  FileWarning,
  BarChart3,
  Table2,
  AlertTriangle,
  AlertCircle,
  Trash2
} from 'lucide-react'

// Event type icon mapping
const eventTypeIcons: Record<string, React.ReactNode> = {
  edit: <Pencil className="w-4 h-4" />,
  append: <Upload className="w-4 h-4" />,
  upload: <Upload className="w-4 h-4" />,
  cr_created: <FileText className="w-4 h-4" />,
  cr_approved: <Check className="w-4 h-4" />,
  cr_rejected: <X className="w-4 h-4" />,
  cr_merged: <GitMerge className="w-4 h-4" />,
  cr_withdrawn: <X className="w-4 h-4" />,
  restore: <RotateCcw className="w-4 h-4" />,
  schema_change: <Columns3 className="w-4 h-4" />,
  rule_change: <Shield className="w-4 h-4" />,
  validation: <CheckCircle className="w-4 h-4" />,
}

// Event type color mapping for light/dark mode
const eventTypeColors: Record<string, string> = {
  edit: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  append: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  upload: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  cr_created: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  cr_approved: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  cr_rejected: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  cr_merged: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
  cr_withdrawn: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  restore: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  schema_change: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  rule_change: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  validation: 'bg-lime-100 text-lime-600 dark:bg-lime-900/30 dark:text-lime-400',
}

// Human-readable event type labels
const eventTypeLabels: Record<string, string> = {
  edit: 'Edit',
  append: 'Append',
  upload: 'Upload',
  cr_created: 'CR Created',
  cr_approved: 'CR Approved',
  cr_rejected: 'CR Rejected',
  cr_merged: 'CR Merged',
  cr_withdrawn: 'CR Withdrawn',
  restore: 'Restore',
  schema_change: 'Schema Change',
  rule_change: 'Rule Change',
  validation: 'Validation',
}

type Dataset = { id: number; name: string; schema?: string; rules?: string }

export default function DatasetAuditPage() {
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)

  const [project, setProject] = useState<any>(null)
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [events, setEvents] = useState<AuditEventListItem[]>([])
  const [selectedEvent, setSelectedEvent] = useState<AuditEventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [filterType, setFilterType] = useState<string>('')
  const [showDiff, setShowDiff] = useState(false)

  const limit = 20

  // Load project and dataset
  useEffect(() => {
    (async () => {
      try {
        setProject(await getProject(projectId))
        setDataset(await getDataset(projectId, dsId))
      } catch (e: any) {
        setError(e.message)
      }
    })()
  }, [projectId, dsId])

  // Load audit events
  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const result = await listDatasetAuditEvents(dsId, {
          limit,
          offset,
          type: filterType || undefined,
        })
        setEvents(result.events || [])
        setTotal(result.total || 0)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [dsId, offset, filterType])

  // Load event details when selected
  const handleEventClick = async (auditId: string) => {
    setLoadingDetails(true)
    setShowDiff(false)
    try {
      const detail = await getAuditEvent(auditId)
      setSelectedEvent(detail)
    } catch (e: any) {
      setError(`Failed to load event details: ${e.message}`)
    } finally {
      setLoadingDetails(false)
    }
  }

  // Format timestamp
  const formatTimestamp = (ts: string) => {
    const date = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'long' }) + ` at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }

  // Get display name for actor
  const getActorName = (event: AuditEventListItem | AuditEventDetail) => {
    if (event.actor_email) {
      const parts = event.actor_email.split('@')
      return parts[0]
    }
    return event.created_by?.replace('user_', 'User #') || 'System'
  }

  const hasMorePages = offset + limit < total

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {error && (
        <div className="fixed top-4 right-4 z-50">
          <Alert type="error" message={error} onClose={() => setError('')} />
        </div>
      )}

      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl shadow-slate-900/20">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Link
              to={`/projects/${projectId}/datasets/${dsId}`}
              className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors no-underline"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Dataset</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10">
              <History className="w-8 h-8 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold border border-white/10 text-blue-200">
                  Timeline
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Audit History</h1>
              <p className="text-slate-300 text-sm">
                {dataset?.name || `Dataset #${dsId}`} • {project?.name || 'Project'}
              </p>
            </div>
          </div>
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Timeline Panel (Left) */}
        <div className="w-[400px] flex-shrink-0">
          <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none">
            {/* Filter */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value)
                    setOffset(0)
                  }}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Events</option>
                  <option value="cr_created,cr_approved,cr_rejected,cr_merged,cr_withdrawn">Change Requests</option>
                  <option value="append,upload">Uploads</option>
                  <option value="edit">Edits</option>
                  <option value="restore">Restores</option>
                  <option value="schema_change,rule_change">Config Changes</option>
                  <option value="validation">Validations</option>
                </select>
              </div>
            </div>

            {/* Events List */}
            <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
              {loading ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : events.length === 0 ? (
                <div className="p-8 text-center">
                  <FileWarning className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-400">No audit events found</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Events will appear here as changes are made</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {events.map((event) => (
                    <li key={event.audit_id}>
                      <button
                        onClick={() => handleEventClick(event.audit_id)}
                        className={`w-full p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                          selectedEvent?.audit_id === event.audit_id ? 'bg-slate-100 dark:bg-slate-800/70' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${eventTypeColors[event.type] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {eventTypeIcons[event.type] || <FileText className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${eventTypeColors[event.type] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                {eventTypeLabels[event.type] || event.type}
                              </span>
                            </div>
                            <p className="text-slate-900 dark:text-white font-medium mt-1 truncate">{event.title}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                              <span>{getActorName(event)}</span>
                              <span>•</span>
                              <Clock className="w-3 h-3" />
                              <span>{formatTimestamp(event.timestamp)}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Pagination */}
            {events.length > 0 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-white dark:bg-slate-800/50">
                <span className="text-sm text-slate-500">
                  Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                    className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setOffset(offset + limit)}
                    disabled={!hasMorePages}
                    className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Event Details Panel (Center) */}
        <div className="flex-1">
          {loadingDetails ? (
            <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-none p-8 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </Card>
          ) : selectedEvent ? (
            <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none">
              {/* Event Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800/50">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${eventTypeColors[selectedEvent.type] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {eventTypeIcons[selectedEvent.type] || <FileText className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${eventTypeColors[selectedEvent.type] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {eventTypeLabels[selectedEvent.type] || selectedEvent.type}
                      </span>
                      {selectedEvent.snapshot_id && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {selectedEvent.snapshot_id.replace('snap_', 'Snapshot #')}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedEvent.title}</h2>
                    {selectedEvent.description && (
                      <p className="text-slate-600 dark:text-slate-400 mt-1">{selectedEvent.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                      <span>By {getActorName(selectedEvent)}</span>
                      <span>•</span>
                      <span>{formatTimestamp(selectedEvent.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Summary</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider mb-1">Rows Added</div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {selectedEvent.summary?.rows_added || 0}
                        </div>
                      </div>
                      <BarChart3 className="w-6 h-6 text-green-500 dark:text-green-400 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider mb-1">Rows Updated</div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {selectedEvent.summary?.rows_updated || 0}
                        </div>
                      </div>
                      <Table2 className="w-6 h-6 text-blue-500 dark:text-blue-400 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider mb-1">Rows Deleted</div>
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {selectedEvent.summary?.rows_deleted || 0}
                        </div>
                      </div>
                      <Trash2 className="w-6 h-6 text-red-500 dark:text-red-400 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider mb-1">Cells Changed</div>
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {selectedEvent.summary?.cells_changed || 0}
                        </div>
                      </div>
                      <Columns3 className="w-6 h-6 text-purple-500 dark:text-purple-400 opacity-50" />
                    </div>
                  </div>

                  {(selectedEvent.summary?.warnings || 0) > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-amber-600 dark:text-amber-400 text-xs uppercase tracking-wider mb-1">Warnings</div>
                          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                            {selectedEvent.summary.warnings}
                          </div>
                        </div>
                        <AlertTriangle className="w-6 h-6 text-amber-500 dark:text-amber-400 opacity-50" />
                      </div>
                    </div>
                  )}

                  {(selectedEvent.summary?.errors || 0) > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-red-600 dark:text-red-400 text-xs uppercase tracking-wider mb-1">Errors</div>
                          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {selectedEvent.summary.errors}
                          </div>
                        </div>
                        <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400 opacity-50" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="p-6">
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setShowDiff(false)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      !showDiff
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Details
                  </button>
                  {selectedEvent.diff && (
                    <button
                      onClick={() => setShowDiff(true)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        showDiff
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Diff
                    </button>
                  )}
                </div>

                {!showDiff ? (
                  <div className="space-y-4">
                    {/* Related CR */}
                    {selectedEvent.related_cr && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Related Change Request</h4>
                        <Link
                          to={`/projects/${projectId}/datasets/${dsId}/changes/${selectedEvent.related_cr.id}`}
                          className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors no-underline border border-slate-200 dark:border-slate-700"
                        >
                          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-slate-900 dark:text-white font-medium">
                              #{selectedEvent.related_cr.id} - {selectedEvent.related_cr.title}
                            </p>
                            <p className="text-sm text-slate-500">
                              {selectedEvent.related_cr.type} • {selectedEvent.related_cr.status}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </Link>
                      </div>
                    )}

                    {/* Metadata */}
                    {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Metadata</h4>
                        <pre className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-4 rounded-lg overflow-x-auto border border-slate-200 dark:border-slate-700">
                          {JSON.stringify(selectedEvent.metadata, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Validation */}
                    {selectedEvent.validation && Object.keys(selectedEvent.validation).length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Validation Report</h4>
                        <pre className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-4 rounded-lg overflow-x-auto border border-slate-200 dark:border-slate-700">
                          {JSON.stringify(selectedEvent.validation, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                    <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Changes</h4>
                    {selectedEvent.diff ? (
                      <DiffViewer diff={selectedEvent.diff} />
                    ) : (
                      <p className="text-slate-500 text-center py-4">No diff available</p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-none p-12 text-center">
              <History className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Select an Event</h3>
              <p className="text-slate-500 dark:text-slate-400">
                Click on an event in the timeline to view its details
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// Diff Viewer Component
function DiffViewer({ diff }: { diff: Record<string, any> }) {
  // Handle different diff formats
  if (diff.rows_added || diff.rows_updated || diff.rows_deleted) {
    return (
      <div className="space-y-4">
        {/* Added Rows */}
        {diff.rows_added?.length > 0 && (
          <div>
            <h5 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">
              Rows Added ({diff.rows_added.length})
            </h5>
            <div className="space-y-2">
              {diff.rows_added.slice(0, 10).map((row: any, idx: number) => (
                <div key={idx} className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-xs text-green-600 dark:text-green-400 font-mono mb-1">New row inserted</p>
                  <pre className="text-sm text-slate-700 dark:text-slate-300 overflow-x-auto">
                    {JSON.stringify(row, null, 2)}
                  </pre>
                </div>
              ))}
              {diff.rows_added.length > 10 && (
                <p className="text-sm text-slate-500 text-center">
                  ... and {diff.rows_added.length - 10} more rows
                </p>
              )}
            </div>
          </div>
        )}

        {/* Updated Rows */}
        {diff.rows_updated?.length > 0 && (
          <div>
            <h5 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">
              Rows Updated ({diff.rows_updated.length})
            </h5>
            <div className="space-y-2">
              {diff.rows_updated.slice(0, 10).map((update: any, idx: number) => (
                <div key={idx} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-mono mb-2">
                    Row ID: {update.id || update.row_id || idx}
                  </p>
                  {update.changes ? (
                    <div className="space-y-1">
                      {Object.entries(update.changes).map(([field, values]: [string, any]) => (
                        <div key={field} className="text-sm">
                          <span className="text-slate-500 dark:text-slate-400">{field}:</span>{' '}
                          <span className="text-red-600 dark:text-red-400 line-through">{String(values.old)}</span>{' '}
                          <span className="text-slate-400">→</span>{' '}
                          <span className="text-green-600 dark:text-green-400">{String(values.new)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="text-sm text-slate-700 dark:text-slate-300 overflow-x-auto">
                      {JSON.stringify(update, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
              {diff.rows_updated.length > 10 && (
                <p className="text-sm text-slate-500 text-center">
                  ... and {diff.rows_updated.length - 10} more rows
                </p>
              )}
            </div>
          </div>
        )}

        {/* Deleted Rows */}
        {diff.rows_deleted?.length > 0 && (
          <div>
            <h5 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
              Rows Deleted ({diff.rows_deleted.length})
            </h5>
            <div className="space-y-2">
              {diff.rows_deleted.slice(0, 10).map((row: any, idx: number) => (
                <div key={idx} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-xs text-red-600 dark:text-red-400 font-mono mb-1">Row deleted</p>
                  <pre className="text-sm text-slate-700 dark:text-slate-300 overflow-x-auto">
                    {JSON.stringify(row, null, 2)}
                  </pre>
                </div>
              ))}
              {diff.rows_deleted.length > 10 && (
                <p className="text-sm text-slate-500 text-center">
                  ... and {diff.rows_deleted.length - 10} more rows
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Fallback: raw JSON display
  return (
    <pre className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-4 rounded-lg overflow-x-auto border border-slate-200 dark:border-slate-700">
      {JSON.stringify(diff, null, 2)}
    </pre>
  )
}

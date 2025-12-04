import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
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
  ArrowRight,
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
  edit: 'bg-primary/10 text-primary border-primary/20',
  append: 'bg-success/10 text-success border-success/20',
  upload: 'bg-success/10 text-success border-success/20',
  cr_created: 'bg-accent/10 text-accent border-accent/20',
  cr_approved: 'bg-success/10 text-success border-success/20',
  cr_rejected: 'bg-error/10 text-error border-error/20',
  cr_merged: 'bg-primary/10 text-primary border-primary/20',
  cr_withdrawn: 'bg-warning/10 text-warning border-warning/20',
  restore: 'bg-warning/10 text-warning border-warning/20',
  schema_change: 'bg-accent/10 text-accent border-accent/20',
  rule_change: 'bg-primary/10 text-primary border-primary/20',
  validation: 'bg-success/10 text-success border-success/20',
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
  const nav = useNavigate()

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
    <div className="flex flex-col h-[calc(100vh-64px)] bg-surface-2 animate-fade-in">
      {error && (
        <div className="fixed top-4 right-4 z-50">
          <Alert type="error" message={error} onClose={() => setError('')} />
        </div>
      )}

      {/* Header Section */}
      <div className="bg-surface-1/50 backdrop-blur-sm border-b border-divider z-40">
        <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/projects/${projectId}/datasets/${dsId}`} className="p-2 rounded-full hover:bg-surface-2 text-text-secondary hover:text-text transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="h-6 w-px bg-divider" />
            <h1 className="text-xl font-bold text-text font-display">Audit History</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 min-h-0 w-full px-4 sm:px-6 py-6">
        {/* Timeline Panel (Left) */}
        <div className="w-[400px] flex-shrink-0 flex flex-col bg-surface-1 rounded-3xl border border-divider shadow-lg shadow-black/5 overflow-hidden">
          {/* Filter */}
          <div className="p-4 border-b border-divider bg-surface-1/50 backdrop-blur-sm z-10">
            <div className="flex items-center gap-2 bg-surface-2 rounded-xl px-3 py-2 border border-divider focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <Filter className="w-4 h-4 text-text-secondary" />
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value)
                  setOffset(0)
                }}
                className="flex-1 bg-transparent border-none text-sm text-text focus:outline-none cursor-pointer"
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
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-8 flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center h-full flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4">
                  <FileWarning className="w-8 h-8 text-text-muted" />
                </div>
                <p className="text-text font-medium">No audit events found</p>
                <p className="text-sm text-text-secondary mt-1">Events will appear here as changes are made</p>
              </div>
            ) : (
              <ul className="divide-y divide-divider">
                {events.map((event) => (
                  <li key={event.audit_id}>
                    <button
                      onClick={() => handleEventClick(event.audit_id)}
                      className={`w-full p-4 text-left hover:bg-surface-2/50 transition-all duration-200 group ${
                        selectedEvent?.audit_id === event.audit_id 
                          ? 'bg-primary/5 border-l-4 border-primary pl-3' 
                          : 'pl-4 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl border shadow-sm transition-transform group-hover:scale-105 ${eventTypeColors[event.type] || 'bg-surface-2 text-text-secondary border-divider'}`}>
                          {eventTypeIcons[event.type] || <FileText className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${eventTypeColors[event.type] || 'bg-surface-2 text-text-secondary border-divider'}`}>
                              {eventTypeLabels[event.type] || event.type}
                            </span>
                          </div>
                          <p className={`text-sm font-bold truncate mb-1 ${selectedEvent?.audit_id === event.audit_id ? 'text-primary' : 'text-text'}`}>
                            {event.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <span className="font-medium text-text">{getActorName(event)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimestamp(event.timestamp)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${selectedEvent?.audit_id === event.audit_id ? 'text-primary translate-x-1' : 'text-text-muted group-hover:text-text'}`} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pagination */}
          {events.length > 0 && (
            <div className="p-4 border-t border-divider flex items-center justify-between bg-surface-1/50 backdrop-blur-sm z-10">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                {offset + 1}-{Math.min(offset + limit, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-surface-2 hover:bg-surface-3 text-text rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-divider"
                >
                  Prev
                </button>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={!hasMorePages}
                  className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-surface-2 hover:bg-surface-3 text-text rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-divider"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Event Details Panel (Center) */}
        <div className="flex-1 min-w-0">
          {loadingDetails ? (
            <div className="bg-surface-1 rounded-3xl border border-divider shadow-lg shadow-black/5 p-8 flex items-center justify-center h-full">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
          ) : selectedEvent ? (
            <div className="bg-surface-1 rounded-3xl border border-divider shadow-lg shadow-black/5 overflow-hidden h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Event Header */}
              <div className="p-8 border-b border-divider bg-surface-1/50 backdrop-blur-sm">
                <div className="flex items-start gap-5">
                  <div className={`p-4 rounded-2xl border shadow-sm ${eventTypeColors[selectedEvent.type] || 'bg-surface-2 text-text-secondary border-divider'}`}>
                    {eventTypeIcons[selectedEvent.type] ? (
                      <div className="w-8 h-8 flex items-center justify-center [&>svg]:w-8 [&>svg]:h-8">
                        {eventTypeIcons[selectedEvent.type]}
                      </div>
                    ) : <FileText className="w-8 h-8" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${eventTypeColors[selectedEvent.type] || 'bg-surface-2 text-text-secondary border-divider'}`}>
                        {eventTypeLabels[selectedEvent.type] || selectedEvent.type}
                      </span>
                      {selectedEvent.snapshot_id && (
                        <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-surface-2 text-text-secondary border border-divider">
                          {selectedEvent.snapshot_id.replace('snap_', 'Snapshot #')}
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-text font-display mb-2">{selectedEvent.title}</h2>
                    {selectedEvent.description && (
                      <p className="text-text-secondary text-lg leading-relaxed">{selectedEvent.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-4 text-sm text-text-secondary font-medium">
                      <span className="flex items-center gap-2 bg-surface-2 px-3 py-1.5 rounded-lg border border-divider">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        {getActorName(selectedEvent)}
                      </span>
                      <span className="flex items-center gap-2 bg-surface-2 px-3 py-1.5 rounded-lg border border-divider">
                        <Clock className="w-4 h-4" />
                        {new Date(selectedEvent.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Summary Cards */}
                <div className="p-8 border-b border-divider bg-surface-1/30">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Impact Summary
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-success/5 rounded-2xl p-5 border border-success/20 hover:bg-success/10 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Rows Added</div>
                          <div className="text-3xl font-bold text-success font-display">
                            {selectedEvent.summary?.rows_added || 0}
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-success/10 text-success">
                          <BarChart3 className="w-6 h-6" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-primary/5 rounded-2xl p-5 border border-primary/20 hover:bg-primary/10 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Rows Updated</div>
                          <div className="text-3xl font-bold text-primary font-display">
                            {selectedEvent.summary?.rows_updated || 0}
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                          <Table2 className="w-6 h-6" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-error/5 rounded-2xl p-5 border border-error/20 hover:bg-error/10 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Rows Deleted</div>
                          <div className="text-3xl font-bold text-error font-display">
                            {selectedEvent.summary?.rows_deleted || 0}
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-error/10 text-error">
                          <Trash2 className="w-6 h-6" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-accent/5 rounded-2xl p-5 border border-accent/20 hover:bg-accent/10 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Cells Changed</div>
                          <div className="text-3xl font-bold text-accent font-display">
                            {selectedEvent.summary?.cells_changed || 0}
                          </div>
                        </div>
                        <div className="p-2 rounded-xl bg-accent/10 text-accent">
                          <Columns3 className="w-6 h-6" />
                        </div>
                      </div>
                    </div>

                    {(selectedEvent.summary?.warnings || 0) > 0 && (
                      <div className="bg-warning/5 rounded-2xl p-5 border border-warning/20 hover:bg-warning/10 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-warning text-xs font-bold uppercase tracking-wider mb-1">Warnings</div>
                            <div className="text-3xl font-bold text-warning font-display">
                              {selectedEvent.summary.warnings}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-warning/10 text-warning">
                            <AlertTriangle className="w-6 h-6" />
                          </div>
                        </div>
                      </div>
                    )}

                    {(selectedEvent.summary?.errors || 0) > 0 && (
                      <div className="bg-error/5 rounded-2xl p-5 border border-error/20 hover:bg-error/10 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-error text-xs font-bold uppercase tracking-wider mb-1">Errors</div>
                            <div className="text-3xl font-bold text-error font-display">
                              {selectedEvent.summary.errors}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-error/10 text-error">
                            <AlertCircle className="w-6 h-6" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="p-8">
                  <div className="flex gap-2 mb-6 bg-surface-2 p-1 rounded-xl inline-flex border border-divider">
                    <button
                      onClick={() => setShowDiff(false)}
                      className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${
                        !showDiff
                          ? 'bg-surface-1 text-primary shadow-sm'
                          : 'text-text-secondary hover:text-text hover:bg-surface-3'
                      }`}
                    >
                      Details
                    </button>
                    {selectedEvent.diff && (
                      <button
                        onClick={() => setShowDiff(true)}
                        className={`px-6 py-2 text-sm font-bold rounded-lg transition-all ${
                          showDiff
                            ? 'bg-surface-1 text-primary shadow-sm'
                            : 'text-text-secondary hover:text-text hover:bg-surface-3'
                        }`}
                      >
                        Diff
                      </button>
                    )}
                  </div>

                  {!showDiff ? (
                    <div className="space-y-6">
                      {/* Related CR */}
                      {selectedEvent.related_cr && (
                        <div className="bg-surface-2/30 rounded-2xl p-6 border border-divider">
                          <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Related Change Request</h4>
                          <Link
                            to={`/projects/${projectId}/datasets/${dsId}/changes/${selectedEvent.related_cr.id}`}
                            className="flex items-center gap-4 p-4 bg-surface-1 rounded-xl hover:bg-surface-2 transition-all no-underline border border-divider hover:border-primary/30 group shadow-sm"
                          >
                            <div className="p-3 rounded-xl bg-accent/10 text-accent group-hover:scale-110 transition-transform">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <p className="text-text font-bold text-lg group-hover:text-primary transition-colors">
                                #{selectedEvent.related_cr.id} - {selectedEvent.related_cr.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-2 text-text-secondary border border-divider">
                                  {selectedEvent.related_cr.type}
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-2 text-text-secondary border border-divider">
                                  {selectedEvent.related_cr.status}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
                          </Link>
                        </div>
                      )}

                      {/* Metadata */}
                      {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                        <div className="bg-surface-2/30 rounded-2xl p-6 border border-divider">
                          <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Metadata</h4>
                          <pre className="text-sm text-text font-mono bg-surface-1 p-6 rounded-xl overflow-x-auto border border-divider shadow-inner">
                            {JSON.stringify(selectedEvent.metadata, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Validation */}
                      {selectedEvent.validation && Object.keys(selectedEvent.validation).length > 0 && (
                        <div className="bg-surface-2/30 rounded-2xl p-6 border border-divider">
                          <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Validation Report</h4>
                          <pre className="text-sm text-text font-mono bg-surface-1 p-6 rounded-xl overflow-x-auto border border-divider shadow-inner">
                            {JSON.stringify(selectedEvent.validation, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-surface-2/30 rounded-2xl p-6 border border-divider">
                      <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Changes</h4>
                      {selectedEvent.diff ? (
                        <DiffViewer diff={selectedEvent.diff} />
                      ) : (
                        <div className="text-center py-12">
                          <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-3">
                            <FileText className="w-6 h-6 text-text-muted" />
                          </div>
                          <p className="text-text-secondary font-medium">No diff available</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface-1 rounded-3xl border border-divider shadow-lg shadow-black/5 p-12 text-center h-full flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-surface-2 flex items-center justify-center mb-6 shadow-inner">
                <History className="w-12 h-12 text-text-muted" />
              </div>
              <h3 className="text-2xl font-bold text-text mb-2 font-display">Select an Event</h3>
              <p className="text-text-secondary text-lg max-w-md">
                Click on an event in the timeline to view its full details, impact analysis, and data changes.
              </p>
            </div>
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
      <div className="space-y-6">
        {/* Added Rows */}
        {diff.rows_added?.length > 0 && (
          <div>
            <h5 className="text-sm font-bold text-success mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success"></div>
              Rows Added ({diff.rows_added.length})
            </h5>
            <div className="space-y-3">
              {diff.rows_added.slice(0, 10).map((row: any, idx: number) => (
                <div key={idx} className="bg-success/5 border border-success/20 rounded-xl p-4 hover:bg-success/10 transition-colors">
                  <p className="text-xs text-success font-bold font-mono mb-2 uppercase tracking-wider">New row inserted</p>
                  <pre className="text-sm text-text font-mono overflow-x-auto custom-scrollbar">
                    {JSON.stringify(row, null, 2)}
                  </pre>
                </div>
              ))}
              {diff.rows_added.length > 10 && (
                <p className="text-sm text-text-secondary text-center font-medium py-2">
                  ... and {diff.rows_added.length - 10} more rows
                </p>
              )}
            </div>
          </div>
        )}

        {/* Updated Rows */}
        {diff.rows_updated?.length > 0 && (
          <div>
            <h5 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              Rows Updated ({diff.rows_updated.length})
            </h5>
            <div className="space-y-3">
              {diff.rows_updated.slice(0, 10).map((update: any, idx: number) => (
                <div key={idx} className="bg-primary/5 border border-primary/20 rounded-xl p-4 hover:bg-primary/10 transition-colors">
                  <p className="text-xs text-primary font-bold font-mono mb-3 uppercase tracking-wider">
                    Row ID: {update.id || update.row_id || idx}
                  </p>
                  {update.changes ? (
                    <div className="space-y-2">
                      {Object.entries(update.changes).map(([field, values]: [string, any]) => (
                        <div key={field} className="text-sm font-mono bg-surface-1/50 p-2 rounded border border-primary/10 flex items-center gap-3">
                          <span className="text-text-secondary font-bold min-w-[100px]">{field}:</span>
                          <span className="text-error line-through opacity-70">{String(values.old)}</span>
                          <ArrowRight className="w-3 h-3 text-text-muted" />
                          <span className="text-success font-bold">{String(values.new)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre className="text-sm text-text font-mono overflow-x-auto custom-scrollbar">
                      {JSON.stringify(update, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
              {diff.rows_updated.length > 10 && (
                <p className="text-sm text-text-secondary text-center font-medium py-2">
                  ... and {diff.rows_updated.length - 10} more rows
                </p>
              )}
            </div>
          </div>
        )}

        {/* Deleted Rows */}
        {diff.rows_deleted?.length > 0 && (
          <div>
            <h5 className="text-sm font-bold text-error mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-error"></div>
              Rows Deleted ({diff.rows_deleted.length})
            </h5>
            <div className="space-y-3">
              {diff.rows_deleted.slice(0, 10).map((row: any, idx: number) => (
                <div key={idx} className="bg-error/5 border border-error/20 rounded-xl p-4 hover:bg-error/10 transition-colors">
                  <p className="text-xs text-error font-bold font-mono mb-2 uppercase tracking-wider">Row deleted</p>
                  <pre className="text-sm text-text font-mono overflow-x-auto custom-scrollbar">
                    {JSON.stringify(row, null, 2)}
                  </pre>
                </div>
              ))}
              {diff.rows_deleted.length > 10 && (
                <p className="text-sm text-text-secondary text-center font-medium py-2">
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
    <pre className="text-sm text-text font-mono bg-surface-1 p-6 rounded-xl overflow-x-auto border border-divider shadow-inner">
      {JSON.stringify(diff, null, 2)}
    </pre>
  )
}
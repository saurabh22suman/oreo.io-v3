// Use relative /api by default so Nginx (prod) and Vite dev proxy both work.
const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function register(email: string, password: string) {
  const r = await fetch(`${API_BASE}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), credentials: 'include' })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}
export async function login(email: string, password: string) {
  // Perform login. Backend may set an httpOnly cookie. Do not assume client-side token storage.
  const r = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), credentials: 'include' })
  if (!r.ok) throw new Error(await r.text())
  const data = await r.json();
  // If backend returns a token (fallback), persist it; otherwise rely on cookie
  if (data?.token) localStorage.setItem('token', data.token)
  return data
}

// Google login: send ID token from Google Identity Services to backend and receive app JWT
export async function loginWithGoogleIdToken(idToken: string) {
  const r = await fetch(`${API_BASE}/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_token: idToken }), credentials: 'include' })
  if (!r.ok) throw new Error(await r.text())
  const data = await r.json(); if (data?.token) localStorage.setItem('token', data.token); return data
}

export async function me() {
  // check session via cookie or token
  const r = await fetch(`${API_BASE}/auth/me`, { headers: { ...authHeaders() }, credentials: 'include' })
  return r.ok
}

// Get current authenticated user details (id, email, role)
export async function currentUser(): Promise<{ ok: boolean; id: number; email: string; role: string }> {
  const r = await fetch(`${API_BASE}/auth/me`, { headers: { ...authHeaders() }, credentials: 'include' })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function logout() {
  // Always clear any locally stored token so subsequent requests won't authenticate via Authorization header
  try { localStorage.removeItem('token') } catch { }
  const r = await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { ...authHeaders() }, credentials: 'include' })
  if (!r.ok) {
    // Even if server call fails, treat client as logged out (cookie may already be gone)
    try { const msg = await r.text(); throw new Error(msg) } catch { throw new Error('logout_failed') }
  }
  return r.json()
}

export async function listProjects() {
  const r = await fetch(`${API_BASE}/projects`, { headers: { ...authHeaders() }, credentials: 'include' })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function createProject(name: string, description?: string) {
  const body: any = { name }
  if (description && description.trim() !== '') body.description = description
  const r = await fetch(`${API_BASE}/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body), credentials: 'include' })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function deleteProject(projectId: number) {
  const r = await fetch(`${API_BASE}/projects/${projectId}`, { method: 'DELETE', headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text())
  return true
}
export async function getProject(id: number) {
  const r = await fetch(`${API_BASE}/projects/${id}`, { headers: { ...authHeaders() }, credentials: 'include' })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function updateProject(id: number, patch: Partial<{ name: string; description: string }>) {
  const body: any = {}
  if (typeof patch.name === 'string') body.name = patch.name
  if (typeof patch.description === 'string') body.description = patch.description
  const r = await fetch(`${API_BASE}/projects/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body), credentials: 'include' })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function getDataset(projectId: number, datasetId: number) {
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}`, { headers: { ...authHeaders() }, credentials: 'include' })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
// Members (RBAC)
export async function listMembers(projectId: number) {
  const r = await fetch(`${API_BASE}/projects/${projectId}/members`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function upsertMember(projectId: number, email: string, role: 'owner' | 'contributor' | 'viewer' | 'editor') {
  const r = await fetch(`${API_BASE}/projects/${projectId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ email, role }) })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function myProjectRole(projectId: number): Promise<{ role: 'owner' | 'contributor' | 'viewer' | null }> {
  const r = await fetch(`${API_BASE}/projects/${projectId}/members/me`, { headers: authHeaders() }); if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function removeMember(projectId: number, userId: number) {
  const r = await fetch(`${API_BASE}/projects/${projectId}/members/${userId}`, { method: 'DELETE', headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text()); return true
}
export async function listDatasets(projectId: number) {
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function createDataset(projectId: number, name: string) {
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ name }) })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function updateDataset(projectId: number, datasetId: number, patch: Partial<{ name: string; schema: string; rules: string }>) {
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(patch) })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function deleteDataset(projectId: number, datasetId: number) {
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}`, { method: 'DELETE', headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text()); return true
}
export async function uploadDatasetFile(projectId: number, datasetId: number, file: File) {
  const form = new FormData(); form.append('file', file)
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}/upload`, { method: 'POST', headers: { ...authHeaders() }, body: form })
  if (!r.ok) {
    try {
      const body = await r.json()
      const msg = body?.message || body?.error || (await r.text())
      throw new Error(r.status === 413 ? (body?.message || 'File too large. Max allowed size is 100 MB.') : msg)
    } catch {
      throw new Error(r.status === 413 ? 'File too large. Max allowed size is 100 MB.' : 'Upload failed')
    }
  }
  return r.json()
}
export async function getDatasetSample(projectId: number, datasetId: number) {
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}/sample`, { headers: { ...authHeaders() } })
  if (!r.ok) {
    // try to read structured error
    let msg = 'Failed to load preview'
    try {
      const body = await r.json()
      msg = body?.message || body?.error || msg
    } catch {
      try { msg = await r.text() } catch { }
    }
    throw new Error(msg)
  }
  return r.json()
}
export async function appendUpload(projectId: number, datasetId: number, file: File, reviewerId?: number) {
  // Legacy direct append with optional reviewer_id (kept for compatibility)
  const form = new FormData(); form.append('file', file); if (reviewerId) form.append('reviewer_id', String(reviewerId))
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}/append`, { method: 'POST', headers: { ...authHeaders() }, body: form })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}

// New: preview the file about to be appended with pagination (without storing permanently)
export async function previewAppend(projectId: number, datasetId: number, file: File, limit = 500, offset = 0) {
  const form = new FormData(); form.append('file', file)
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}/append/preview?limit=${limit}&offset=${offset}`, { method: 'POST', headers: { ...authHeaders() }, body: form })
  if (!r.ok) {
    try { const b = await r.json(); throw new Error(b?.message || b?.error || 'Preview failed') } catch (e: any) { throw new Error(e?.message || 'Preview failed') }
  }
  return r.json()
}

// New: submit edited rows (JSON) as an append change
export async function appendEditedJSON(projectId: number, datasetId: number, rows: any[], filename = 'edited.json', reviewerId?: number) {
  const body: any = { rows, filename }
  if (reviewerId) body.reviewer_id = reviewerId
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}/append/json`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}

// Validate arbitrary data against a JSON Schema via Python service (proxied by Go)
export async function validateData(schema: any, data: any) {
  const r = await fetch(`${API_BASE}/data/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ json_schema: schema, data }) })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}

// Data operations
export async function transformData(data: any[], ops: any[]) {
  const r = await fetch(`${API_BASE}/data/transform`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ data, ops }) })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}

export async function exportData(data: any[], format: 'json' | 'csv' = 'json') {
  const r = await fetch(`${API_BASE}/data/export`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ data, format }) })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}

// Infer JSON Schema from a file (CSV/XLSX) via python-service
export async function inferSchemaFromFile(file: File) {
  const form = new FormData(); form.append('file', file)
  const r = await fetch(`${API_BASE}/data/infer-schema`, { method: 'POST', headers: { ...authHeaders() }, body: form })
  if (!r.ok) {
    try { const b = await r.json(); throw new Error(b?.message || b?.error || 'Inference failed') } catch (e: any) { throw new Error(e?.message || 'Inference failed') }
  }
  return r.json()
}

// Validate data against business rules via python-service
export async function validateRules(data: any[], rules: any[]) {
  const r = await fetch(`${API_BASE}/data/rules/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ data, rules }) })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}

// Change Requests (workflow)
export async function listChanges(projectId: number) {
  const r = await fetch(`${API_BASE}/projects/${projectId}/changes`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function approveChange(projectId: number, changeId: number) {
  const r = await fetch(`${API_BASE}/projects/${projectId}/changes/${changeId}/approve`, { method: 'POST', headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function rejectChange(projectId: number, changeId: number) {
  const r = await fetch(`${API_BASE}/projects/${projectId}/changes/${changeId}/reject`, { method: 'POST', headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function withdrawChange(projectId: number, changeId: number) {
  const r = await fetch(`${API_BASE}/projects/${projectId}/changes/${changeId}/withdraw`, { method: 'POST', headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}

// ---- Inbox (notifications) ----
export type InboxItem = { id: number; user_id: number; message: string; is_read: boolean; metadata?: any; created_at: string }
export async function listInbox(status: 'all' | 'read' | 'unread' = 'all', limit = 50, offset = 0) {
  const params = new URLSearchParams(); if (status && status !== 'all') params.set('status', status); if (limit) params.set('limit', String(limit)); if (offset) params.set('offset', String(offset))
  const r = await fetch(`${API_BASE}/security/notifications?${params.toString()}`, { headers: { ...authHeaders() }, credentials: 'include' })
  if (!r.ok) throw new Error(await r.text()); const body = await r.json(); return { items: body.items as InboxItem[], total: Number(body.total ?? 0) }
}
export async function markInboxRead(ids: number[]) {
  const r = await fetch(`${API_BASE}/security/notifications/read`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ ids }) })
  if (!r.ok) throw new Error(await r.text()); return true
}
export async function markInboxUnread(ids: number[]) {
  const r = await fetch(`${API_BASE}/security/notifications/unread`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ ids }) })
  if (!r.ok) throw new Error(await r.text()); return true
}
export async function getInboxUnreadCount() {
  const r = await fetch(`${API_BASE}/security/notifications/unread_count`, { headers: { ...authHeaders() }, credentials: 'include' })
  if (!r.ok) throw new Error(await r.text()); const body = await r.json(); return Number(body.count || 0)
}
export async function deleteInboxMessages(ids: number[]) {
  const r = await fetch(`${API_BASE}/security/notifications`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ ids }) })
  if (!r.ok) throw new Error(await r.text()); return true
}

// Subscribe to SSE stream for notifications. Returns an unsubscribe function.
export function subscribeNotifications(onEvent: (evt: { type: string;[k: string]: any }) => void) {
  // Use absolute or relative base
  const url = `${API_BASE}/security/notifications/stream`
  const es = new EventSource(url, { withCredentials: true })
  es.onmessage = (e) => {
    try { const data = JSON.parse(e.data); onEvent(data) } catch { /* ignore */ }
  }
  // no retry handler; EventSource auto-reconnects
  return () => { try { es.close() } catch { } }
}

// ---- Top-level dataset endpoints ----
export async function createDatasetTop(projectId: number, payload: { name: string; dataset_name?: string; schema?: string; table?: string; source?: string; target?: { type?: string; dsn?: string } }) {
  const r = await fetch(`${API_BASE}/datasets`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ project_id: projectId, ...payload }) })
  if (!r.ok) {
    let msg = 'Create failed'
    try {
      const text = await r.text().catch(() => '')
      if (text) {
        try { const b = JSON.parse(text); msg = b?.message || b?.error || msg } catch { msg = text || msg }
      }
    } catch { }
    throw new Error(msg)
  }
  return r.json()
}

// Prepare dataset (atomic create with optional file upload). Accepts multipart form.
export async function prepareDataset(projectId: number, fields: { name: string; schema?: string; table?: string; source?: string }, file?: File) {
  const form = new FormData()
  form.append('project_id', String(projectId))
  form.append('name', fields.name)
  if (fields.schema) form.append('schema', fields.schema)
  if (fields.table) form.append('table', fields.table)
  if (fields.source) form.append('source', fields.source)
  if (file) form.append('file', file)
  const r = await fetch(`${API_BASE}/datasets/prepare`, { method: 'POST', headers: { ...authHeaders() }, body: form })
  if (!r.ok) {
    try { const b = await r.json(); throw new Error(b?.message || b?.error || 'Prepare failed') } catch (e: any) { throw new Error(e?.message || 'Prepare failed') }
  }
  return r.json()
}

// Stage upload - first step of two-step dataset creation
export async function stageUpload(projectId: number, file: File): Promise<{ staging_id: string; filename: string; row_count: number; schema: any }> {
  const form = new FormData()
  form.append('project_id', String(projectId))
  form.append('file', file)
  const r = await fetch(`${API_BASE}/datasets/stage-upload`, { method: 'POST', headers: { ...authHeaders() }, body: form })
  if (!r.ok) {
    try { const b = await r.json(); throw new Error(b?.message || b?.error || 'Stage upload failed') } catch (e: any) { throw new Error(e?.message || 'Stage upload failed') }
  }
  return r.json()
}

// Finalize dataset - second step of two-step dataset creation
export async function finalizeDataset(params: { 
  project_id: number; 
  staging_id: string; 
  name: string; 
  schema: string; 
  table: string; 
  target_schema: string; 
  source: string 
}): Promise<{ id: number; project_id: number; name: string }> {
  const r = await fetch(`${API_BASE}/datasets/finalize`, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', ...authHeaders() }, 
    body: JSON.stringify(params) 
  })
  if (!r.ok) {
    try { const b = await r.json(); throw new Error(b?.message || b?.error || 'Finalize failed') } catch (e: any) { throw new Error(e?.message || 'Finalize failed') }
  }
  return r.json()
}

// Delete staged upload
export async function deleteStagedUpload(stagingId: string): Promise<void> {
  const r = await fetch(`${API_BASE}/datasets/staging/${stagingId}`, { method: 'DELETE', headers: { ...authHeaders() } })
  if (!r.ok) {
    console.warn('Failed to delete staged upload:', stagingId)
  }
}

export async function getDatasetSchemaTop(datasetId: number) {
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/schema`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function setDatasetSchemaTop(datasetId: number, schema: any) {
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/schema`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ schema: typeof schema === 'string' ? schema : JSON.stringify(schema) }) })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function setDatasetRulesTop(datasetId: number, rules: any) {
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ rules: typeof rules === 'string' ? rules : JSON.stringify(rules) }) })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function appendDatasetDataTop(datasetId: number, file: File, reviewerId?: number) {
  // New two-step: validate first, then open
  const form = new FormData(); form.append('file', file)
  const v = await fetch(`${API_BASE}/datasets/${datasetId}/data/append/validate`, { method: 'POST', headers: { ...authHeaders() }, body: form })
  if (!v.ok) {
    try { const b = await v.json(); throw new Error(b?.message || b?.error || 'Validate failed') } catch (e: any) { throw new Error(e?.message || 'Validate failed') }
  }
  const vr = await v.json()
  return vr
}
export async function getDatasetDataTop(datasetId: number, limit = 50, offset = 0) {
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/data?limit=${limit}&offset=${offset}`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function getDatasetStatsTop(datasetId: number) {
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/stats`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}

// Validate edited rows first; returns { ok, upload_id }
export async function validateEditedJSONTop(datasetId: number, rows: any[], filename = 'edited.json') {
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/data/append/json/validate`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ rows, filename }) })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}

// New: open a change after successful validation
export async function openAppendChangeTop(datasetId: number, uploadId: number, reviewerId: number | number[]) {
  const body = Array.isArray(reviewerId) ? { upload_id: uploadId, reviewer_ids: reviewerId } : { upload_id: uploadId, reviewer_id: reviewerId }
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/data/append/open`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
// List approvals for a dataset (defaults to status=pending)
export async function listDatasetApprovalsTop(datasetId: number, status: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'all' = 'pending') {
  const params = new URLSearchParams(); if (status) params.set('status', status)
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/approvals?${params.toString()}`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}
export async function queryDatasetTop(datasetId: number, sqlOrWhere: string | Record<string, any>, limit = 100, offset = 0) {
  // Backend currently accepts a simple JSON filter in body.where or returns all.
  const body = typeof sqlOrWhere === 'string' ? { where: {}, limit, offset } : { where: sqlOrWhere, limit, offset }
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/query`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}

// Lightweight Postgres table existence check
export async function checkTableExists(schema: string, table: string): Promise<{ exists: boolean; message?: string }> {
  const params = new URLSearchParams({ schema, table })
  const r = await fetch(`${API_BASE}/check_table_exists?${params.toString()}`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text()); return r.json()
}

// =====================
// Audit Page APIs
// =====================

export interface AuditEventSummary {
  rows_added: number
  rows_updated: number
  rows_deleted: number
  cells_changed: number
  warnings: number
  errors: number
}

export interface AuditEventListItem {
  audit_id: string
  snapshot_id: string
  type: string
  title: string
  created_by: string
  actor_email: string
  timestamp: string
  summary: AuditEventSummary
  metadata?: Record<string, any>
}

export interface AuditEventDetail extends AuditEventListItem {
  description?: string
  diff_path?: string
  validation_path?: string
  metadata_path?: string
  diff?: Record<string, any>
  validation?: Record<string, any>
  related_cr?: {
    id: number
    title: string
    type: string
    status: string
  }
}

// List audit events for a dataset
export async function listDatasetAuditEvents(
  datasetId: number,
  opts?: { limit?: number; offset?: number; type?: string }
): Promise<{ events: AuditEventListItem[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams()
  if (opts?.limit) params.set('limit', String(opts.limit))
  if (opts?.offset) params.set('offset', String(opts.offset))
  if (opts?.type) params.set('type', opts.type)
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/audit?${params.toString()}`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

// Get details for a specific audit event
export async function getAuditEvent(auditId: string): Promise<AuditEventDetail> {
  const r = await fetch(`${API_BASE}/audit/${auditId}`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

// Get diff for an audit event
export async function getAuditEventDiff(auditId: string): Promise<Record<string, any>> {
  const r = await fetch(`${API_BASE}/audit/${auditId}/diff`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

// Get validation report for an audit event
export async function getAuditEventValidation(auditId: string): Promise<Record<string, any>> {
  const r = await fetch(`${API_BASE}/audit/${auditId}/validation`, { headers: { ...authHeaders() } })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

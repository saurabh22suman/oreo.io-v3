// Use relative /api by default so Nginx (prod) and Vite dev proxy both work.
const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function register(email: string, password: string){
  const r = await fetch(`${API_BASE}/auth/register`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email,password}), credentials: 'include'})
  if(!r.ok) throw new Error(await r.text())
  return r.json()
}
export async function login(email: string, password: string){
  // Perform login. Backend may set an httpOnly cookie. Do not assume client-side token storage.
  const r = await fetch(`${API_BASE}/auth/login`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email,password}), credentials: 'include'})
  if(!r.ok) throw new Error(await r.text())
  const data = await r.json();
  // If backend returns a token (fallback), persist it; otherwise rely on cookie
  if(data?.token) localStorage.setItem('token', data.token)
  return data
}

// Google login: send ID token from Google Identity Services to backend and receive app JWT
export async function loginWithGoogleIdToken(idToken: string){
  const r = await fetch(`${API_BASE}/auth/google`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id_token: idToken }), credentials: 'include'})
  if(!r.ok) throw new Error(await r.text())
  const data = await r.json(); if(data?.token) localStorage.setItem('token', data.token); return data
}

export async function me(){
  // check session via cookie or token
  const r = await fetch(`${API_BASE}/auth/me`, {headers:{...authHeaders()}, credentials: 'include'})
  return r.ok
}

// Get current authenticated user details (id, email, role)
export async function currentUser(): Promise<{ ok: boolean; id: number; email: string; role: string }>{
  const r = await fetch(`${API_BASE}/auth/me`, { headers: { ...authHeaders() }, credentials: 'include' })
  if(!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function logout(){
  const r = await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { ...authHeaders() }, credentials: 'include' })
  if(!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function listProjects(){
  const r = await fetch(`${API_BASE}/projects`, {headers:{...authHeaders()}, credentials: 'include'})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function createProject(name: string, description?: string){
  const body: any = { name }
  if (description && description.trim() !== '') body.description = description
  const r = await fetch(`${API_BASE}/projects`, {method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify(body), credentials: 'include'})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function getProject(id: number){
  const r = await fetch(`${API_BASE}/projects/${id}`, {headers:{...authHeaders()}, credentials: 'include'})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function getDataset(projectId: number, datasetId: number){
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}`, {headers:{...authHeaders()}, credentials: 'include'})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
// Members (RBAC)
export async function listMembers(projectId: number){
  const r = await fetch(`${API_BASE}/projects/${projectId}/members`, {headers:{...authHeaders()}})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function upsertMember(projectId: number, email: string, role: 'owner'|'contributor'|'approver'|'viewer'|'editor'){
  const r = await fetch(`${API_BASE}/projects/${projectId}/members`, {method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({email, role})})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function myProjectRole(projectId: number): Promise<{ role: 'owner'|'contributor'|'approver'|'viewer'|null }>{
  const r = await fetch(`${API_BASE}/projects/${projectId}/members/me`, {headers: authHeaders()}); if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function removeMember(projectId: number, userId: number){
  const r = await fetch(`${API_BASE}/projects/${projectId}/members/${userId}`, {method:'DELETE', headers:{...authHeaders()}})
  if(!r.ok) throw new Error(await r.text()); return true
}
export async function listDatasets(projectId: number){
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets`, {headers:{...authHeaders()}})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function createDataset(projectId: number, name: string){
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets`, {method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({name})})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function updateDataset(projectId: number, datasetId: number, patch: Partial<{name:string; schema:string; rules:string}>){
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}`, {method:'PUT', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify(patch)})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function deleteDataset(projectId: number, datasetId: number){
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}`, {method:'DELETE', headers:{...authHeaders()}})
  if(!r.ok) throw new Error(await r.text()); return true
}
export async function uploadDatasetFile(projectId: number, datasetId: number, file: File){
  const form = new FormData(); form.append('file', file)
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}/upload`, {method:'POST', headers:{...authHeaders()}, body: form})
  if(!r.ok){
    try{
      const body = await r.json()
      const msg = body?.message || body?.error || (await r.text())
      throw new Error(r.status === 413 ? (body?.message || 'File too large. Max allowed size is 100 MB.') : msg)
    }catch{
      throw new Error(r.status === 413 ? 'File too large. Max allowed size is 100 MB.' : 'Upload failed')
    }
  }
  return r.json()
}
export async function getDatasetSample(projectId: number, datasetId: number){
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}/sample`, {headers:{...authHeaders()}})
  if(!r.ok){
    // try to read structured error
    let msg = 'Failed to load preview'
    try {
      const body = await r.json()
      msg = body?.message || body?.error || msg
    } catch {
      try { msg = await r.text() } catch {}
    }
    throw new Error(msg)
  }
  return r.json()
}
export async function appendUpload(projectId: number, datasetId: number, file: File, reviewerId?: number){
  // Legacy direct append with optional reviewer_id (kept for compatibility)
  const form = new FormData(); form.append('file', file); if(reviewerId) form.append('reviewer_id', String(reviewerId))
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}/append`, {method:'POST', headers:{...authHeaders()}, body: form})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}

// New: preview the file about to be appended with pagination (without storing permanently)
export async function previewAppend(projectId: number, datasetId: number, file: File, limit = 500, offset = 0){
  const form = new FormData(); form.append('file', file)
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}/append/preview?limit=${limit}&offset=${offset}`,{ method:'POST', headers:{...authHeaders()}, body: form })
  if(!r.ok){
    try{ const b = await r.json(); throw new Error(b?.message || b?.error || 'Preview failed') }catch(e:any){ throw new Error(e?.message || 'Preview failed') }
  }
  return r.json()
}

// New: submit edited rows (JSON) as an append change
export async function appendEditedJSON(projectId: number, datasetId: number, rows: any[], filename = 'edited.json', reviewerId?: number){
  const body: any = { rows, filename }
  if(reviewerId) body.reviewer_id = reviewerId
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}/append/json`, { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify(body) })
  if(!r.ok) throw new Error(await r.text()); return r.json()
}

// Validate arbitrary data against a JSON Schema via Python service (proxied by Go)
export async function validateData(schema: any, data: any){
  const r = await fetch(`${API_BASE}/data/validate`, {method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({ json_schema: schema, data })})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}

// Data operations
export async function transformData(data: any[], ops: any[]){
  const r = await fetch(`${API_BASE}/data/transform`, {method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({ data, ops })})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}

export async function exportData(data: any[], format: 'json'|'csv' = 'json'){
  const r = await fetch(`${API_BASE}/data/export`, {method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({ data, format })})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}

// Infer JSON Schema from a file (CSV/XLSX) via python-service
export async function inferSchemaFromFile(file: File){
  const form = new FormData(); form.append('file', file)
  const r = await fetch(`${API_BASE}/data/infer-schema`, { method:'POST', headers:{...authHeaders()}, body: form })
  if(!r.ok){
    try{ const b = await r.json(); throw new Error(b?.message || b?.error || 'Inference failed') }catch(e:any){ throw new Error(e?.message || 'Inference failed') }
  }
  return r.json()
}

// Validate data against business rules via python-service
export async function validateRules(data: any[], rules: any[]){
  const r = await fetch(`${API_BASE}/data/rules/validate`, { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({ data, rules }) })
  if(!r.ok) throw new Error(await r.text()); return r.json()
}

// Change Requests (workflow)
export async function listChanges(projectId: number){
  const r = await fetch(`${API_BASE}/projects/${projectId}/changes`, {headers:{...authHeaders()}})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function approveChange(projectId: number, changeId: number){
  const r = await fetch(`${API_BASE}/projects/${projectId}/changes/${changeId}/approve`, {method:'POST', headers:{...authHeaders()}})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function rejectChange(projectId: number, changeId: number){
  const r = await fetch(`${API_BASE}/projects/${projectId}/changes/${changeId}/reject`, {method:'POST', headers:{...authHeaders()}})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function withdrawChange(projectId: number, changeId: number){
  const r = await fetch(`${API_BASE}/projects/${projectId}/changes/${changeId}/withdraw`, {method:'POST', headers:{...authHeaders()}})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}

// ---- Top-level dataset endpoints ----
export async function createDatasetTop(projectId: number, payload: { name: string; source?: string; target?: { type?: string; dsn?: string } }){
  const r = await fetch(`${API_BASE}/datasets`, { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({ project_id: projectId, ...payload }) })
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function getDatasetSchemaTop(datasetId: number){
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/schema`, { headers:{...authHeaders()} })
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function setDatasetSchemaTop(datasetId: number, schema: any){
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/schema`, { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({ schema: typeof schema === 'string' ? schema : JSON.stringify(schema) }) })
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function setDatasetRulesTop(datasetId: number, rules: any){
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/rules`, { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({ rules: typeof rules === 'string' ? rules : JSON.stringify(rules) }) })
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function appendDatasetDataTop(datasetId: number, file: File, reviewerId?: number){
  // New two-step: validate first, then open
  const form = new FormData(); form.append('file', file)
  const v = await fetch(`${API_BASE}/datasets/${datasetId}/data/append/validate`, { method:'POST', headers:{...authHeaders()}, body: form })
  if(!v.ok){
    try{ const b = await v.json(); throw new Error(b?.message || b?.error || 'Validate failed') }catch(e:any){ throw new Error(e?.message || 'Validate failed') }
  }
  const vr = await v.json()
  return vr
}
export async function getDatasetDataTop(datasetId: number, limit = 50, offset = 0){
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/data?limit=${limit}&offset=${offset}`, { headers:{...authHeaders()} })
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function getDatasetStatsTop(datasetId: number){
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/stats`, { headers:{...authHeaders()} })
  if(!r.ok) throw new Error(await r.text()); return r.json()
}

// Validate edited rows first; returns { ok, upload_id }
export async function validateEditedJSONTop(datasetId: number, rows: any[], filename = 'edited.json'){
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/data/append/json/validate`, { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({ rows, filename }) })
  if(!r.ok) throw new Error(await r.text()); return r.json()
}

// New: open a change after successful validation
export async function openAppendChangeTop(datasetId: number, uploadId: number, reviewerId: number | number[]){
  const body = Array.isArray(reviewerId) ? { upload_id: uploadId, reviewer_ids: reviewerId } : { upload_id: uploadId, reviewer_id: reviewerId }
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/data/append/open`, { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify(body) })
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function queryDatasetTop(datasetId: number, sqlOrWhere: string | Record<string, any>, limit = 100, offset = 0){
  // Backend currently accepts a simple JSON filter in body.where or returns all.
  const body = typeof sqlOrWhere === 'string' ? { where: {}, limit, offset } : { where: sqlOrWhere, limit, offset }
  const r = await fetch(`${API_BASE}/datasets/${datasetId}/query`, { method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify(body) })
  if(!r.ok) throw new Error(await r.text()); return r.json()
}

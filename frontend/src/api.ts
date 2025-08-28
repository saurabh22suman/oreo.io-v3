// Use relative /api by default so Nginx (prod) and Vite dev proxy both work.
const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function register(email: string, password: string){
  const r = await fetch(`${API_BASE}/auth/register`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email,password})})
  if(!r.ok) throw new Error(await r.text())
  return r.json()
}
export async function login(email: string, password: string){
  const r = await fetch(`${API_BASE}/auth/login`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email,password})})
  if(!r.ok) throw new Error(await r.text())
  const data = await r.json(); localStorage.setItem('token', data.token); return data
}

export async function me(){
  const r = await fetch(`${API_BASE}/auth/me`, {headers:{...authHeaders()}})
  return r.ok
}

export async function listProjects(){
  const r = await fetch(`${API_BASE}/projects`, {headers:{...authHeaders()}})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function createProject(name: string){
  const r = await fetch(`${API_BASE}/projects`, {method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({name})})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function getProject(id: number){
  const r = await fetch(`${API_BASE}/projects/${id}`, {headers:{...authHeaders()}})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function getDataset(projectId: number, datasetId: number){
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}`, {headers:{...authHeaders()}})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
// Members (RBAC)
export async function listMembers(projectId: number){
  const r = await fetch(`${API_BASE}/projects/${projectId}/members`, {headers:{...authHeaders()}})
  if(!r.ok) throw new Error(await r.text()); return r.json()
}
export async function upsertMember(projectId: number, email: string, role: 'owner'|'editor'|'approver'|'viewer'){
  const r = await fetch(`${API_BASE}/projects/${projectId}/members`, {method:'POST', headers:{'Content-Type':'application/json', ...authHeaders()}, body: JSON.stringify({email, role})})
  if(!r.ok) throw new Error(await r.text()); return r.json()
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
  if(!r.ok) throw new Error(await r.text()); return r.json()
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
export async function appendUpload(projectId: number, datasetId: number, file: File){
  const form = new FormData(); form.append('file', file)
  const r = await fetch(`${API_BASE}/projects/${projectId}/datasets/${datasetId}/append`, {method:'POST', headers:{...authHeaders()}, body: form})
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

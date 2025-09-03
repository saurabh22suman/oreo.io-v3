import React, { useEffect, useState, useMemo, useRef } from 'react'
import ProjectModal from '../components/ProjectModal'
import { listProjects, currentUser } from '../api'
import { useNavigate } from 'react-router-dom'
import { useCollapse } from '../context/CollapseContext'
// MembersPopover removed from Projects list per UX requirements

type Project = {
  id: string
  name: string
  description?: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'name'|'datasets'|'modified'>('name')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [user, setUser] = useState(null)
  const navigate = useNavigate()
  const { collapsed } = useCollapse()
  const tableRef = useRef<HTMLTableElement | null>(null)

  // column widths: persist percentages in localStorage, but keep px widths while dragging for smooth UX
  const STORAGE_KEY = 'projects.table.columnWidths.v1'
  // savedPctWidths holds persisted percentages (0-100)
  const [savedPctWidths, setSavedPctWidths] = useState<{name?: number; datasets?: number; modified?: number}>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    } catch (e) {}
    return {}
  })

  // transient px widths while dragging
  const [columnPxDuringDrag, setColumnPxDuringDrag] = useState<{name?: number; datasets?: number; modified?: number} | null>(null)

  const resizing = useRef<{col?: string; startX?: number; startWidth?: number} | null>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await listProjects()
      setProjects(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const handler = (e: any) => { try { const pid = e?.detail?.projectId; if(!pid) load(); else load() } catch {} }
    window.addEventListener('dataset:created', handler)
    return () => window.removeEventListener('dataset:created', handler)
  }, [])

  useEffect(() => {
    currentUser().then(u => setUser(u)).catch(() => setUser(null))
  }, [])

  const sorted = useMemo(() => {
    const copy = [...projects]
    copy.sort((a, b) => {
      if (sortBy === 'name') return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      if (sortBy === 'datasets') return sortDir === 'asc' ? (a['datasetCount']||0) - (b['datasetCount']||0) : (b['datasetCount']||0) - (a['datasetCount']||0)
      if (sortBy === 'modified') return sortDir === 'asc' ? (new Date(a['modified'] || 0).getTime() - new Date(b['modified'] || 0).getTime()) : (new Date(b['modified'] || 0).getTime() - new Date(a['modified'] || 0).getTime())
      return 0
    })
    return copy
  }, [projects, sortBy, sortDir])

  useEffect(() => {
    // mouse move updates px widths transiently; mouse up converts to percentages and persists
    function onMove(e: MouseEvent) {
      if (!resizing.current || !resizing.current.col) return
      const delta = (e.clientX - (resizing.current.startX || 0))
      const raw = Math.max(80, (resizing.current.startWidth || 0) + delta)
      // snap to 8px grid for stable widths
      const snapped = Math.round(raw / 8) * 8
      const newW = Math.max(60, snapped)
      setColumnPxDuringDrag(prev => ({ ...(prev||{}), [resizing.current!.col!]: newW }))
    }

    function onUp() {
      // convert current px widths into percentages relative to table width and persist
      try {
        const table = tableRef.current
        if (!table) { resizing.current = null; setColumnPxDuringDrag(null); return }
        const total = table.getBoundingClientRect().width || table.clientWidth || 1
        const finalPx: {[k:string]: number} = {}
        const cols: Array<'name'|'datasets'|'modified'> = ['name','datasets','modified']
        cols.forEach((col, idx) => {
          if (columnPxDuringDrag && typeof columnPxDuringDrag[col] === 'number') {
            finalPx[col] = columnPxDuringDrag[col] as number
          } else {
            const th = table.querySelectorAll('th')[idx] as HTMLElement | undefined
            finalPx[col] = th ? Math.max(60, th.getBoundingClientRect().width) : 0
          }
        })
        const pctObj: {[k:string]: number} = {}
        cols.forEach(col => { pctObj[col] = Math.round((finalPx[col] / total) * 10000) / 100 })
        setSavedPctWidths(pctObj as any)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pctObj)) } catch (e) {}
      } finally {
        resizing.current = null
        setColumnPxDuringDrag(null)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [columnPxDuringDrag])

  function startResize(col: 'name'|'datasets'|'modified', e: React.MouseEvent) {
    const table = tableRef.current
    let startWidth = 0
    if (table) {
      const ths = table.querySelectorAll('th')
      const idx = col === 'name' ? 0 : col === 'datasets' ? 1 : 2
      const th = ths[idx] as HTMLElement | undefined
      startWidth = th ? th.getBoundingClientRect().width : 0
    }
    resizing.current = { col, startX: e.clientX, startWidth: startWidth }
    // initialize transient px width state
    setColumnPxDuringDrag(prev => ({ ...(prev||{}), [col]: startWidth }))
    e.preventDefault()
  }

  function onRowKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/projects/${id}`) }
  }

  return (
        <>
      {/* Intro section */}
      <div className="mb-6 flex flex-col md:flex-row gap-6 items-start">
        <div className="w-36 flex-shrink-0">
          {/* tutorial illustration */}
          <img src="/images/tutorial_image.png" alt="Tutorial" className="w-full mascot-bounce" />
        </div>
        <div className="flex-1 rounded-lg p-5" style={{ background: 'linear-gradient(180deg,#ffffff 0%, #fbfdff 100%)' }}>
          <h1 className="text-3xl font-extrabold text-slate-900">Projects</h1>
          <p className="muted-small mt-2 max-w-2xl">Organize related datasets into projects, invite members, and collaborate with clear ownership and roles.</p>
        </div>
        <div className="self-start">
          <button onClick={() => setOpen(true)} className="create-cta inline-flex items-center px-5 py-2 rounded-md">+ Create Project</button>
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="projects-table overflow-auto rounded-md">
          <table ref={tableRef} className="min-w-full bg-white">
            <thead>
              <tr className="text-left text-sm text-slate-600">
                <th className="p-3" style={{ width: '40%' }}>
                  <div className="flex items-center gap-2">
                    <button aria-label="Sort by name" className="sort-btn" onClick={() => { setSortBy('name'); setSortDir(sortBy==='name' && sortDir==='asc' ? 'desc' : 'asc') }}>
                      Name
                    </button>
                    {sortBy==='name' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        {sortDir==='asc' ? <path d="M7 14l5-5 5 5H7z" fill="#374151"/> : <path d="M7 10l5 5 5-5H7z" fill="#374151"/>}
                      </svg>
                    )}
                    {/* fixed widths per spec; resizer disabled */}
                  </div>
                </th>
                <th className="p-3 text-right" style={{ width: '10%' }}>
                  <div className="flex items-center justify-end gap-2">
                    <button aria-label="Sort by datasets" className="sort-btn" onClick={() => { setSortBy('datasets'); setSortDir(sortBy==='datasets' && sortDir==='asc' ? 'desc' : 'asc') }}>Datasets</button>
                    {sortBy==='datasets' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        {sortDir==='asc' ? <path d="M7 14l5-5 5 5H7z" fill="#374151"/> : <path d="M7 10l5 5 5-5H7z" fill="#374151"/>}
                      </svg>
                    )}
                    {/* fixed widths per spec; resizer disabled */}
                  </div>
                </th>
                <th className="p-3 text-right" style={{ width: '20%' }}>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-sm text-slate-600">Role</span>
                  </div>
                </th>
                <th className="p-3 text-right" style={{ width: '30%' }}>
                  <div className="flex items-center justify-end gap-2">
                    <button aria-label="Sort by modified" className="sort-btn" onClick={() => { setSortBy('modified'); setSortDir(sortBy==='modified' && sortDir==='asc' ? 'desc' : 'asc') }}>Last Modified</button>
                    {sortBy==='modified' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        {sortDir==='asc' ? <path d="M7 14l5-5 5 5H7z" fill="#374151"/> : <path d="M7 10l5 5 5-5H7z" fill="#374151"/>}
                      </svg>
                    )}
                    {/* fixed widths per spec; resizer disabled */}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
        {sorted.map((p) => (
                <tr key={p.id} className="border-t row-clickable" onClick={() => navigate(`/projects/${p.id}`)} onKeyDown={(e)=>onRowKeyDown(e, p.id)} tabIndex={0} role="button">
                  <td className="p-2 compact name-col"> <div className="font-semibold text-slate-800 name-cell truncate" title={p.name}>{p.name}</div></td>
                    <td className="p-2 compact text-right">{p['datasetCount'] || 0}</td>
                    <td className="p-2 compact text-right"><div className="text-sm text-slate-700">{p['role'] || ''}</div></td>
                    <td className="p-2 compact text-right">{
                    (()=>{
                      const v = p['modified'] || p['updated_at'] || p['last_activity'] || p['lastModified']
                      return v ? new Date(v).toLocaleString() : '-'
                    })()
                  }</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProjectModal open={open} onClose={() => setOpen(false)} onCreate={() => load()} />
  </>
  )
}

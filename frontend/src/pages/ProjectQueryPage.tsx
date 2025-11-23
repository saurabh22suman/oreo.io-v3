import { useState, useEffect, Suspense, lazy } from 'react'
import Spinner from '../components/Spinner'
import { useParams } from 'react-router-dom'
import AgGridDialog from '../components/AgGridDialog'
// Keep the lazy import at module scope so the editor component remains stable
const MonacoEditor = lazy(() => import('@monaco-editor/react'))

type ResultSet = {
    columns: string[]
    rows: any[][]
}

export default function ProjectQueryPage() {
    const { id } = useParams<{ id: string }>()
    const [tab, setTab] = useState<'sql' | 'python' | 'saved'>('sql')
    const [sql, setSql] = useState<string>('SELECT * FROM information_schema.tables LIMIT 25')
    const [pythonCode, setPythonCode] = useState<string>('# Python lab will run in-browser via Pyodide')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [results, setResults] = useState<ResultSet | null>(null)
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(250)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewRows, setPreviewRows] = useState<any[]>([])
    const [previewCols, setPreviewCols] = useState<string[]>([])
    // History UI state (local, per-project, per-language)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [historyTick, setHistoryTick] = useState(0)

    // User editor preferences
    type EditorPrefs = { language?: 'sql' | 'python'; autocomplete?: boolean; historySize?: number; lineNumbers?: boolean; syntaxHighlight?: boolean }
    type Prefs = { theme?: 'light' | 'dark'; fontScale?: number; editor?: EditorPrefs }
    const [prefs, setPrefs] = useState<Prefs>({ editor: { language: 'sql', autocomplete: true, historySize: 100, lineNumbers: true, syntaxHighlight: true }, fontScale: 100 })

    // small helper
    async function fetchJSON(url: string, opts: RequestInit = {}) {
        const r = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts })
        if (!r.ok) { throw new Error(await r.text() || r.statusText) }
        return r.json()
    }

    // Load preferences and apply defaults (tab, font size, etc.)
    useEffect(() => {
        let mounted = true
            ; (async () => {
                try {
                    const pr: Prefs = await fetchJSON('/api/me/preferences').catch(() => ({}))
                    if (!mounted) return
                    const baseEditor: EditorPrefs = { language: 'sql', autocomplete: true, historySize: 100, lineNumbers: true, syntaxHighlight: true }
                    const mergedEditor: EditorPrefs = { ...baseEditor, ...(pr?.editor || {}) }
                    const merged: Prefs = { fontScale: 100, ...pr, editor: mergedEditor }
                    setPrefs(merged)
                    if (merged.editor?.language && (merged.editor.language === 'sql' || merged.editor.language === 'python')) {
                        setTab(merged.editor.language)
                    }
                } catch { /* ignore */ }
            })()
        return () => { mounted = false }
    }, [])

    useEffect(() => {
        // Reset errors when tab changes
        setError(null)
    }, [tab])

    async function runSQL() {
        setError(null)
        // basic client-side guard
        const selectRe = /^\s*(with\b[\s\S]+select\b|select\b)/i
        if (!selectRe.test(sql)) {
            setError('Modifications are not allowed. Use append flow.')
            return
        }
        setLoading(true)
        try {
            const resp = await fetch('/api/query/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql, page, limit, project_id: id ? Number(id) : undefined })
            })
            if (!resp.ok) {
                const txt = await resp.text()
                throw new Error(txt || resp.statusText)
            }
            const data = await resp.json()
            setResults(data)
            // Always open pop-up table with expanded columns
            const grid = buildGridFromResults(data)
            setPreviewCols(grid.columns)
            setPreviewRows(grid.rows)
            setPreviewOpen(true)
            // Push to history (capped by preference)
            try { pushHistory('sql', sql) } catch { }
            // bump history to refresh any open dropdown
            setHistoryTick(t => t + 1)
        } catch (e: any) {
            setError(e?.message || 'Query failed')
            setResults(null)
        } finally { setLoading(false) }
    }

    function exportJSON() {
        if (!results) return
        const blob = new Blob([JSON.stringify(results)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `query-results-${id || 'project'}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    function exportCSV() {
        if (!results) return
        const cols = results.columns
        const lines = [cols.join(',')]
        for (const r of results.rows) {
            lines.push(r.map((c: any) => `"${String(c ?? '')}"`).join(','))
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `query-results-${id || 'project'}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    // MonacoEditor is lazy-imported at module scope to avoid remounts
    const [editorReady, setEditorReady] = useState(false)

    // Compute Monaco options from prefs
    const theme = document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs'
    const fontSize = Math.max(10, Math.min(20, Math.round(((prefs.fontScale || 100) / 100) * 14)))
    function editorOptionsFor(lang: 'sql' | 'python') {
        const ep = prefs.editor || {}
        const autocomplete = ep.autocomplete !== false
        const lineNumbers = ep.lineNumbers !== false
        return {
            automaticLayout: true,
            fontSize,
            lineNumbers: lineNumbers ? 'on' : 'off',
            quickSuggestions: autocomplete,
            wordBasedSuggestions: autocomplete,
            suggestOnTriggerCharacters: autocomplete,
            minimap: { enabled: false },
        } as any
    }

    // Choose language respecting syntax highlight toggle
    function langFor(base: 'sql' | 'python') {
        const ep = prefs.editor || {}
        if (ep.syntaxHighlight === false) return 'plaintext'
        return base
    }

    // Minimal local history support capped by prefs.editor.historySize
    function pushHistory(language: 'sql' | 'python', text: string) {
        const n = Math.max(0, Math.min(1000, prefs.editor?.historySize ?? 100))
        if (n === 0) return
        const key = `oreo.history.${id || 'project'}.${language}`
        let arr: string[] = []
        try { arr = JSON.parse(localStorage.getItem(key) || '[]') } catch { arr = [] }
        const trimmed = (text || '').trim()
        if (!trimmed) return
        // de-dupe existing occurrence
        arr = [trimmed, ...arr.filter(v => v !== trimmed)]
        if (arr.length > n) arr.length = n
        localStorage.setItem(key, JSON.stringify(arr))
    }

    function getHistory(language: 'sql' | 'python') {
        const key = `oreo.history.${id || 'project'}.${language}`
        try { return JSON.parse(localStorage.getItem(key) || '[]') as string[] } catch { return [] }
    }

    function clearHistory(language: 'sql' | 'python') {
        const key = `oreo.history.${id || 'project'}.${language}`
        localStorage.removeItem(key)
        setHistoryTick(t => t + 1)
    }

    function buildGridFromResults(r: ResultSet) {
        const cols = Array.isArray(r?.columns) ? r.columns : []
        const idx: Record<string, number> = {}
        cols.forEach((c, i) => idx[c] = i)
        const outRows: any[] = []
        const keySet = new Set<string>()
        let expanded = false
        for (const arr of (r?.rows || [])) {
            const row: any = {}
            cols.forEach((c, i) => { row[c] = arr?.[i] })
            // Expand JSON in 'data' column when possible
            if (typeof row.data === 'string') {
                try { const obj = JSON.parse(row.data); if (obj && typeof obj === 'object') { Object.assign(row, obj); expanded = true } } catch { }
            }
            // Track keys
            Object.keys(row).forEach(k => keySet.add(k))
            outRows.push(row)
        }
        // Build columns list: id first (if present), then expanded keys (excluding 'data' when expanded), then any remaining
        const allKeys = Array.from(keySet)
        const ordered: string[] = []
        if (allKeys.includes('id')) ordered.push('id')
        const core = allKeys.filter(k => k !== 'id' && (!expanded || k !== 'data'))
        core.sort((a, b) => a.localeCompare(b))
        ordered.push(...core)
        if (!expanded && allKeys.includes('data')) ordered.push('data')
        return { rows: outRows, columns: ordered }
    }

    function openTablePreview() {
        if (!results) { setError('No results'); return }
        const grid = buildGridFromResults(results)
        setPreviewCols(grid.columns)
        setPreviewRows(grid.rows)
        setPreviewOpen(true)
    }

    return (
        <div className="p-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Query Editor</h2>
                <div className="flex items-center gap-2">
                    <button onClick={runSQL} className={`bg-indigo-600 text-white px-3 py-2 rounded ${(!editorReady || loading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`} aria-disabled={!editorReady || loading} disabled={!editorReady || loading}>Run</button>
                    <button onClick={() => alert('Save query - not yet implemented')} className="border px-3 py-2 rounded">Save</button>
                    {/* History dropdown (SQL) */}
                    <div className="relative" onBlur={() => setHistoryOpen(false)}>
                        {(() => {
                            const items = getHistory('sql')
                            const hasItems = items.length > 0
                            return (
                                <>
                                    <button
                                        onClick={() => hasItems && setHistoryOpen(o => !o)}
                                        className={`border px-3 py-2 rounded ${hasItems ? '' : 'opacity-50 cursor-not-allowed'}`}
                                        aria-haspopup="menu"
                                        aria-expanded={historyOpen}
                                        disabled={!hasItems}
                                    >History</button>
                                    {historyOpen && (
                                        <div className="absolute right-0 z-10 mt-1 w-[420px] max-h-80 overflow-auto rounded border bg-white shadow">
                                            <div className="flex items-center justify-between px-2 py-1 text-xs text-gray-500 border-b">
                                                <span>Recent SQL ({items.length})</span>
                                                <button onClick={() => { clearHistory('sql'); setHistoryOpen(false) }} className="text-red-600 hover:underline">Clear</button>
                                            </div>
                                            <ul role="menu" aria-label="SQL history" className="divide-y">
                                                {items.slice(0, 20).map((q, i) => {
                                                    // render one-line preview
                                                    const firstLine = (q || '').split('\n')[0].trim()
                                                    const preview = firstLine.length > 100 ? firstLine.slice(0, 100) + "…" : firstLine
                                                    return (
                                                        <li key={i}>
                                                            <button
                                                                role="menuitem"
                                                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                                                                title={q}
                                                                onClick={() => { setSql(q); setHistoryOpen(false) }}
                                                            >{preview || '(empty)'}</button>
                                                        </li>
                                                    )
                                                })}
                                                {items.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No history</li>}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            )
                        })()}
                    </div>
                    <div className="relative">
                        <button className="border px-3 py-2 rounded">Export</button>
                        <div className="absolute right-0 mt-1 bg-white shadow-md rounded p-1 hidden">{/* future dropdown */}</div>
                    </div>
                </div>
            </div>

            <div className="mt-4">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setTab('sql')} className={`py-3 px-1 border-b-2 ${tab === 'sql' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>SQL</button>
                        <button onClick={() => setTab('python')} className={`py-3 px-1 border-b-2 ${tab === 'python' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Python Lab</button>
                        <button onClick={() => setTab('saved')} className={`py-3 px-1 border-b-2 ${tab === 'saved' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Saved Queries</button>
                    </nav>
                </div>

                <div className="mt-4">
                    {tab === 'sql' && (
                        <div>
                            <label className="text-sm text-gray-600">SQL</label>
                            <div className="w-full mt-2 border rounded">
                                <Suspense fallback={<div className="p-4"><Spinner /></div>}>
                                    {/* @ts-ignore dynamic import */}
                                    <MonacoEditor
                                        height={250}
                                        theme={theme}
                                        defaultLanguage={langFor('sql')}
                                        value={sql}
                                        onChange={(v) => setSql(v ?? '')}
                                        options={editorOptionsFor('sql')}
                                        onMount={() => setEditorReady(true)}
                                    />
                                </Suspense>
                            </div>
                        </div>
                    )}

                    {tab === 'python' && (
                        <div>
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 text-sm text-yellow-800">Warning: Python runs client-side in the browser via Pyodide; large datasets (&gt;10MB) may be slow or memory intensive.</div>
                            <label className="text-sm text-gray-600 mt-3 block">Python</label>
                            <div className="w-full mt-2 border rounded">
                                <Suspense fallback={<div className="p-4"><Spinner /></div>}>
                                    {/* @ts-ignore dynamic import */}
                                    <MonacoEditor
                                        height={350}
                                        theme={theme}
                                        defaultLanguage={langFor('python')}
                                        value={pythonCode}
                                        onChange={(v) => setPythonCode(v ?? '')}
                                        options={editorOptionsFor('python')}
                                        onMount={() => setEditorReady(true)}
                                    />
                                </Suspense>
                            </div>
                            <div className="mt-2 text-sm text-gray-500">Run Python is client-side only and not proxied to the server in this implementation.</div>
                        </div>
                    )}

                    {tab === 'saved' && (
                        <div>
                            <div className="text-sm text-gray-600">Saved queries per project will appear here (coming soon).</div>
                        </div>
                    )}
                </div>

                <div className="mt-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Results</h3>
                        <div className="flex gap-2">
                            {results && <button onClick={openTablePreview} className="border px-2 py-1 rounded text-sm">Open table</button>}
                            <button onClick={exportCSV} className="border px-2 py-1 rounded text-sm">CSV</button>
                            <button onClick={exportJSON} className="border px-2 py-1 rounded text-sm">JSON</button>
                        </div>
                    </div>
                    <div className="mt-3">
                        {loading && <div className="text-sm text-gray-500">Running...</div>}
                        {error && <div className="text-sm text-red-600">{error}</div>}
                        {!results && !loading && <div className="text-sm text-gray-500">Run a query to view results in the pop‑up.</div>}
                        {/* Inline results list hidden by design; using pop-up table instead */}
                    </div>
                </div>
            </div>
            {/* Pop-up table viewer */}
            <AgGridDialog
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                title={`Query results (${previewRows.length.toLocaleString()} rows)`}
                rows={previewRows}
                columns={previewCols}
                pageSize={100}
                allowEdit={false}
                compact={false}
            />
        </div>
    )
}

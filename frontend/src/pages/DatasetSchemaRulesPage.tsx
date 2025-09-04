import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getDatasetSchemaTop, setDatasetRulesTop, setDatasetSchemaTop, getProject, myProjectRole } from '../api'
import Alert from '../components/Alert'

export default function DatasetSchemaRulesPage(){
  const { id, datasetId } = useParams()
  const projectId = Number(id)
  const dsId = Number(datasetId)
  const nav = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [schemaText, setSchemaText] = useState('')
  const [rulesText, setRulesText] = useState('[\n  { "type": "required", "columns": [] }\n]')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [role, setRole] = useState<'owner'|'contributor'|'viewer'|null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(()=>{ (async()=>{
  try{
      setProject(await getProject(projectId))
      const s = await getDatasetSchemaTop(dsId)
      if(s?.schema){
        setSchemaText(typeof s.schema === 'string' ? s.schema : JSON.stringify(s.schema, null, 2))
      } else {
        // poll for schema inference (defensive fallback); timeout after ~20s
        let attempts = 0
        const maxAttempts = 20
        setToast('Inferring schema...')
        while(attempts < maxAttempts){
          await new Promise(r=>setTimeout(r, 1000))
          attempts++
          try{
            const s2 = await getDatasetSchemaTop(dsId)
            if(s2?.schema){ setSchemaText(typeof s2.schema === 'string' ? s2.schema : JSON.stringify(s2.schema, null, 2)); setToast(''); break }
          }catch(e:any){ /* ignore interim errors */ }
        }
        if(!schemaText){ setToast(''); }
      }
      try{ const r = await myProjectRole(projectId); setRole(r.role) }catch{ setRole(null) }
    }catch(e:any){ setError(e.message) }
  })() }, [projectId, dsId])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Schema & Rules</h2>
        <div className="flex items-center gap-2 text-sm">
          <Link to={`/projects/${projectId}`} className="text-primary hover:underline">Back</Link>
          <Link to={`/projects/${projectId}/datasets/${dsId}`} className="text-primary hover:underline">Next: Dataset</Link>
          <button
            disabled={role==='viewer' || creating}
            className="ml-2 rounded-md bg-primary text-white px-3 py-1.5 hover:bg-indigo-600 disabled:opacity-60"
            onClick={async()=>{
              if(role==='viewer') return
              setError('')
              setToast('')
              setCreating(true)
              try{
                // Persist current edits or defaults before moving on
                let parsedSchema: any
                try{ parsedSchema = JSON.parse(schemaText || '{}') }catch(e:any){ throw new Error('Invalid schema JSON') }
                let parsedRules: any
                try{ parsedRules = JSON.parse(rulesText || '[]') }catch(e:any){ throw new Error('Invalid rules JSON') }
                await setDatasetSchemaTop(dsId, parsedSchema)
                await setDatasetRulesTop(dsId, parsedRules)
                setToast('Dataset created.')
                nav(`/projects/${projectId}/datasets/${dsId}`)
              }catch(e:any){ setError(e.message || 'Failed to create dataset') }
              finally{ setCreating(false) }
            }}
          >{creating ? 'Creating…' : 'Create dataset'}</button>
        </div>
      </div>
  {error && <Alert type="error" message={error} onClose={()=>setError('')} />}
  {toast && <Alert type="success" message={toast} onClose={()=>setToast('')} />}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border border-gray-200 bg-white rounded-md p-3">
          <div className="text-sm font-medium mb-2">JSON Schema</div>
          <textarea className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-xs" rows={18} value={schemaText} onChange={e=>setSchemaText(e.target.value)} disabled={role==='viewer'} />
          <div className="mt-2 flex gap-2">
            <button disabled={role==='viewer'} className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600 disabled:opacity-60" onClick={async()=>{
              setError('')
              try{ const parsed = JSON.parse(schemaText); await setDatasetSchemaTop(dsId, parsed); setToast('Schema saved.') }catch(e:any){ setError(e.message || 'Invalid schema JSON') }
            }}>Save schema</button>
          </div>
        </div>
        <div className="border border-gray-200 bg-white rounded-md p-3">
          <div className="text-sm font-medium mb-2">Business Rules</div>
          <textarea className="w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-xs" rows={18} value={rulesText} onChange={e=>setRulesText(e.target.value)} disabled={role==='viewer'} />
          <div className="mt-2 flex gap-2">
            <button disabled={role==='viewer'} className="rounded-md bg-primary text-white px-3 py-1.5 text-sm hover:bg-indigo-600 disabled:opacity-60" onClick={async()=>{
              setError('')
              try{ const parsed = JSON.parse(rulesText || '[]'); await setDatasetRulesTop(dsId, parsed); setToast('Rules saved.') }catch(e:any){ setError(e.message || 'Invalid rules JSON') }
            }}>Save rules</button>
          </div>
        </div>
      </div>
    </div>
  )
}

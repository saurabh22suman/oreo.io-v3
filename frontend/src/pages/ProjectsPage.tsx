import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createProject, listProjects } from '../api'

type Project = { id:number; name:string }

export default function ProjectsPage(){
  const [items, setItems] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  useEffect(()=>{ (async()=>{ try{ setItems(await listProjects()) }catch(e:any){ setError(e.message) } })() }, [])
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Projects</h2>
      <div className="flex gap-2 mb-3">
        <input className="border border-gray-300 rounded-md px-3 py-2 flex-1" placeholder="New project name" value={name} onChange={e=>setName(e.target.value)} />
        <button className="rounded-md bg-primary text-white px-3 py-2 text-sm hover:bg-indigo-600" onClick={async()=>{ try{ const p = await createProject(name); setItems([p, ...items]); setName('') }catch(e:any){ setError(e.message) } }}>Create</button>
      </div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <ul className="space-y-2">
        {items.map(p => (
          <li key={p.id} className="border border-gray-200 bg-white rounded-md px-3 py-2 hover:bg-gray-50">
            <Link className="text-sm font-medium text-gray-800 hover:text-primary" to={`/projects/${p.id}`}>{p.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

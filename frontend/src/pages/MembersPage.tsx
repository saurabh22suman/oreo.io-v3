import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProject, listMembers, removeMember, upsertMember, myProjectRole, currentUser } from '../api'
import ProjectLayout from '../components/ProjectLayout'
import Card from '../components/Card'
import { Users, UserPlus, Shield, Trash2, Mail } from 'lucide-react'

type Member = { id: number; email: string; role: 'owner' | 'contributor' | 'viewer' }

export default function MembersPage() {
  const { id } = useParams()
  const projectId = Number(id)
  const [project, setProject] = useState<any>(null)
  const [items, setItems] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Member['role']>('viewer')
  const [isOwner, setIsOwner] = useState(false)
  const [myRole, setMyRole] = useState<'owner' | 'contributor' | 'viewer' | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [meId, setMeId] = useState<number | undefined>(undefined)
  const [meEmail, setMeEmail] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [p, ms, me, meInfo] = await Promise.all([
          getProject(projectId),
          listMembers(projectId),
          myProjectRole(projectId).catch(() => ({ role: null as any })),
          currentUser().catch(() => null as any)
        ])
        if (mounted) {
          setProject(p)
          setItems(ms)
          setIsOwner(me?.role === 'owner')
          if (me?.role) setMyRole(me.role)
          if (meInfo?.id) setMeId(Number(meInfo.id))
          if (meInfo?.email) setMeEmail(String(meInfo.email))
        }
      } catch (e: any) {
        if (mounted) setError(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [projectId])

  return (
    <ProjectLayout project={project} role={myRole} loading={loading}>
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* Add Member Card */}
          {isOwner && (
            <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/50">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Add New Member
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Invite colleagues to collaborate on this project.
                </p>
              </div>
              <div className="p-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="colleague@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="relative min-w-[140px]">
                    <Shield className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <select
                      className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                      value={role}
                      onChange={e => setRole(e.target.value as Member['role'])}
                    >
                      <option value="owner">Owner</option>
                      <option value="contributor">Contributor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button
                    disabled={!email || saving}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
                    onClick={async () => {
                      setError(''); setSaving(true)
                      try {
                        const m = await upsertMember(projectId, email, role);
                        const exists = items.find(x => x.id === m.id);
                        if (exists) { setItems(items.map(x => x.id === m.id ? m : x)) } else { setItems([m, ...items]) }
                        setEmail('')
                      }
                      catch (e: any) { setError(e.message) }
                      finally { setSaving(false) }
                    }}
                  >
                    {saving ? 'Adding...' : 'Invite'}
                  </button>
                </div>
                {error && <div className="text-sm text-red-500 mt-3 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800">{error}</div>}
              </div>
            </Card>
          )}

          {/* Members List */}
          <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-white dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Project Members
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  {items.length}
                </span>
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {items.map(m => (
                <div key={m.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-sm">
                      {m.email.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{m.email}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.role === 'owner' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                            m.role === 'contributor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                              'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                          {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                        </span>
                        {m.id === meId && <span className="text-xs text-slate-400">(You)</span>}
                      </div>
                    </div>
                  </div>

                  {isOwner && typeof meId === 'number' && meId !== m.id && m.email !== meEmail && !(m.role === 'owner' && (m.email === (project?.owner_email || project?.owner))) && (
                    <button
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      title="Remove member"
                      onClick={async () => {
                        if (!confirm('Are you sure you want to remove this member?')) return;
                        try { await removeMember(projectId, m.id); setItems(items.filter(x => x.id !== m.id)) } catch (e: any) { setError(e.message) }
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
            <div className="p-6">
              <h3 className="font-bold text-lg mb-2">Role Permissions</h3>
              <div className="space-y-4 text-sm text-slate-300">
                <div>
                  <strong className="text-white block mb-1">Owner</strong>
                  Full access to manage project, datasets, members, and settings.
                </div>
                <div>
                  <strong className="text-white block mb-1">Contributor</strong>
                  Can create and edit datasets, run queries, and view members.
                </div>
                <div>
                  <strong className="text-white block mb-1">Viewer</strong>
                  Read-only access to datasets and queries. Cannot make changes.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </ProjectLayout>
  )
}

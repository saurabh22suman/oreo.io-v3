import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProject, listMembers, removeMember, upsertMember, myProjectRole, currentUser } from '../api'
import ProjectLayout from '../components/ProjectLayout'
import { Users, UserPlus, Shield, Trash2, Mail, Loader2, Check, Crown, Eye, Edit3 } from 'lucide-react'

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
      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3 animate-fade-in">
        <div className="lg:col-span-2 space-y-8">

          {/* Add Member Card */}
          {isOwner && (
            <div className="bg-surface-1 rounded-2xl border border-divider overflow-hidden shadow-lg shadow-black/5">
              <div className="p-6 border-b border-divider bg-surface-2/30 backdrop-blur-sm">
                <h3 className="font-bold text-text flex items-center gap-2 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  Add New Member
                </h3>
                <p className="text-sm text-text-secondary mt-1 ml-11">
                  Invite colleagues to collaborate on this project.
                </p>
              </div>
              <div className="p-6 bg-surface-1/50">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary transition-colors" />
                    <input
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-divider bg-surface-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm shadow-sm"
                      placeholder="colleague@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="relative min-w-[160px] group">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-primary transition-colors" />
                    <select
                      className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-divider bg-surface-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none text-sm shadow-sm cursor-pointer"
                      value={role}
                      onChange={e => setRole(e.target.value as Member['role'])}
                    >
                      <option value="owner">Owner</option>
                      <option value="contributor">Contributor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                  <button
                    disabled={!email || saving}
                    className="btn btn-primary flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all px-6"
                    onClick={async () => {
                      setError(''); setSaving(true)
                      try {
                        const m = await upsertMember(projectId, email, role);
                        const exists = items.find(x => x.id === m.id);
                        if (exists) { setItems(items.map(x => x.id === m.id ? m : x)) } else { setItems([m, ...items]) }
                        setEmail('')
                      } catch (e: any) { setError(e.message) }
                      finally { setSaving(false) }
                    }}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Invite
                  </button>
                </div>
                {error && (
                  <div className="mt-4 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse"></div>
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="bg-surface-1 rounded-2xl border border-divider overflow-hidden shadow-lg shadow-black/5">
            <div className="p-6 border-b border-divider flex items-center justify-between bg-surface-2/30 backdrop-blur-sm">
              <h3 className="font-bold text-text flex items-center gap-2 text-lg">
                <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                  <Users className="w-5 h-5" />
                </div>
                Team Members
              </h3>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-surface-2 text-text-secondary border border-divider shadow-sm">
                {items.length} members
              </span>
            </div>
            
            <div className="divide-y divide-divider">
              {items.map(member => (
                <div key={member.id} className="p-4 flex items-center justify-between hover:bg-surface-2/50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm text-white
                      ${member.role === 'owner' ? 'bg-gradient-to-br from-primary to-primary/80' : 
                        member.role === 'contributor' ? 'bg-gradient-to-br from-secondary to-secondary/80' : 
                        'bg-gradient-to-br from-slate-500 to-slate-600'}`}
                    >
                      {member.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-text flex items-center gap-2">
                        {member.email}
                        {member.email === meEmail && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-secondary flex items-center gap-1.5 mt-1">
                        {member.role === 'owner' && <Crown className="w-3 h-3 text-primary" />}
                        {member.role === 'contributor' && <Edit3 className="w-3 h-3 text-secondary" />}
                        {member.role === 'viewer' && <Eye className="w-3 h-3 text-text-muted" />}
                        <span className="capitalize font-medium">{member.role}</span>
                      </div>
                    </div>
                  </div>

                  {isOwner && (member.email !== meEmail) && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                      <div className="relative">
                        <select
                          className="text-xs bg-surface-1 border border-divider rounded-lg pl-2 pr-6 py-1.5 focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer hover:border-primary/50"
                          value={member.role}
                          onChange={async (e) => {
                            try {
                              const newRole = e.target.value as any
                              await upsertMember(projectId, member.email, newRole)
                              setItems(items.map(x => x.id === member.id ? { ...x, role: newRole } : x))
                            } catch (e: any) { alert(e.message) }
                          }}
                        >
                          <option value="owner">Owner</option>
                          <option value="contributor">Contributor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                      </div>
                      <button
                        className="p-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                        title="Remove member"
                        onClick={async () => {
                          if (!confirm('Remove this member?')) return
                          try {
                            await removeMember(projectId, member.id)
                            setItems(items.filter(x => x.id !== member.id))
                          } catch (e: any) { alert(e.message) }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-surface-1 rounded-2xl border border-divider p-6 shadow-lg shadow-black/5 sticky top-6">
            <h3 className="font-bold text-text mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Role Permissions
            </h3>
            <div className="space-y-6">
              <div className="flex gap-4 group">
                <div className="mt-1 w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text">Owner</h4>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">Full access to manage project settings, members, and datasets. Can delete the project.</p>
                </div>
              </div>
              <div className="flex gap-4 group">
                <div className="mt-1 w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text">Contributor</h4>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">Can upload datasets, create changes, and approve requests. Cannot manage members.</p>
                </div>
              </div>
              <div className="flex gap-4 group">
                <div className="mt-1 w-8 h-8 rounded-lg bg-surface-3 text-text-secondary flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text">Viewer</h4>
                  <p className="text-xs text-text-secondary mt-1 leading-relaxed">Read-only access to datasets and dashboards. Cannot make any changes.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProjectLayout>
  )
}

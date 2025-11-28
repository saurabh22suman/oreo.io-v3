import { useEffect } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import {
  Table, ShieldCheck, History, FileJson,
  ArrowRight, CheckCircle2, Layout, Database, GitBranch, Lock
} from 'lucide-react'

export default function LandingPage() {
	useEffect(() => {
		const io = new IntersectionObserver((entries) => {
			entries.forEach(e => {
				if (e.isIntersecting) {
					e.target.classList.add('show')
					io.unobserve(e.target as Element)
				}
			})
		}, { threshold: 0.15 })
		document.querySelectorAll('.reveal').forEach(el => io.observe(el))
		return () => io.disconnect()
	}, [])

  return (
    <div className="min-h-screen flex flex-col bg-page text-text font-sans selection:bg-primary/30">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-surface-1 to-surface-1"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/10 rounded-full blur-[120px] opacity-50"></div>
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-divider to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="reveal inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-1/50 border border-primary/20 backdrop-blur-md mb-8 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
            <span className="text-sm font-medium text-primary">Simple for Users. Powerful for Data</span>
          </div>

          <h1 className="reveal text-5xl md:text-7xl font-bold font-display tracking-tight mb-6 text-text drop-shadow-sm">
            Your Data, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary-hover to-primary">Validated & Editable.</span>
          </h1>

          <p className="reveal mt-6 text-lg md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Forget the SQL overhead.
            <b className="text-text font-semibold"> Oreo</b> provides an intuitive spreadsheet interface for business users, with built-in validation, governance, and full change tracking.
          </p>

          <div className="reveal mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a href="/register" className="btn btn-primary text-lg px-8 py-4 shadow-xl shadow-primary/20 group hover:shadow-primary/30 transition-all hover:-translate-y-0.5">
              <span className="flex items-center gap-2 font-bold">
                Let's Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </a>
            <a href="#features" className="px-8 py-4 rounded-xl bg-surface-1 hover:bg-surface-2 text-text font-bold border border-divider transition-colors">
              Learn More
            </a>
          </div>

          {/* Hero Visual - The "Live Editor" Mockup */}
          <div className="reveal mt-24 relative max-w-6xl mx-auto perspective-1000">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary to-primary-hover rounded-[2.5rem] blur-2xl opacity-20 -z-10"></div>
            <div className="relative rounded-2xl bg-surface-1/80 backdrop-blur-xl border border-divider/50 shadow-2xl overflow-hidden ring-1 ring-white/10 transform rotate-x-2 transition-transform duration-500 hover:rotate-x-0">
              {/* Mockup Header */}
              <div className="h-14 bg-surface-2/50 border-b border-divider flex items-center px-6 gap-4 justify-between">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-danger/80 shadow-sm"></div>
                  <div className="w-3 h-3 rounded-full bg-warning/80 shadow-sm"></div>
                  <div className="w-3 h-3 rounded-full bg-success/80 shadow-sm"></div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-1 border border-divider shadow-sm">
                  <Lock className="w-3 h-3 text-success" />
                  <span className="text-xs font-mono text-text-secondary">oreo.io/editor/user_transactions</span>
                </div>
                <div className="w-16"></div>
              </div>

              {/* Mockup Body */}
              <div className="p-1 bg-surface-2/30">
                <div className="grid md:grid-cols-12 gap-1 h-[400px]">
                  {/* Sidebar */}
                  <div className="hidden md:block md:col-span-2 bg-surface-1 rounded-lg border border-divider/50 p-4 space-y-4">
                    <div className="h-8 w-24 bg-surface-2 rounded-md animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="h-6 w-full bg-surface-2/50 rounded animate-pulse delay-75"></div>
                      <div className="h-6 w-3/4 bg-surface-2/50 rounded animate-pulse delay-100"></div>
                      <div className="h-6 w-5/6 bg-surface-2/50 rounded animate-pulse delay-150"></div>
                    </div>
                  </div>

                  {/* Main Content */}
                  <div className="md:col-span-7 bg-surface-1 rounded-lg border border-divider/50 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-divider/50 flex justify-between items-center bg-surface-1">
                      <div className="flex items-center gap-2">
                        <Table className="w-4 h-4 text-primary" />
                        <span className="font-bold text-sm">Data Grid</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 uppercase tracking-wider">Live Mode</span>
                    </div>
                    
                    {/* Fake Table */}
                    <div className="flex-1 overflow-hidden relative">
                      <div className="grid grid-cols-3 bg-surface-2/50 text-xs font-bold text-text-secondary p-3 border-b border-divider">
                        <div>user_id</div>
                        <div>status</div>
                        <div>amount</div>
                      </div>
                      <div className="divide-y divide-divider text-sm text-text">
                        <div className="grid grid-cols-3 p-3 hover:bg-primary/5 transition-colors cursor-pointer group border-l-2 border-transparent hover:border-primary">
                          <div className="font-mono text-text-secondary">u_8392</div>
                          <div className="inline-flex"><span className="px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">active</span></div>
                          <div className="font-mono">$1,240.00</div>
                        </div>
                        <div className="grid grid-cols-3 p-3 bg-primary/5 transition-colors cursor-pointer group border-l-2 border-primary relative">
                          <div className="font-mono text-text-secondary">u_8393</div>
                          <div className="inline-flex"><span className="px-2 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning">pending</span></div>
                          <div className="font-mono">$450.00</div>
                          
                          {/* Cursor */}
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
                             <div className="w-3 h-3 bg-primary rotate-45 transform translate-y-1.5"></div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 p-3 hover:bg-primary/5 transition-colors cursor-pointer group border-l-2 border-transparent hover:border-primary">
                          <div className="font-mono text-text-secondary">u_8394</div>
                          <div className="inline-flex"><span className="px-2 py-0.5 rounded text-xs font-medium bg-danger/10 text-danger">failed</span></div>
                          <div className="font-mono text-text-muted">$0.00</div>
                        </div>
                        <div className="grid grid-cols-3 p-3 hover:bg-primary/5 transition-colors cursor-pointer group border-l-2 border-transparent hover:border-primary opacity-50">
                          <div className="font-mono text-text-secondary">u_8395</div>
                          <div className="inline-flex"><span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-3 text-text-secondary">draft</span></div>
                          <div className="font-mono">--</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Panel */}
                  <div className="md:col-span-3 bg-surface-1 rounded-lg border border-divider/50 p-4 space-y-4 flex flex-col">
                    <div className="flex items-center gap-2 pb-2 border-b border-divider/50">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span className="font-bold text-sm">Validation</span>
                    </div>
                    
                    <div className="space-y-3 flex-1">
                      <div className="p-3 rounded-lg bg-surface-2/50 border border-divider hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-2 text-xs font-bold text-text mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Status Check
                        </div>
                        <p className="text-[10px] text-text-secondary leading-relaxed">Must be one of: active, pending, failed</p>
                      </div>
                      <div className="p-3 rounded-lg bg-surface-2/50 border border-divider hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-2 text-xs font-bold text-text mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Amount Limit
                        </div>
                        <p className="text-[10px] text-text-secondary leading-relaxed">Value must be positive number</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-divider/50">
                      <div className="w-full h-8 bg-primary text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-lg shadow-primary/20">
                        Commit Changes
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 bg-surface-2 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-divider to-transparent"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold font-display text-text mb-6">Why Oreo?</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto leading-relaxed">
              Built for data teams who need control, and business users who need simplicity. The bridge between spreadsheets and data warehouses.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Layout className="w-6 h-6" />,
                title: "Spreadsheet Interface",
                desc: "Familiar grid view for editing data. Copy, paste, filter, and sort just like Excel, but directly on your data warehouse."
              },
              {
                icon: <ShieldCheck className="w-6 h-6" />,
                title: "Quality Gates",
                desc: "Define schema rules and business logic. Invalid data is flagged immediately, preventing bad data from ever hitting production."
              },
              {
                icon: <History className="w-6 h-6" />,
                title: "Audit Trails",
                desc: "Every change is versioned. Rollback to any point in time with Delta Lake integration. See who changed what and when."
              },
              {
                icon: <Database className="w-6 h-6" />,
                title: "Delta Lake Native",
                desc: "Built on top of Delta Lake. Enjoy ACID transactions, scalable metadata handling, and unified batch and streaming."
              },
              {
                icon: <GitBranch className="w-6 h-6" />,
                title: "Branching & Merging",
                desc: "Work on data in isolation. Create branches for large updates and merge them back with approval workflows."
              },
              {
                icon: <Lock className="w-6 h-6" />,
                title: "Enterprise Security",
                desc: "Role-based access control (RBAC), SSO integration, and detailed audit logs for compliance and security."
              }
            ].map((feature, i) => (
              <div key={i} className="reveal p-8 rounded-3xl bg-surface-1 border border-divider hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all group">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-inner">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-text mb-3">{feature.title}</h3>
                <p className="text-text-secondary leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

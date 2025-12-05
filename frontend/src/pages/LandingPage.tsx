import { useEffect } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import {
  Table, ShieldCheck, History, 
  ArrowRight, TrendingUp, Users, Clock, CheckCircle2,
  Star, Quote, Building2, Zap, Target, Award, 
  DollarSign, AlertTriangle, ThumbsUp, Play
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
    <div className="min-h-screen flex flex-col bg-surface-1 text-text-primary font-sans">
      <Navbar />

      {/* Hero Section - Problem-Focused */}
      <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px] opacity-40" />
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(123, 75, 255, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(123, 75, 255, 0.5) 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }}
          />
        </div>

        <div className="relative z-10 max-w-content mx-auto px-4 sm:px-6 text-center">
          {/* Social Proof Badge */}
          <div className="reveal inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-2 border border-divider mb-6">
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-surface-2" />
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 border-2 border-surface-2" />
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-surface-2" />
            </div>
            <span className="text-sm text-text-secondary">Trusted by 500+ teams worldwide</span>
            <div className="flex items-center gap-0.5 text-yellow-500">
              <Star size={12} fill="currentColor" />
              <Star size={12} fill="currentColor" />
              <Star size={12} fill="currentColor" />
              <Star size={12} fill="currentColor" />
              <Star size={12} fill="currentColor" />
            </div>
          </div>

          <h1 className="reveal text-4xl md:text-6xl font-bold tracking-tight mb-6 text-text-primary leading-tight">
            Stop Losing Money to <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-glow">Bad Data Decisions</span>
          </h1>

          <p className="reveal text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-8 leading-relaxed">
            Your team spends hours fixing spreadsheet errors. Decisions get delayed. Mistakes slip through. 
            <span className="text-text-primary font-medium"> Oreo catches problems before they cost you.</span>
          </p>

          {/* Value Metrics */}
          <div className="reveal flex flex-wrap justify-center gap-8 mb-10">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">73%</div>
              <div className="text-sm text-text-secondary">Less time fixing errors</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-success">$2.4M</div>
              <div className="text-sm text-text-secondary">Avg. annual savings</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-warning">5x</div>
              <div className="text-sm text-text-secondary">Faster approvals</div>
            </div>
          </div>

          <div className="reveal flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a href="/register" className="btn btn-primary btn-primary-pulse px-8 py-4 text-base group">
              Start Free Trial <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </a>
            <button className="flex items-center gap-2 px-6 py-4 rounded-btn text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors">
              <Play size={18} className="text-primary" />
              Watch 2-min Demo
            </button>
          </div>

          <p className="reveal text-xs text-text-muted mt-4">No credit card required • Free for teams up to 5 • Setup in 2 minutes</p>

          {/* Hero Visual - Business-Focused Dashboard */}
          <div className="reveal mt-16 relative max-w-5xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary-glow rounded-2xl blur opacity-20"></div>
            <div className="relative rounded-2xl bg-surface-2 border border-divider shadow-2xl overflow-hidden">
              {/* Mockup Header */}
              <div className="h-12 bg-surface-3 border-b border-divider flex items-center px-6 gap-4">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                </div>
                <div className="flex-1 text-center text-xs text-text-secondary">Q4 Sales Report — Oreo Workspace</div>
              </div>

              {/* Mockup Body */}
              <div className="p-8 grid md:grid-cols-3 gap-8">
                {/* Left: Business Data Example */}
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-text flex items-center gap-2">
                      <Table className="w-5 h-5 text-primary" /> Sales Pipeline
                    </h3>
                    <span className="text-xs px-2 py-1 rounded bg-success/20 text-success border border-success/30">Auto-Saved</span>
                  </div>
                  {/* Business Data Table */}
                  <div className="border border-divider rounded-lg overflow-hidden bg-surface-1">
                    <div className="grid grid-cols-4 bg-surface-3 text-xs font-medium text-text-secondary p-3 border-b border-divider">
                      <div>Customer</div>
                      <div>Deal Size</div>
                      <div>Status</div>
                      <div>Close Date</div>
                    </div>
                    <div className="divide-y divide-divider text-sm text-text">
                      <div className="grid grid-cols-4 p-3 hover:bg-surface-2 transition-colors">
                        <div>Acme Corp</div>
                        <div className="font-medium">$125,000</div>
                        <div className="text-success">Won</div>
                        <div className="text-text-secondary">Dec 15</div>
                      </div>
                      <div className="grid grid-cols-4 p-3 bg-primary/10">
                        <div>TechStart Inc</div>
                        <div className="font-medium">$78,500</div>
                        <div className="text-warning flex items-center gap-1">
                          Pending
                          <span className="text-[10px] bg-primary px-1.5 py-0.5 rounded text-white">Editing</span>
                        </div>
                        <div className="text-text-secondary">Dec 20</div>
                      </div>
                      <div className="grid grid-cols-4 p-3 hover:bg-surface-2 transition-colors">
                        <div>Global Services</div>
                        <div className="font-medium">$245,000</div>
                        <div className="text-primary">Proposal</div>
                        <div className="text-text-secondary">Jan 5</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Validation Assistant */}
                <div className="relative flex flex-col items-center justify-center text-center space-y-4 border-l border-divider pl-8">
                  <div className="w-24 h-24 relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                    <img src="/images/oreo_rabbit.png" alt="Oreo" className="relative z-10 w-full h-full object-contain" />
                  </div>
                  <div>
                    <h4 className="text-text font-medium">Quality Check</h4>
                    <p className="text-xs text-text-secondary mt-1">All entries verified</p>
                  </div>
                  <div className="w-full bg-surface-3 rounded-lg p-3 text-left space-y-2">
                    <div className="flex items-center gap-2 text-xs text-success">
                      <CheckCircle2 className="w-3 h-3" /> No duplicate entries
                    </div>
                    <div className="flex items-center gap-2 text-xs text-success">
                      <CheckCircle2 className="w-3 h-3" /> All required fields complete
                    </div>
                    <div className="flex items-center gap-2 text-xs text-success">
                      <CheckCircle2 className="w-3 h-3" /> Ready for approval
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="py-16 bg-surface-2 border-y border-divider">
        <div className="max-w-content mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="reveal text-2xl md:text-3xl font-bold text-text-primary mb-4">Sound Familiar?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <AlertTriangle className="text-warning" size={24} />,
                pain: "Hours wasted tracking down who changed what",
                solution: "Every edit is logged with who, when, and why"
              },
              {
                icon: <DollarSign className="text-error" size={24} />,
                pain: "Costly mistakes from bad data slipping through",
                solution: "Automatic quality checks catch errors instantly"
              },
              {
                icon: <Clock className="text-primary" size={24} />,
                pain: "Weeks waiting for IT to make simple updates",
                solution: "Business teams edit data safely, no IT needed"
              }
            ].map((item, i) => (
              <div key={i} className="reveal bg-surface-1 border border-divider rounded-xl p-6 space-y-4">
                <div className="flex items-start gap-3">
                  {item.icon}
                  <p className="text-text-secondary line-through decoration-text-muted">{item.pain}</p>
                </div>
                <div className="flex items-start gap-3">
                  <ThumbsUp className="text-success flex-shrink-0" size={20} />
                  <p className="text-text-primary font-medium">{item.solution}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof - Logos */}
      <section className="py-12 bg-surface-1">
        <div className="max-w-content mx-auto px-4 sm:px-6">
          <p className="text-center text-sm text-text-muted mb-8">Trusted by leading companies</p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-60">
            {['Fortune 500', 'TechCorp', 'GlobalBank', 'RetailCo', 'HealthPlus'].map((company, i) => (
              <div key={i} className="flex items-center gap-2 text-text-secondary">
                <Building2 size={20} />
                <span className="font-medium">{company}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section - Business Value */}
      <section id="features" className="py-20 bg-surface-1">
        <div className="max-w-content mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="reveal text-3xl md:text-4xl font-bold text-text-primary mb-4">
              Why Teams Choose Oreo
            </h2>
            <p className="reveal text-text-secondary max-w-xl mx-auto">
              Give your business teams the power to work with data confidently—without the risk.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Table size={24} />,
                title: "Works Like Excel",
                desc: "Your team already knows how to use it. Copy, paste, sort, filter—no training required.",
                metric: "90% adoption in first week"
              },
              {
                icon: <ShieldCheck size={24} />,
                title: "Catch Mistakes Before They Happen",
                desc: "Set up business rules once. Oreo automatically flags problems as you type.",
                metric: "99.7% error prevention"
              },
              {
                icon: <History size={24} />,
                title: "Complete Change History",
                desc: "See who changed what and when. Undo any mistake with one click.",
                metric: "100% accountability"
              },
              {
                icon: <Users size={24} />,
                title: "Team Collaboration",
                desc: "Multiple people can work together. Changes are reviewed before going live.",
                metric: "3x faster teamwork"
              },
              {
                icon: <Target size={24} />,
                title: "Approval Workflows",
                desc: "Critical changes need sign-off? Set up approval chains that match your process.",
                metric: "Zero unauthorized changes"
              },
              {
                icon: <Zap size={24} />,
                title: "Instant Results",
                desc: "No more waiting for IT. Business teams make updates that take effect immediately.",
                metric: "From days to minutes"
              }
            ].map((feature, i) => (
              <div 
                key={i} 
                className="reveal bg-surface-2 border border-divider rounded-xl p-6 hover:border-primary/30 hover:shadow-lg transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-4">{feature.desc}</p>
                <div className="flex items-center gap-2 text-xs font-medium text-primary">
                  <TrendingUp size={14} />
                  {feature.metric}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-surface-2">
        <div className="max-w-content mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="reveal text-3xl md:text-4xl font-bold text-text-primary mb-4">
              What Our Customers Say
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "We used to spend 20 hours a week fixing spreadsheet errors. Now it's less than 2. Oreo paid for itself in the first month.",
                name: "Sarah Chen",
                role: "VP Operations",
                company: "TechStart Inc"
              },
              {
                quote: "Finally, our business team can update pricing without waiting weeks for IT. The approval workflow gives us peace of mind.",
                name: "Michael Torres",
                role: "Director of Finance",
                company: "Global Retail Co"
              },
              {
                quote: "The audit trail saved us during our compliance review. We could show exactly who approved every change.",
                name: "Jennifer Walsh",
                role: "Chief Compliance Officer",
                company: "HealthPlus"
              }
            ].map((testimonial, i) => (
              <div key={i} className="reveal bg-surface-1 border border-divider rounded-xl p-6">
                <Quote className="text-primary/30 mb-4" size={32} />
                <p className="text-text-primary mb-6 leading-relaxed">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                    <span className="text-primary font-semibold text-sm">{testimonial.name[0]}</span>
                  </div>
                  <div>
                    <div className="font-medium text-text-primary text-sm">{testimonial.name}</div>
                    <div className="text-xs text-text-secondary">{testimonial.role}, {testimonial.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works - Simplified */}
      <section id="how" className="py-20 bg-surface-1">
        <div className="max-w-content mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="reveal text-3xl md:text-4xl font-bold text-text-primary mb-4">
              Get Started in Minutes
            </h2>
            <p className="reveal text-text-secondary max-w-xl mx-auto">
              No complex setup. No IT involvement. Start seeing results today.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Import Your Data', desc: 'Upload your Excel files or connect to your existing systems', icon: <Table size={20} /> },
              { step: '2', title: 'Set Your Rules', desc: 'Define what good data looks like—we\'ll enforce it automatically', icon: <ShieldCheck size={20} /> },
              { step: '3', title: 'Invite Your Team', desc: 'Add team members and set who can view, edit, or approve', icon: <Users size={20} /> },
              { step: '4', title: 'Work with Confidence', desc: 'Make changes knowing they\'ll be reviewed and tracked', icon: <Award size={20} /> },
            ].map((item, i) => (
              <div key={i} className="reveal text-center relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                )}
                <div className="w-12 h-12 rounded-full bg-primary text-white font-bold text-lg flex items-center justify-center mx-auto mb-4 relative z-10">
                  {item.icon}
                </div>
                <h3 className="font-semibold text-text-primary mb-2">{item.title}</h3>
                <p className="text-sm text-text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-20 bg-surface-2">
        <div className="max-w-content mx-auto px-4 sm:px-6">
          <div className="reveal bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-text-secondary max-w-lg mx-auto mb-8">
              Start free with up to 5 team members. Scale as you grow with pricing that makes sense.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/register" className="btn btn-primary px-8 py-4 text-base group">
                Start Free Trial <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a href="/pricing" className="px-8 py-4 rounded-btn text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors border border-divider">
                View All Plans
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-surface-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="reveal text-3xl md:text-4xl font-bold text-text-primary mb-4">
              Common Questions
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "Do I need technical skills to use Oreo?",
                a: "Not at all! If you can use Excel, you can use Oreo. Our interface is designed for business users, not programmers."
              },
              {
                q: "How long does setup take?",
                a: "Most teams are up and running in under 10 minutes. Just upload your data and you're ready to go."
              },
              {
                q: "Can I control who sees and edits what?",
                a: "Absolutely. You can set permissions at the project, dataset, or even column level. Plus, all changes can require approval."
              },
              {
                q: "What happens if someone makes a mistake?",
                a: "Every change is tracked and can be undone with one click. You'll never lose data or wonder who changed what."
              },
              {
                q: "Is my data secure?",
                a: "Yes. We use bank-level encryption, and your data stays in your control. We're SOC 2 compliant and GDPR ready."
              }
            ].map((faq, i) => (
              <div key={i} className="reveal bg-surface-2 border border-divider rounded-xl p-6">
                <h3 className="font-semibold text-text-primary mb-2">{faq.q}</h3>
                <p className="text-sm text-text-secondary">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-primary/20 to-surface-2">
        <div className="max-w-content mx-auto px-4 sm:px-6 text-center">
          <h2 className="reveal text-3xl md:text-4xl font-bold text-text-primary mb-4">
            Ready to Stop Losing Money to Bad Data?
          </h2>
          <p className="reveal text-text-secondary mb-8 max-w-md mx-auto">
            Join hundreds of teams who work with data confidently every day.
          </p>
          <div className="reveal flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/register" className="btn btn-primary px-8 py-4 text-base inline-flex group">
              Start Your Free Trial <ArrowRight size={18} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <a href="mailto:sales@oreo.io" className="px-8 py-4 rounded-btn text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors border border-divider">
              Talk to Sales
            </a>
          </div>
          <p className="reveal text-xs text-text-muted mt-6">
            ✓ Free for small teams &nbsp; ✓ No credit card required &nbsp; ✓ Setup in under 10 minutes
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}

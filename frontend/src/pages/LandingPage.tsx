import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import FeatureCard from '../components/FeatureCard'
import { Database, Users, ShieldCheck, Rocket, Star } from 'lucide-react'
import Mascot from '../components/Mascot'

export default function LandingPage() {
  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-12">
        <section className="mb-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="text-center md:text-left">
            <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
              <Mascot size={40} pose="happy" />
              <h1 className="text-4xl md:text-5xl font-bold text-indigo-700">Welcome to oreo.io</h1>
            </div>
            <p className="text-lg text-gray-600 mb-6">Modern, secure, and collaborative data platform for teams.</p>
            <div className="flex flex-wrap gap-3 items-center">
              <a href="/register" className="inline-block btn-primary bold px-8 py-3 font-semibold">Create account</a>
              <a href="/docs" className="inline-block text-indigo-700 rounded-2xl px-4 py-2 font-medium hover:underline">Read docs</a>
            </div>
            <div className="mt-6 inline-flex items-center gap-3 text-sm text-gray-600">
              <Star size={18} className="text-yellow-400" />
              <span className="font-medium">Loved by early users for speed and simplicity.</span>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <img src="/images/undraw_data.svg" alt="data illustration" className="max-w-full hover-shadow bg-white" style={{ width: 360, height: 240 }} />
          </div>
            <div className="md:col-span-2 text-xs text-gray-400 mt-3">Illustration inspired by unDraw — decorative only.</div>
        </section>
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <FeatureCard icon={<Database size={32} />} title="Data Management" description="Upload, validate, and manage datasets with ease." className="hover-shadow" />
          <FeatureCard icon={<Users size={32} />} title="Collaboration" description="Invite team members, assign roles, and review changes." className="hover-shadow" />
          <FeatureCard icon={<ShieldCheck size={32} />} title="Secure Approvals" description="Multi-reviewer approval workflow for data integrity." className="hover-shadow" />
          <FeatureCard icon={<Rocket size={32} />} title="Fast & Modern" description="Built with React, Tailwind, and a robust backend." className="hover-shadow" />
        </section>
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-indigo-700 mb-4">How it works</h2>
          <ol className="list-decimal list-inside text-gray-700 text-lg space-y-2">
            <li>Register and create your project.</li>
            <li>Upload datasets and define schema/rules.</li>
            <li>Invite reviewers and submit changes for approval.</li>
            <li>Track approvals and manage data collaboratively.</li>
          </ol>
        </section>
        <section className="text-center">
          <a href="/register" className="inline-block btn-primary bold px-8 py-3 font-semibold">Get started — it's free</a>
        </section>
      </main>
      <Footer />
    </div>
  );
}

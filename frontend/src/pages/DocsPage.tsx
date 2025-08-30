import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function DocsPage() {
  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center max-w-xl mx-auto">
          <h1 className="text-3xl font-bold text-indigo-700 mb-4">Documentation</h1>
          <p className="text-gray-600 text-lg">Documentation coming soon.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

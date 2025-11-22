import { Route, Routes, Navigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useUser } from './context/UserContext'
import { myProjectRole } from './api'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import DocsPage from './pages/DocsPage'
import NotFoundPage from './pages/NotFoundPage'
import AuthPage from './pages/AuthPage'
import ProjectsPage from './pages/ProjectsPage'
import DatasetsPage from './pages/DatasetsPage'
import DatasetDetailsPage from './pages/DatasetDetailsPage'
import DatasetSettingsPage from './pages/DatasetSettingsPage'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import MembersPage from './pages/MembersPage'
import DatasetCreatePage from './pages/DatasetCreatePage'
import DatasetSchemaRulesPage from './pages/DatasetSchemaRulesPage'
import DatasetAppendFlowPage from './pages/DatasetAppendFlowPage'
import DatasetApprovalsPage from './pages/DatasetApprovalsPage'
import DatasetViewerPage from './pages/DatasetViewerPage'
import ChangeDetailsPage from './pages/ChangeDetailsPage'
import AdminBasePage from './pages/AdminBasePage'
import ProjectPlaceholderPage from './pages/ProjectPlaceholderPage'
import ProjectQueryPage from './pages/ProjectQueryPage'
import ProjectSettingsPage from './pages/ProjectSettingsPage'
import InboxPage from './pages/InboxPage'

function RootRedirect() {
  const { user, ready } = useUser()
  if (!ready) return null // prevent flicker while session loads
  return <Navigate to={user ? '/dashboard' : '/landing'} replace />
}

function ProjectRoleGuard({ allow = ['owner', 'contributor'], children }: { allow?: Array<'owner' | 'contributor' | 'approver' | 'viewer'>; children: React.ReactNode }) {
  const { id } = useParams()
  const projectId = Number(id)
  const [role, setRole] = useState<'owner' | 'contributor' | 'viewer' | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let cancelled = false; (async () => {
      try { const r = await myProjectRole(projectId); if (!cancelled) setRole(r.role) } catch { if (!cancelled) setRole(null) } finally { if (!cancelled) setReady(true) }
    })(); return () => { cancelled = true }
  }, [projectId])
  if (!ready) return null
  if (role === 'viewer' && !allow.includes('viewer')) {
    return <Navigate to={`/projects/${projectId}`} replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Legacy auth route retained */}
      <Route path="/auth" element={<AuthPage />} />

      {/* Admin base - public for now */}
      <Route path="/admin_base" element={<AdminBasePage />} />

      {/* App routes under layout - protected */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<DatasetsPage />} />
        <Route path="/projects/:id/datasets/:datasetId" element={<DatasetDetailsPage />} />
        <Route path="/projects/:id/datasets/:datasetId/settings" element={<DatasetSettingsPage />} />
        <Route path="/projects/:id/members" element={<MembersPage />} />
        <Route path="/projects/:id/datasets/new" element={<ProjectRoleGuard allow={['owner', 'contributor']}><DatasetCreatePage /></ProjectRoleGuard>} />
        <Route path="/projects/:id/datasets/:datasetId/schema" element={<DatasetSchemaRulesPage />} />
        <Route path="/projects/:id/datasets/:datasetId/append" element={<ProjectRoleGuard allow={['owner', 'contributor']}><DatasetAppendFlowPage /></ProjectRoleGuard>} />
        <Route path="/projects/:id/datasets/:datasetId/approvals" element={<DatasetApprovalsPage />} />
        <Route path="/projects/:id/datasets/:datasetId/view" element={<DatasetViewerPage />} />
        <Route path="/projects/:id/datasets/:datasetId/changes/:changeId" element={<ChangeDetailsPage />} />
        <Route path="/projects/:id/query" element={<ProjectQueryPage />} />
        <Route path="/projects/:id/dashboard" element={<ProjectPlaceholderPage />} />
        <Route path="/projects/:id/audit" element={<ProjectRoleGuard allow={['owner', 'contributor']}><ProjectPlaceholderPage /></ProjectRoleGuard>} />
        <Route path="/projects/:id/settings" element={<ProjectRoleGuard allow={['owner']}><ProjectSettingsPage /></ProjectRoleGuard>} />
        {/* Placeholder routes should show 404 until implemented */}
        <Route path="/labs" element={<NotFoundPage />} />
        <Route path="/projects/:id/placeholder" element={<NotFoundPage />} />
      </Route>

      {/* Fallback to NotFound */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

// HomeRedirect removed; public landing is root

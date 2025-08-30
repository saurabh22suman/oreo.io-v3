import { Route, Routes, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import DocsPage from './pages/DocsPage'
import NotFoundPage from './pages/NotFoundPage'
import AuthPage from './pages/AuthPage'
import ProjectsPage from './pages/ProjectsPage'
import DatasetsPage from './pages/DatasetsPage'
import DatasetDetailsPage from './pages/DatasetDetailsPage'
import Layout from './components/Layout'
import MembersPage from './pages/MembersPage'
import DatasetCreatePage from './pages/DatasetCreatePage'
import DatasetSchemaRulesPage from './pages/DatasetSchemaRulesPage'
import DatasetAppendFlowPage from './pages/DatasetAppendFlowPage'
import DatasetApprovalsPage from './pages/DatasetApprovalsPage'
import DatasetViewerPage from './pages/DatasetViewerPage'
import ChangeDetailsPage from './pages/ChangeDetailsPage'
import AdminBasePage from './pages/AdminBasePage'

export default function App(){
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage/>} />
      <Route path="/login" element={<LoginPage/>} />
      <Route path="/register" element={<RegisterPage/>} />
  <Route path="/docs" element={<DocsPage/>} />

      {/* Legacy auth route retained */}
      <Route path="/auth" element={<AuthPage/>} />

      {/* App routes under layout */}
      <Route element={<Layout/>}>
        <Route path="/dashboard" element={<DashboardPage/>} />
        <Route path="/admin_base" element={<AdminBasePage/>}/>
        <Route path="/projects" element={<ProjectsPage/>}/>
        <Route path="/projects/:id" element={<DatasetsPage/>}/>
        <Route path="/projects/:id/datasets/:datasetId" element={<DatasetDetailsPage/>}/>
        <Route path="/projects/:id/members" element={<MembersPage/>}/>
        <Route path="/projects/:id/datasets/new" element={<DatasetCreatePage/>}/>
        <Route path="/projects/:id/datasets/:datasetId/schema" element={<DatasetSchemaRulesPage/>}/>
        <Route path="/projects/:id/datasets/:datasetId/append" element={<DatasetAppendFlowPage/>}/>
        <Route path="/projects/:id/datasets/:datasetId/approvals" element={<DatasetApprovalsPage/>}/>
        <Route path="/projects/:id/datasets/:datasetId/view" element={<DatasetViewerPage/>}/>
        <Route path="/projects/:id/datasets/:datasetId/changes/:changeId" element={<ChangeDetailsPage/>}/>
        {/* Placeholder routes should show 404 until implemented */}
        <Route path="/settings" element={<NotFoundPage/>} />
        <Route path="/labs" element={<NotFoundPage/>} />
        <Route path="/projects/:id/placeholder" element={<NotFoundPage/>} />
      </Route>

      {/* Fallback to NotFound */}
      <Route path="*" element={<NotFoundPage/>} />
    </Routes>
  )
}

// HomeRedirect removed; public landing is root

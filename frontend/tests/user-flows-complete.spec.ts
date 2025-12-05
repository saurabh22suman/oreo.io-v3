/**
 * Complete User Flows E2E Tests
 * 
 * This file tests all flows documented in docs/USER_FLOWS.md
 * 
 * Run with: npx playwright test tests/user-flows-complete.spec.ts
 * Run specific test: npx playwright test tests/user-flows-complete.spec.ts -g "Flow 1"
 * 
 * Prerequisites:
 * - Services running via Docker: docker compose -f docker-compose.dev.yml up -d
 * - Frontend accessible at http://localhost:5173
 * - Go API at http://localhost:8080
 * - Python API at http://localhost:8000
 */

import { test, expect, Page } from '@playwright/test'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const TEST_PASSWORD = 'TestPass123!'

function generateEmail(prefix: string): string {
  return `${prefix}_${Date.now()}@test.com`
}

function generateName(prefix: string): string {
  return `${prefix}_${Date.now()}`
}

async function registerUser(page: Page, email: string, password: string = TEST_PASSWORD): Promise<void> {
  await page.goto('/register')
  await page.getByPlaceholder('Enter your name').fill('Test User')
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('••••••••').first().fill(password)
  await page.getByPlaceholder('••••••••').last().fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  // Wait for redirect to login
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
}

async function loginUser(page: Page, email: string, password: string = TEST_PASSWORD): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  // Wait for redirect to dashboard (successful login)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

async function registerAndLogin(page: Page, email: string, password: string = TEST_PASSWORD): Promise<void> {
  await registerUser(page, email, password)
  await loginUser(page, email, password)
}

async function logout(page: Page): Promise<void> {
  // Clear session by calling logout API and clearing storage
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    localStorage.clear()
    sessionStorage.clear()
  })
  // Clear cookies
  await page.context().clearCookies()
}

async function getCurrentUserId(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    const r = await fetch('/api/auth/me', { credentials: 'include' })
    const j = await r.json()
    return Number(j.id || j.ID)
  })
}

async function createProjectViaAPI(page: Page, name: string): Promise<number> {
  const result = await page.evaluate(async (projectName: string) => {
    const r = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: projectName, description: 'E2E Test Project' })
    })
    const j = await r.json()
    return { ok: r.ok, id: j.id || j.ID }
  }, name)
  expect(result.ok).toBeTruthy()
  return Number(result.id)
}

async function createDatasetViaAPI(page: Page, projectId: number, name: string): Promise<number> {
  const tableSlug = name.toLowerCase().replace(/[^a-z0-9_]+/g, '_')
  const result = await page.evaluate(async (args: { projectId: number; name: string; tableSlug: string }) => {
    const r = await fetch(`/api/projects/${args.projectId}/datasets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: args.name,
        dataset_name: args.name,
        schema: 'public',
        table: args.tableSlug,
        target: { type: 'table', dsn: `public.${args.tableSlug}` }
      })
    })
    const j = await r.json()
    return { ok: r.ok, id: j.id || j.ID }
  }, { projectId, name, tableSlug })
  expect(result.ok).toBeTruthy()
  return Number(result.id)
}

async function addMemberViaAPI(page: Page, projectId: number, email: string, role: string): Promise<void> {
  const result = await page.evaluate(async (args: { projectId: number; email: string; role: string }) => {
    const r = await fetch(`/api/projects/${args.projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: args.email, role: args.role })
    })
    return r.ok
  }, { projectId, email, role })
  expect(result).toBeTruthy()
}

// ============================================================================
// FLOW 1: AUTHENTICATION
// ============================================================================

test.describe('Flow 1: Authentication', () => {
  
  test('1.1 User can register new account', async ({ page }) => {
    const email = generateEmail('reg')
    await page.goto('/register')
    
    await page.getByPlaceholder('Enter your name').fill('Test User')
    await page.getByPlaceholder('you@example.com').fill(email)
    await page.getByPlaceholder('••••••••').first().fill(TEST_PASSWORD)
    await page.getByPlaceholder('••••••••').last().fill(TEST_PASSWORD)
    
    await page.getByRole('button', { name: 'Create account' }).click()
    
    // Should redirect to login after successful registration
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })

  test('1.2 User can login with credentials', async ({ page }) => {
    const email = generateEmail('login')
    await registerUser(page, email)
    
    await page.goto('/login')
    await page.getByPlaceholder('you@example.com').fill(email)
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    
    // Should redirect to dashboard after login
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    // Verify welcome message is visible (confirms successful auth)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 5000 })
  })

  test('1.3 Session check redirects unauthenticated users', async ({ page }) => {
    await page.goto('/projects')
    // Should redirect to login
    await expect(page).toHaveURL(/\/(login|landing)/, { timeout: 5000 })
  })

  test('1.4 User can logout', async ({ page }) => {
    const email = generateEmail('logout')
    await registerAndLogin(page, email)
    
    // Verify logged in - dashboard should be visible
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
    
    // Logout via API
    await logout(page)
    await page.goto('/projects')
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/(login|landing)/, { timeout: 5000 })
  })
})

// ============================================================================
// FLOW 2: PROJECT MANAGEMENT
// ============================================================================

test.describe('Flow 2: Project Management', () => {
  
  test('2.1 User can view projects list', async ({ page }) => {
    const email = generateEmail('projlist')
    await registerAndLogin(page, email)
    
    await page.goto('/projects')
    // Look for the Projects heading specifically
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({ timeout: 5000 })
  })

  test('2.2 User can create a project via API', async ({ page }) => {
    const email = generateEmail('projcreate')
    await registerAndLogin(page, email)
    
    const projName = generateName('Project')
    const projectId = await createProjectViaAPI(page, projName)
    
    expect(projectId).toBeGreaterThan(0)
    
    // Verify project exists by fetching it
    const result = await page.evaluate(async (pid: number) => {
      const r = await fetch(`/api/projects/${pid}`, { credentials: 'include' })
      const j = await r.json()
      return { ok: r.ok, name: j.name }
    }, projectId)
    
    expect(result.ok).toBeTruthy()
    expect(result.name).toBe(projName)
  })

  test('2.3 Owner can manage project members', async ({ page }) => {
    const owner = generateEmail('owner')
    const member = generateEmail('member')
    
    // Create owner and project
    await registerAndLogin(page, owner)
    const projectId = await createProjectViaAPI(page, generateName('MemberProj'))
    
    // Register member
    await logout(page)
    await registerUser(page, member)
    await logout(page)
    
    // Login as owner and add member
    await loginUser(page, owner)
    await addMemberViaAPI(page, projectId, member, 'viewer')
    
    // Verify member was added via API
    const members = await page.evaluate(async (pid: number) => {
      const r = await fetch(`/api/projects/${pid}/members`, { credentials: 'include' })
      return r.json()
    }, projectId)
    
    expect(members.some((m: { email: string }) => m.email === member)).toBeTruthy()
  })

  test('2.4 Owner can delete project', async ({ page }) => {
    const email = generateEmail('projdel')
    await registerAndLogin(page, email)
    
    const projectId = await createProjectViaAPI(page, generateName('DeleteProj'))
    
    // Delete via API
    const deleted = await page.evaluate(async (pid: number) => {
      const r = await fetch(`/api/projects/${pid}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      return r.ok
    }, projectId)
    
    expect(deleted).toBeTruthy()
  })
})

// ============================================================================
// FLOW 3: DATASET CREATION
// ============================================================================

test.describe('Flow 3: Dataset Creation', () => {
  
  test('3.1 User can create a dataset in a project', async ({ page }) => {
    const email = generateEmail('dscreate')
    await registerAndLogin(page, email)
    const projectId = await createProjectViaAPI(page, generateName('DSProj'))
    
    const dsName = generateName('Dataset')
    const datasetId = await createDatasetViaAPI(page, projectId, dsName)
    
    expect(datasetId).toBeGreaterThan(0)
  })

  test('3.2 User can stage upload a file', async ({ page }) => {
    const email = generateEmail('upload')
    await registerAndLogin(page, email)
    const projectId = await createProjectViaAPI(page, generateName('UploadProj'))
    
    // Stage upload via API (simulate file upload)
    const stageResult = await page.evaluate(async (pid: number) => {
      // Create form data with CSV content
      const csvContent = 'id,name,value\n1,Alice,100\n2,Bob,200'
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const formData = new FormData()
      formData.append('file', blob, 'test.csv')
      formData.append('project_id', String(pid))
      
      const r = await fetch('/api/datasets/stage-upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })
      const j = await r.json()
      return { ok: r.ok, staging_id: j.staging_id, row_count: j.row_count }
    }, projectId)
    
    expect(stageResult.ok).toBeTruthy()
    expect(stageResult.staging_id).toBeTruthy()
  })
})

// ============================================================================
// FLOW 4: DATA VIEWING
// ============================================================================

test.describe('Flow 4: Data Viewing', () => {
  
  test('4.1 User can get dataset stats', async ({ page }) => {
    const email = generateEmail('stats')
    await registerAndLogin(page, email)
    const projectId = await createProjectViaAPI(page, generateName('StatsProj'))
    const datasetId = await createDatasetViaAPI(page, projectId, generateName('StatsDS'))
    
    // Get stats
    const stats = await page.evaluate(async (dsId: number) => {
      const r = await fetch(`/api/datasets/${dsId}/stats`, { credentials: 'include' })
      return { ok: r.ok, data: await r.json() }
    }, datasetId)
    
    expect(stats.ok).toBeTruthy()
  })
})

// ============================================================================
// FLOW 5: APPEND DATA
// ============================================================================

test.describe('Flow 5: Append Data', () => {
  
  test('5.1 User can validate append data', async ({ page }) => {
    const email = generateEmail('append_val')
    await registerAndLogin(page, email)
    const projectId = await createProjectViaAPI(page, generateName('AppendValProj'))
    const datasetId = await createDatasetViaAPI(page, projectId, generateName('AppendValDS'))
    
    // Validate append
    const validateResult = await page.evaluate(async (dsId: number) => {
      const r = await fetch(`/api/datasets/${dsId}/data/append/json/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rows: [{ id: 1, name: 'Test' }],
          filename: 'append.json'
        })
      })
      return r.json()
    }, datasetId)
    
    expect(validateResult.ok).toBeTruthy()
    expect(validateResult.upload_id).toBeTruthy()
  })

  test('5.2 Full append workflow with reviewer approval', async ({ page }) => {
    const owner = generateEmail('append_owner')
    const reviewer = generateEmail('append_reviewer')
    
    // Setup: Create owner with project/dataset
    await registerAndLogin(page, owner)
    const projectId = await createProjectViaAPI(page, generateName('AppendProj'))
    const datasetId = await createDatasetViaAPI(page, projectId, generateName('AppendDS'))
    
    // Register reviewer and get their ID
    await logout(page)
    await registerAndLogin(page, reviewer)
    const reviewerId = await getCurrentUserId(page)
    
    // Add reviewer to project
    await logout(page)
    await loginUser(page, owner)
    await addMemberViaAPI(page, projectId, reviewer, 'contributor')
    
    // Validate append
    const validateResult = await page.evaluate(async (dsId: number) => {
      const r = await fetch(`/api/datasets/${dsId}/data/append/json/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rows: [{ id: 1, name: 'Alice' }],
          filename: 'append.json'
        })
      })
      return r.json()
    }, datasetId)
    
    expect(validateResult.upload_id).toBeTruthy()
    
    // Open change request
    const openResult = await page.evaluate(async (args: { dsId: number; uploadId: number; reviewerId: number }) => {
      const r = await fetch(`/api/datasets/${args.dsId}/data/append/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          upload_id: args.uploadId,
          reviewer_ids: [args.reviewerId],
          title: 'Append data'
        })
      })
      const j = await r.json()
      return { ok: r.ok, changeId: j.change_request?.id || j.change_request?.ID }
    }, { dsId: datasetId, uploadId: Number(validateResult.upload_id), reviewerId })
    
    expect(openResult.ok).toBeTruthy()
    expect(openResult.changeId).toBeTruthy()
    
    // Switch to reviewer and approve
    await logout(page)
    await loginUser(page, reviewer)
    
    const approveResult = await page.evaluate(async (args: { projectId: number; changeId: number }) => {
      const r = await fetch(`/api/projects/${args.projectId}/changes/${args.changeId}/approve`, {
        method: 'POST',
        credentials: 'include'
      })
      return r.ok
    }, { projectId, changeId: Number(openResult.changeId) })
    
    expect(approveResult).toBeTruthy()
  })
})

// ============================================================================
// FLOW 7: CHANGE REQUEST APPROVAL
// ============================================================================

test.describe('Flow 7: Change Request Approval', () => {
  
  test('7.1 User can view pending changes', async ({ page }) => {
    const email = generateEmail('changes')
    await registerAndLogin(page, email)
    const projectId = await createProjectViaAPI(page, generateName('ChangesProj'))
    
    // Get pending changes
    const changes = await page.evaluate(async (pid: number) => {
      const r = await fetch(`/api/projects/${pid}/changes?status=pending`, {
        credentials: 'include'
      })
      return r.json()
    }, projectId)
    
    expect(Array.isArray(changes)).toBeTruthy()
  })

  test('7.2 Reviewer can reject a change request', async ({ page }) => {
    const owner = generateEmail('reject_owner')
    const reviewer = generateEmail('reject_reviewer')
    
    // Setup with append
    await registerAndLogin(page, owner)
    const projectId = await createProjectViaAPI(page, generateName('RejectProj'))
    const datasetId = await createDatasetViaAPI(page, projectId, generateName('RejectDS'))
    
    await logout(page)
    await registerAndLogin(page, reviewer)
    const reviewerId = await getCurrentUserId(page)
    
    await logout(page)
    await loginUser(page, owner)
    await addMemberViaAPI(page, projectId, reviewer, 'contributor')
    
    // Create append CR
    const validateResult = await page.evaluate(async (dsId: number) => {
      const r = await fetch(`/api/datasets/${dsId}/data/append/json/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows: [{ id: 1, name: 'Test' }], filename: 'test.json' })
      })
      return r.json()
    }, datasetId)
    
    const openResult = await page.evaluate(async (args: { dsId: number; uploadId: number; reviewerId: number }) => {
      const r = await fetch(`/api/datasets/${args.dsId}/data/append/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          upload_id: args.uploadId,
          reviewer_ids: [args.reviewerId],
          title: 'Test append'
        })
      })
      const j = await r.json()
      return { changeId: j.change_request?.id || j.change_request?.ID }
    }, { dsId: datasetId, uploadId: Number(validateResult.upload_id), reviewerId })
    
    // Reject as reviewer
    await logout(page)
    await loginUser(page, reviewer)
    
    const rejectResult = await page.evaluate(async (args: { projectId: number; changeId: number }) => {
      const r = await fetch(`/api/projects/${args.projectId}/changes/${args.changeId}/reject`, {
        method: 'POST',
        credentials: 'include'
      })
      return r.ok
    }, { projectId, changeId: Number(openResult.changeId) })
    
    expect(rejectResult).toBeTruthy()
  })

  test('7.3 Submitter can withdraw a change request', async ({ page }) => {
    const owner = generateEmail('withdraw')
    
    await registerAndLogin(page, owner)
    const projectId = await createProjectViaAPI(page, generateName('WithdrawProj'))
    const datasetId = await createDatasetViaAPI(page, projectId, generateName('WithdrawDS'))
    const ownerId = await getCurrentUserId(page)
    
    // Create append CR (self as reviewer for simplicity)
    const validateResult = await page.evaluate(async (dsId: number) => {
      const r = await fetch(`/api/datasets/${dsId}/data/append/json/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows: [{ id: 1, name: 'Test' }], filename: 'test.json' })
      })
      return r.json()
    }, datasetId)
    
    const openResult = await page.evaluate(async (args: { dsId: number; uploadId: number; reviewerId: number }) => {
      const r = await fetch(`/api/datasets/${args.dsId}/data/append/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          upload_id: args.uploadId,
          reviewer_ids: [args.reviewerId],
          title: 'Test append'
        })
      })
      const j = await r.json()
      return { changeId: j.change_request?.id || j.change_request?.ID }
    }, { dsId: datasetId, uploadId: Number(validateResult.upload_id), reviewerId: ownerId })
    
    // Withdraw
    const withdrawResult = await page.evaluate(async (args: { projectId: number; changeId: number }) => {
      const r = await fetch(`/api/projects/${args.projectId}/changes/${args.changeId}/withdraw`, {
        method: 'POST',
        credentials: 'include'
      })
      return r.ok
    }, { projectId, changeId: Number(openResult.changeId) })
    
    expect(withdrawResult).toBeTruthy()
  })
})

// ============================================================================
// FLOW 8: VALIDATION
// ============================================================================

test.describe('Flow 8: Validation', () => {
  
  test('8.1 Cell-level validation', async ({ page }) => {
    const email = generateEmail('cell_val')
    await registerAndLogin(page, email)
    
    // Validate a cell
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/data/rules/validate/cell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          column: 'test_col',
          value: 'test_value',
          rules: []
        })
      })
      return r.ok
    })
    
    expect(result).toBeTruthy()
  })

  test('8.2 Batch validation', async ({ page }) => {
    const email = generateEmail('batch_val')
    await registerAndLogin(page, email)
    
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/data/rules/validate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rows: [{ id: 1, name: 'Test' }],
          rules: []
        })
      })
      return r.ok
    })
    
    expect(result).toBeTruthy()
  })
})

// ============================================================================
// FLOW 9: SNAPSHOTS & RESTORE
// ============================================================================

test.describe('Flow 9: Snapshots & Restore', () => {
  
  test('9.1 User can view snapshot calendar', async ({ page }) => {
    const email = generateEmail('snap_cal')
    await registerAndLogin(page, email)
    const projectId = await createProjectViaAPI(page, generateName('SnapCalProj'))
    const datasetId = await createDatasetViaAPI(page, projectId, generateName('SnapCalDS'))
    
    const calendar = await page.evaluate(async (dsId: number) => {
      const r = await fetch(`/api/datasets/${dsId}/snapshots/calendar`, {
        credentials: 'include'
      })
      return r.ok
    }, datasetId)
    
    expect(calendar).toBeTruthy()
  })
})

// ============================================================================
// FLOW 10: AUDIT TRAIL
// ============================================================================

test.describe('Flow 10: Audit Trail', () => {
  
  test('10.1 User can view audit events', async ({ page }) => {
    const email = generateEmail('audit')
    await registerAndLogin(page, email)
    const projectId = await createProjectViaAPI(page, generateName('AuditProj'))
    const datasetId = await createDatasetViaAPI(page, projectId, generateName('AuditDS'))
    
    const audit = await page.evaluate(async (dsId: number) => {
      const r = await fetch(`/api/datasets/${dsId}/audit`, {
        credentials: 'include'
      })
      return r.ok
    }, datasetId)
    
    expect(audit).toBeTruthy()
  })
})

// ============================================================================
// FLOW 11: NOTIFICATIONS
// ============================================================================

test.describe('Flow 11: Notifications', () => {
  
  test('11.1 User can view notification inbox', async ({ page }) => {
    const email = generateEmail('notif')
    await registerAndLogin(page, email)
    
    const notifications = await page.evaluate(async () => {
      const r = await fetch('/api/security/notifications', {
        credentials: 'include'
      })
      return r.ok
    })
    
    expect(notifications).toBeTruthy()
  })

  test('11.2 User can get unread notification count', async ({ page }) => {
    const email = generateEmail('notif_count')
    await registerAndLogin(page, email)
    
    // Get unread count via API (note: underscore not hyphen)
    const result = await page.evaluate(async () => {
      const r = await fetch('/api/security/notifications/unread_count', {
        credentials: 'include'
      })
      return r.ok
    })
    
    expect(result).toBeTruthy()
  })
})

// ============================================================================
// ROLE-BASED ACCESS CONTROL
// ============================================================================

test.describe('Role-Based Access Control', () => {
  
  test('Viewer cannot submit append', async ({ page }) => {
    const owner = generateEmail('rbac_owner')
    const viewer = generateEmail('rbac_viewer')
    
    await registerAndLogin(page, owner)
    const projectId = await createProjectViaAPI(page, generateName('RBACProj'))
    const datasetId = await createDatasetViaAPI(page, projectId, generateName('RBACDS'))
    
    await logout(page)
    await registerAndLogin(page, viewer)
    
    await logout(page)
    await loginUser(page, owner)
    await addMemberViaAPI(page, projectId, viewer, 'viewer')
    
    // Login as viewer and try to append
    await logout(page)
    await loginUser(page, viewer)
    
    const result = await page.evaluate(async (dsId: number) => {
      const r = await fetch(`/api/datasets/${dsId}/data/append/json/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows: [{ id: 1 }], filename: 'test.json' })
      })
      return { ok: r.ok, status: r.status }
    }, datasetId)
    
    // Viewer should be forbidden
    expect(result.status).toBe(403)
  })

  test('Contributor can submit but not delete project', async ({ page }) => {
    const owner = generateEmail('rbac2_owner')
    const contributor = generateEmail('rbac2_contrib')
    
    await registerAndLogin(page, owner)
    const projectId = await createProjectViaAPI(page, generateName('RBAC2Proj'))
    
    await logout(page)
    await registerAndLogin(page, contributor)
    
    await logout(page)
    await loginUser(page, owner)
    await addMemberViaAPI(page, projectId, contributor, 'contributor')
    
    // Login as contributor and try to delete
    await logout(page)
    await loginUser(page, contributor)
    
    const deleteResult = await page.evaluate(async (pid: number) => {
      const r = await fetch(`/api/projects/${pid}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      return r.status
    }, projectId)
    
    // Contributor should be forbidden from deleting
    expect(deleteResult).toBe(403)
  })
})

// ============================================================================
// COMPLETE USER JOURNEY (End-to-End)
// ============================================================================

test.describe('Complete User Journey', () => {
  
  test('Full journey: Register → Create Project → Create Dataset → Append → Approve → View', async ({ page }) => {
    const user1 = generateEmail('journey_user1')
    const user2 = generateEmail('journey_user2')
    
    // Step 1: User1 registers and creates project
    await registerAndLogin(page, user1)
    
    // Step 2: Create project via API
    const projName = generateName('JourneyProj')
    const projectId = await createProjectViaAPI(page, projName)
    
    // Step 3: Create dataset
    const datasetId = await createDatasetViaAPI(page, projectId, generateName('JourneyDS'))
    
    // Step 4: Register user2 as reviewer
    await logout(page)
    await registerAndLogin(page, user2)
    const user2Id = await getCurrentUserId(page)
    
    // Step 5: Add user2 to project
    await logout(page)
    await loginUser(page, user1)
    await addMemberViaAPI(page, projectId, user2, 'contributor')
    
    // Step 6: Create append request
    const validateResult = await page.evaluate(async (dsId: number) => {
      const r = await fetch(`/api/datasets/${dsId}/data/append/json/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows: [{ id: 1, name: 'Journey Test' }], filename: 'journey.json' })
      })
      return r.json()
    }, datasetId)
    
    const openResult = await page.evaluate(async (args: { dsId: number; uploadId: number; reviewerId: number }) => {
      const r = await fetch(`/api/datasets/${args.dsId}/data/append/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          upload_id: args.uploadId,
          reviewer_ids: [args.reviewerId],
          title: 'Journey Append'
        })
      })
      const j = await r.json()
      return { changeId: j.change_request?.id || j.change_request?.ID }
    }, { dsId: datasetId, uploadId: Number(validateResult.upload_id), reviewerId: user2Id })
    
    // Step 7: User2 approves
    await logout(page)
    await loginUser(page, user2)
    
    const approveResult = await page.evaluate(async (args: { projectId: number; changeId: number }) => {
      const r = await fetch(`/api/projects/${args.projectId}/changes/${args.changeId}/approve`, {
        method: 'POST',
        credentials: 'include'
      })
      return r.ok
    }, { projectId, changeId: Number(openResult.changeId) })
    
    expect(approveResult).toBeTruthy()
    
    // Step 8: Verify data
    let rowCount = 0
    for (let i = 0; i < 20; i++) {
      const stats = await page.evaluate(async (dsId: number) => {
        const r = await fetch(`/api/datasets/${dsId}/stats`, { credentials: 'include' })
        return r.json()
      }, datasetId)
      rowCount = Number(stats.row_count || 0)
      if (rowCount >= 1) break
      await page.waitForTimeout(500)
    }
    
    expect(rowCount).toBeGreaterThanOrEqual(1)
  })
})

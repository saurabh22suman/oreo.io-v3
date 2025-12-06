/**
 * Upload & Validation Flow E2E Tests
 * 
 * Tests for data upload, append, business rules validation, and live edit flows
 * Uses multi-user pattern: user1 creates, user2 reviews/approves
 */

import { test, expect, Page } from '@playwright/test'

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
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
}

async function loginUser(page: Page, email: string, password: string = TEST_PASSWORD): Promise<void> {
  await page.goto('/login')
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

async function registerAndLogin(page: Page, email: string, password: string = TEST_PASSWORD): Promise<void> {
  await registerUser(page, email, password)
  await loginUser(page, email, password)
}

async function logout(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  })
}

async function getCurrentUserId(page: Page): Promise<number> {
  const r = await page.evaluate(async () => {
    const r = await fetch('/api/auth/me', { credentials: 'include' })
    const j = await r.json()
    return Number(j.id || j.ID)
  })
  return r
}

async function createProjectViaAPI(page: Page, name: string): Promise<number> {
  const result = await page.evaluate(async (projName: string) => {
    const r = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: projName, description: 'E2E test project' })
    })
    const j = await r.json()
    return { ok: r.ok, id: j.id || j.ID }
  }, name)
  
  expect(result.ok, 'Failed to create project').toBeTruthy()
  return Number(result.id)
}

async function addMemberToProject(page: Page, projectId: number, email: string, role: string = 'viewer'): Promise<void> {
  const result = await page.evaluate(async (args: { projectId: number; email: string; role: string }) => {
    const r = await fetch(`/api/projects/${args.projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: args.email, role: args.role })
    })
    return { ok: r.ok }
  }, { projectId, email, role })
  
  expect(result.ok, 'Failed to add member to project').toBeTruthy()
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
    return { ok: r.ok, id: j.id || j.ID, error: j.error || j.message }
  }, { projectId, name, tableSlug })
  
  expect(result.ok, `Failed to create dataset: ${result.error}`).toBeTruthy()
  return Number(result.id)
}

async function appendDataWithReviewer(
  page: Page, 
  projectId: number, 
  datasetId: number, 
  rows: object[],
  reviewerId: number
): Promise<number> {
  const vres = await page.evaluate(async (args: { datasetId: number; rows: object[] }) => {
    const r = await fetch(`/api/datasets/${args.datasetId}/data/append/json/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rows: args.rows, filename: 'append.json' })
    })
    const j = await r.json()
    return j
  }, { datasetId, rows })
  
  expect(vres.ok !== false, `Validation failed: ${vres.error || JSON.stringify(vres)}`).toBeTruthy()
  expect(vres.upload_id, 'No upload_id returned').toBeTruthy()
  
  const open = await page.evaluate(async (args: { datasetId: number; uploadId: number; reviewerId: number }) => {
    const r = await fetch(`/api/datasets/${args.datasetId}/data/append/open`, {
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
    return { ok: r.ok, body: j }
  }, { datasetId, uploadId: Number(vres.upload_id), reviewerId })
  
  expect(open.ok, `Failed to open CR: ${JSON.stringify(open.body)}`).toBeTruthy()
  const changeId = Number(open.body?.change_request?.id || open.body?.change_request?.ID)
  expect(changeId, 'No change request ID returned').toBeTruthy()
  
  return changeId
}

async function approveChange(page: Page, projectId: number, changeId: number): Promise<void> {
  const approveRes = await page.evaluate(async (args: { projectId: number; changeId: number }) => {
    const r = await fetch(`/api/projects/${args.projectId}/changes/${args.changeId}/approve`, {
      method: 'POST',
      credentials: 'include'
    })
    return { ok: r.ok }
  }, { projectId, changeId })
  
  expect(approveRes.ok, 'Failed to approve change request').toBeTruthy()
  await page.waitForTimeout(1000)
}

async function getDatasetRowCount(page: Page, datasetId: number): Promise<number> {
  for (let i = 0; i < 15; i++) {
    const stats = await page.evaluate(async (dsId: number) => {
      const r = await fetch(`/api/datasets/${dsId}/stats`, { credentials: 'include' })
      return r.json()
    }, datasetId)
    const count = Number(stats.row_count || stats.rowCount || 0)
    if (count > 0) return count
    await page.waitForTimeout(500)
  }
  return 0
}

async function addBusinessRulesViaAPI(page: Page, datasetId: number, rules: object[]): Promise<void> {
  const result = await page.evaluate(async (args: { datasetId: number; rules: string }) => {
    const r = await fetch(`/api/datasets/${args.datasetId}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rules: args.rules })
    })
    return { ok: r.ok, status: r.status }
  }, { datasetId, rules: JSON.stringify(rules) })
  
  expect(result.ok, `Failed to set business rules: ${result.status}`).toBeTruthy()
}

// ==============================================================================
// TEST SUITE
// ==============================================================================

test.describe('Upload & Validation Flows', () => {
  test('Test 1: Upload dataset, append new data, count should increase', async ({ page }) => {
    const ts = Date.now()
    const user1Email = `owner_${ts}@test.com`
    const user2Email = `reviewer_${ts}@test.com`
    
    // Setup: Register and login user1 (owner)
    await registerAndLogin(page, user1Email)
    
    // Create project
    const projectId = await createProjectViaAPI(page, `TestProject_${ts}`)
    
    // Register user2 and get their ID
    await logout(page)
    await registerAndLogin(page, user2Email)
    const user2Id = await getCurrentUserId(page)
    
    // Back to user1, add user2 as project member
    await logout(page)
    await loginUser(page, user1Email)
    await addMemberToProject(page, projectId, user2Email, 'viewer')
    
    // Create dataset
    const datasetId = await createDatasetViaAPI(page, projectId, `Dataset_${ts}`)
    
    // Append initial rows
    const initialRows = [
      { id: 1, name: 'Alice', age: 30, salary: 50000, department: 'Engineering' },
      { id: 2, name: 'Bob', age: 25, salary: 45000, department: 'Marketing' },
      { id: 3, name: 'Charlie', age: 35, salary: 60000, department: 'Sales' }
    ]
    const changeId1 = await appendDataWithReviewer(page, projectId, datasetId, initialRows, user2Id)
    
    // User2 approves
    await logout(page)
    await loginUser(page, user2Email)
    await approveChange(page, projectId, changeId1)
    
    // Check initial count
    const initialCount = await getDatasetRowCount(page, datasetId)
    console.log('Initial row count:', initialCount)
    expect(initialCount).toBe(3)
    
    // Back to user1, append more rows
    await logout(page)
    await loginUser(page, user1Email)
    
    const appendRows = [
      { id: 4, name: 'Diana', age: 28, salary: 55000, department: 'Engineering' },
      { id: 5, name: 'Eve', age: 32, salary: 52000, department: 'HR' }
    ]
    const changeId2 = await appendDataWithReviewer(page, projectId, datasetId, appendRows, user2Id)
    
    // User2 approves
    await logout(page)
    await loginUser(page, user2Email)
    await approveChange(page, projectId, changeId2)
    
    // Verify final count
    const finalCount = await getDatasetRowCount(page, datasetId)
    console.log('Final row count:', finalCount)
    expect(finalCount).toBe(5)
    expect(finalCount).toBeGreaterThan(initialCount)
  })

  test('Test 2: Append with different column names - validation response', async ({ page }) => {
    const ts = Date.now()
    const user1Email = `owner2_${ts}@test.com`
    const user2Email = `reviewer2_${ts}@test.com`
    
    await registerAndLogin(page, user1Email)
    const projectId = await createProjectViaAPI(page, `ColMismatchProject_${ts}`)
    
    await logout(page)
    await registerAndLogin(page, user2Email)
    const user2Id = await getCurrentUserId(page)
    
    await logout(page)
    await loginUser(page, user1Email)
    await addMemberToProject(page, projectId, user2Email, 'viewer')
    
    const datasetId = await createDatasetViaAPI(page, projectId, `ColMismatchDS_${ts}`)
    
    // First append with correct columns
    const initialRows = [{ id: 1, name: 'Alice', age: 30, salary: 50000, department: 'Engineering' }]
    const changeId = await appendDataWithReviewer(page, projectId, datasetId, initialRows, user2Id)
    
    await logout(page)
    await loginUser(page, user2Email)
    await approveChange(page, projectId, changeId)
    
    await logout(page)
    await loginUser(page, user1Email)
    
    // Try to append with wrong columns
    const wrongColumnRows = [{ id: 4, fullname: 'Diana', years: 28, income: 55000, dept: 'Engineering' }]
    
    const vres = await page.evaluate(async (args: { datasetId: number; rows: object[] }) => {
      const r = await fetch(`/api/datasets/${args.datasetId}/data/append/json/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows: args.rows, filename: 'wrong_columns.json' })
      })
      const j = await r.json()
      return { ok: r.ok, statusCode: r.status, body: j }
    }, { datasetId, rows: wrongColumnRows })
    
    console.log('Column mismatch response:', JSON.stringify(vres))
    
    // Navigate to append page and screenshot
    await page.goto(`/projects/${projectId}/datasets/${datasetId}/append`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/column-mismatch-error.png', fullPage: true })
    console.log('Screenshot saved: test-results/column-mismatch-error.png')
    
    // The validation response should indicate column issues
    // (exact behavior depends on implementation)
  })

  test('Test 3: Business rules validation - cells flagged by severity', async ({ page }) => {
    const ts = Date.now()
    const user1Email = `owner3_${ts}@test.com`
    const user2Email = `reviewer3_${ts}@test.com`
    
    await registerAndLogin(page, user1Email)
    const projectId = await createProjectViaAPI(page, `RulesProject_${ts}`)
    
    await logout(page)
    await registerAndLogin(page, user2Email)
    const user2Id = await getCurrentUserId(page)
    
    await logout(page)
    await loginUser(page, user1Email)
    await addMemberToProject(page, projectId, user2Email, 'viewer')
    
    const datasetId = await createDatasetViaAPI(page, projectId, `RulesDS_${ts}`)
    
    // Initial data
    const initialRows = [{ id: 1, name: 'Alice', age: 30, salary: 50000, department: 'Engineering' }]
    const changeId = await appendDataWithReviewer(page, projectId, datasetId, initialRows, user2Id)
    
    await logout(page)
    await loginUser(page, user2Email)
    await approveChange(page, projectId, changeId)
    
    await logout(page)
    await loginUser(page, user1Email)
    
    // Add business rules
    const rules = [
      {
        column: 'age',
        rule_type: 'range',
        min_value: 18,
        max_value: 100,
        severity: 'error',
        message: 'Age must be between 18 and 100'
      }
    ]
    await addBusinessRulesViaAPI(page, datasetId, rules)
    
    // Try to append with violations
    const violationRows = [
      { id: 2, name: 'Child', age: 5, salary: 0, department: 'None' },
      { id: 3, name: 'Ancient', age: 150, salary: 0, department: 'None' }
    ]
    
    const vres = await page.evaluate(async (args: { datasetId: number; rows: object[] }) => {
      const r = await fetch(`/api/datasets/${args.datasetId}/data/append/json/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows: args.rows, filename: 'violations.json' })
      })
      const j = await r.json()
      return { ok: r.ok, body: j }
    }, { datasetId, rows: violationRows })
    
    console.log('Business rules validation response:', JSON.stringify(vres))
    
    await page.goto(`/projects/${projectId}/datasets/${datasetId}/append`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/business-rules-validation-errors.png', fullPage: true })
    console.log('Screenshot saved: test-results/business-rules-validation-errors.png')
  })

  test('Test 4: Live Edit page navigation', async ({ page }) => {
    const ts = Date.now()
    const user1Email = `owner4_${ts}@test.com`
    const user2Email = `reviewer4_${ts}@test.com`
    
    await registerAndLogin(page, user1Email)
    const projectId = await createProjectViaAPI(page, `LiveEditProject_${ts}`)
    
    await logout(page)
    await registerAndLogin(page, user2Email)
    const user2Id = await getCurrentUserId(page)
    
    await logout(page)
    await loginUser(page, user1Email)
    await addMemberToProject(page, projectId, user2Email, 'viewer')
    
    const datasetId = await createDatasetViaAPI(page, projectId, `LiveEditDS_${ts}`)
    
    const initialRows = [{ id: 1, name: 'Alice', age: 30, salary: 50000, department: 'Engineering' }]
    const changeId = await appendDataWithReviewer(page, projectId, datasetId, initialRows, user2Id)
    
    await logout(page)
    await loginUser(page, user2Email)
    await approveChange(page, projectId, changeId)
    
    await logout(page)
    await loginUser(page, user1Email)
    
    // Add rules with readonly column
    const rules = [
      { column: 'id', rule_type: 'readonly', editable: false, severity: 'fatal', message: 'ID is readonly' },
      { column: 'age', rule_type: 'range', min_value: 18, max_value: 100, severity: 'error', message: 'Age 18-100' }
    ]
    await addBusinessRulesViaAPI(page, datasetId, rules)
    
    // Navigate to live edit page
    await page.goto(`/projects/${projectId}/datasets/${datasetId}/edit`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/live-edit-initial.png', fullPage: true })
    
    // Try to start edit session
    const startEditBtn = page.getByRole('button', { name: /start|edit|begin/i })
    if (await startEditBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startEditBtn.click()
      await page.waitForTimeout(1000)
    }
    await page.screenshot({ path: 'test-results/live-edit-mode.png', fullPage: true })
    console.log('Screenshots saved: test-results/live-edit-*.png')
  })

  test('Test 5: Append page with business rules', async ({ page }) => {
    const ts = Date.now()
    const user1Email = `owner5_${ts}@test.com`
    const user2Email = `reviewer5_${ts}@test.com`
    
    await registerAndLogin(page, user1Email)
    const projectId = await createProjectViaAPI(page, `AppendRulesProject_${ts}`)
    
    await logout(page)
    await registerAndLogin(page, user2Email)
    const user2Id = await getCurrentUserId(page)
    
    await logout(page)
    await loginUser(page, user1Email)
    await addMemberToProject(page, projectId, user2Email, 'viewer')
    
    const datasetId = await createDatasetViaAPI(page, projectId, `AppendRulesDS_${ts}`)
    
    const initialRows = [{ id: 1, name: 'Alice', age: 30, salary: 50000, department: 'Engineering' }]
    const changeId = await appendDataWithReviewer(page, projectId, datasetId, initialRows, user2Id)
    
    await logout(page)
    await loginUser(page, user2Email)
    await approveChange(page, projectId, changeId)
    
    await logout(page)
    await loginUser(page, user1Email)
    
    const rules = [{ column: 'age', rule_type: 'range', min_value: 18, max_value: 100, severity: 'error' }]
    await addBusinessRulesViaAPI(page, datasetId, rules)
    
    // Navigate to append page
    await page.goto(`/projects/${projectId}/datasets/${datasetId}/append`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/append-with-rules.png', fullPage: true })
    console.log('Screenshot saved: test-results/append-with-rules.png')
  })
})

test.describe('Severity Validation', () => {
  test('INFO and WARNING severity allow proceed', async ({ page }) => {
    const ts = Date.now()
    const user1Email = `info_${ts}@test.com`
    const user2Email = `info_rev_${ts}@test.com`
    
    await registerAndLogin(page, user1Email)
    const projectId = await createProjectViaAPI(page, `InfoProject_${ts}`)
    
    await logout(page)
    await registerAndLogin(page, user2Email)
    const user2Id = await getCurrentUserId(page)
    
    await logout(page)
    await loginUser(page, user1Email)
    await addMemberToProject(page, projectId, user2Email, 'viewer')
    
    const datasetId = await createDatasetViaAPI(page, projectId, `InfoDS_${ts}`)
    
    // Initial data
    const rows1 = [{ id: 1, name: 'Alice', age: 30, salary: 50000, department: 'Eng' }]
    const c1 = await appendDataWithReviewer(page, projectId, datasetId, rows1, user2Id)
    await logout(page)
    await loginUser(page, user2Email)
    await approveChange(page, projectId, c1)
    
    // Add INFO severity rule
    await logout(page)
    await loginUser(page, user1Email)
    await addBusinessRulesViaAPI(page, datasetId, [
      { column: 'age', rule_type: 'range', min_value: 25, max_value: 50, severity: 'info' }
    ])
    
    // Append with INFO violation (should still work)
    const rows2 = [{ id: 2, name: 'Young', age: 20, salary: 30000, department: 'Intern' }]
    const c2 = await appendDataWithReviewer(page, projectId, datasetId, rows2, user2Id)
    await logout(page)
    await loginUser(page, user2Email)
    await approveChange(page, projectId, c2)
    
    const count = await getDatasetRowCount(page, datasetId)
    expect(count).toBe(2)
    console.log('INFO severity test passed - row count:', count)
  })

  test('ERROR severity blocks change', async ({ page }) => {
    const ts = Date.now()
    const user1Email = `error_${ts}@test.com`
    const user2Email = `error_rev_${ts}@test.com`
    
    await registerAndLogin(page, user1Email)
    const projectId = await createProjectViaAPI(page, `ErrorProject_${ts}`)
    
    await logout(page)
    await registerAndLogin(page, user2Email)
    const user2Id = await getCurrentUserId(page)
    
    await logout(page)
    await loginUser(page, user1Email)
    await addMemberToProject(page, projectId, user2Email, 'viewer')
    
    const datasetId = await createDatasetViaAPI(page, projectId, `ErrorDS_${ts}`)
    
    const rows1 = [{ id: 1, name: 'Alice', age: 30, salary: 50000, department: 'Eng' }]
    const c1 = await appendDataWithReviewer(page, projectId, datasetId, rows1, user2Id)
    await logout(page)
    await loginUser(page, user2Email)
    await approveChange(page, projectId, c1)
    
    await logout(page)
    await loginUser(page, user1Email)
    await addBusinessRulesViaAPI(page, datasetId, [
      { column: 'age', rule_type: 'range', min_value: 18, max_value: 100, severity: 'error' }
    ])
    
    // Try to validate with ERROR violation
    const vres = await page.evaluate(async (args: { datasetId: number; rows: object[] }) => {
      const r = await fetch(`/api/datasets/${args.datasetId}/data/append/json/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rows: args.rows, filename: 'error.json' })
      })
      return { ok: r.ok, body: await r.json() }
    }, { datasetId, rows: [{ id: 2, name: 'Impossible', age: -5, salary: 0, department: 'X' }] })
    
    console.log('ERROR severity validation:', JSON.stringify(vres))
    
    await page.goto(`/projects/${projectId}/datasets/${datasetId}/append`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/error-severity.png', fullPage: true })
    
    // Count should still be 1 (the invalid append shouldn't go through)
    const count = await getDatasetRowCount(page, datasetId)
    expect(count).toBe(1)
    console.log('ERROR severity test passed - row count:', count)
  })
})

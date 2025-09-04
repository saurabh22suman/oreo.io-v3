import { test, expect } from '@playwright/test'

async function registerAndLogin(page, email: string, password = 'secret123!'){
  await page.goto('/register')
  await page.getByPlaceholder('Full name').fill('E2E User')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /create account/i }).click()
  await page.goto('/login')
  const loginForm = page.locator('form').filter({ hasText: 'Welcome back' })
  await loginForm.getByPlaceholder('Email').fill(email)
  await loginForm.getByLabel('Password', { exact: true }).fill(password)
  await loginForm.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText(email)).toBeVisible({ timeout: 5000 })
}

async function logout(page){
  await page.evaluate(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  })
}

// Multi-user append approval flow
// 1) user1 creates project; 2) user2 registered and added as viewer; 3) user1 creates dataset;
// 4) user1 opens append and assigns user2 as reviewer; 5) user2 approves; 6) rows increase

test('append approval with reviewer (multi-user) updates dataset rows', async ({ page }) => {
  const ts = Date.now()
  const user1 = `u1_${ts}@example.com`
  const user2 = `u2_${ts}@example.com`
  const password = 'secret123!'

  // Step 1: User1 registers and logs in
  await registerAndLogin(page, user1, password)

  // Create project via UI
  await page.goto('/projects')
  await page.getByRole('button', { name: /\+\s*create project/i }).click()
  const projName = `Proj_${ts}`
  const modal = page.locator('.card').filter({ hasText: 'Create Project' })
  await modal.getByRole('textbox').first().fill(projName)
  await page.getByRole('button', { name: /^create$/i }).click()
  await page.locator('tr.row-clickable', { hasText: projName }).first().click()
  const pm = page.url().match(/projects\/(\d+)/)
  const projectId = pm ? Number(pm[1]) : 1

  // Step 2: Prepare user2 account, then add as viewer to project (owner-only)
  await logout(page)
  await registerAndLogin(page, user2, password)
  // capture user2 id
  const user2Id: number = await page.evaluate(async () => {
    const r = await fetch('/api/auth/me', { credentials: 'include' }); const j = await r.json(); return Number(j.id || j.ID)
  })
  await logout(page)
  // back to user1
  await registerAndLogin(page, user1, password)
  // add member via API
  const addMemberOk: boolean = await page.evaluate(async (args) => {
    const r = await fetch(`/api/projects/${args.projectId}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ email: args.email, role: 'viewer' })
    }); return r.ok
  }, { projectId, email: user2 })
  expect(addMemberOk).toBeTruthy()

  // Step 3: User1 creates a dataset in this project
  const dsName = `DS_${ts}`
  const tableSlug = dsName.toLowerCase().replace(/[^a-z0-9_]+/g, '_')
  const created = await page.evaluate(async (args) => {
    const r = await fetch(`/api/projects/${args.projectId}/datasets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({
        name: args.dsName, dataset_name: args.dsName,
        schema: 'public', table: args.tableSlug,
        target: { type: 'table', dsn: `public.${args.tableSlug}` }
      })
    }); const j = await r.json(); return { ok: r.ok, id: j.id || j.ID }
  }, { projectId, dsName, tableSlug })
  expect(created.ok).toBeTruthy()
  const datasetId = Number(created.id)

  // Step 4: User1 creates an append request and assigns user2 as reviewer
  const rows = [{ id: 1, name: 'Alice' }]
  const vres = await page.evaluate(async (args) => {
    const r = await fetch(`/api/datasets/${args.datasetId}/data/append/json/validate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ rows: args.rows, filename: 'append.json' })
    }); const j = await r.json(); return j
  }, { datasetId, rows })
  expect(vres.ok).toBeTruthy()
  expect(vres.upload_id).toBeTruthy()

  const open = await page.evaluate(async (args) => {
    const r = await fetch(`/api/datasets/${args.datasetId}/data/append/open`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ upload_id: args.uploadId, reviewer_ids: [args.reviewerId], title: 'Append data' })
    }); const j = await r.json(); return { ok: r.ok, body: j }
  }, { datasetId, uploadId: Number(vres.upload_id), reviewerId: user2Id })
  expect(open.ok).toBeTruthy()
  const changeId = Number(open.body?.change_request?.id || open.body?.change_request?.ID)
  expect(changeId).toBeTruthy()

  // Step 5 & 6: switch to user2 and approve
  await logout(page)
  await registerAndLogin(page, user2, password)

  const aprov = await page.evaluate(async (args) => {
    const r = await fetch(`/api/projects/${args.projectId}/changes/${args.changeId}/approve`, { method: 'POST', credentials: 'include' });
    return r.ok
  }, { projectId, changeId })
  expect(aprov).toBeTruthy()

  // Step 7: verify row count increased (retry a few times for eventual consistency)
  let rowCount = 0
  for(let i=0;i<10;i++){
    const stats = await page.evaluate(async (args) => {
      const r = await fetch(`/api/datasets/${args.datasetId}/stats`, { credentials: 'include' });
      return r.json()
    }, { datasetId })
    rowCount = Number(stats.row_count || 0)
    if(rowCount >= 1) break
    await page.waitForTimeout(500)
  }
  expect(rowCount).toBeGreaterThanOrEqual(1)
})

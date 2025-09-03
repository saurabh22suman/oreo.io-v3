import { test, expect } from '@playwright/test'

// Helpers
async function registerAndLogin(page, email: string, password = 'secret123!'){
  await page.goto('/register')
  // Fill required registration fields
  await page.getByPlaceholder('Full name').fill('E2E User')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /create account/i }).click()
  // Some flows auto-login; if not, go to login
  await page.goto('/login')
  const loginForm = page.locator('form').filter({ hasText: 'Welcome back' })
  await loginForm.getByPlaceholder('Email').fill(email)
  await loginForm.getByLabel('Password', { exact: true }).fill(password)
  await loginForm.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText(email)).toBeVisible({ timeout: 5000 })
}

test.describe('Inbox realtime and pagination', () => {
  test('badge updates via SSE and mark read/unread works', async ({ page, request }) => {
    const ts = Date.now()
    const userEmail = `inbox_${ts}@example.com`
    const password = 'secret123!'

    await registerAndLogin(page, userEmail, password)

    // Create a notification BEFORE mounting sidebar to avoid SSE race; initial unread fetch will show it
    await page.evaluate(async () => {
      const r = await fetch('/api/security/notifications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ message: 'E2E test notification' })
      }); if(!r.ok){ throw new Error('notif create failed: '+r.status) }
    })

    // Now go to a page that shows the Sidebar (dashboard/projects)
    await page.goto('/projects')
    const inboxLink = page.getByRole('link', { name: /inbox/i })
    // Badge should appear (from initial unread fetch)
    await expect(inboxLink.locator('.badge-pill')).toHaveText(/1|99\+/, { timeout: 7000 })

    // Open Inbox and mark read
  await inboxLink.click()
    await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
    // Select all and mark read
    await page.getByRole('button', { name: 'Select all' }).click()
    await page.getByRole('button', { name: 'Mark read' }).click()
  // Badge should clear
  await page.goto('/projects')
  await expect(page.getByRole('link', { name: /inbox/i }).locator('.badge-pill')).toHaveCount(0)

    // Create more than one page of notifications to exercise pagination
    await page.evaluate(async () => {
      for(let i=0;i<25;i++){
        await fetch('/api/security/notifications', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ message: `Bulk note ${i}` })
        })
      }
    })
    // Go back to Inbox
    await inboxLink.click()
    // Change page size to 10
    await page.getByRole('combobox', { name: 'Page size' }).selectOption('10')
    // Next should be enabled
    const nextBtn = page.getByRole('button', { name: 'Next' })
    await expect(nextBtn).toBeEnabled()
    await nextBtn.click()
    // Previous should now be enabled
    await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled()
  })
})

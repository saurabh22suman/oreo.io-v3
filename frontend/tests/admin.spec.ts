import { test, expect } from '@playwright/test'

// Basic admin flow: open /admin_base, enter password, list users, create and cleanup a user

test.describe('Admin base page', () => {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

  test('can list and create/update/delete users', async ({ page }) => {
    await page.goto('/admin_base')

    // Enter admin password
  await page.getByPlaceholder('admin123').fill(adminPassword)

    // Wait for users table to appear
    await page.getByText('Users').waitFor({ state: 'visible' })

    // Create a user
    const email = `e2e_${Date.now()}@example.com`
  const createSection = page.locator('div.border').filter({ hasText: 'Create user' })
  await createSection.getByPlaceholder('email').fill(email)
  await createSection.getByPlaceholder('password').fill('secret123!')
  await createSection.getByRole('button', { name: 'Create' }).click()

  // Should show status and then refresh list
  await expect(page.getByText('User created')).toBeVisible()
  await page.getByRole('button', { name: 'Refresh' }).click()
  // Find row with our email
  const row = page.locator(`tbody tr:has(input[value="${email}"])`).first()
  await expect(row).toHaveCount(1)

    // Update role to editor and set a new password
  // Pick a valid role (editor may not exist; choose contributor if available else user)
  const roleSelect = row.getByRole('combobox')
  const options = await roleSelect.locator('option').allTextContents()
  const desired = options.includes('editor') ? 'editor' : (options.includes('contributor') ? 'contributor' : 'user')
  await roleSelect.selectOption(desired)
  await row.getByPlaceholder('new password (optional)').fill('newSecret!')
  await row.getByRole('button', { name: 'Save' }).click()

    // Delete the user
    page.once('dialog', d => d.accept())
    await row.getByRole('button', { name: 'Delete' }).click()

    // Ensure it's gone
    await expect(page.locator('tbody tr').filter({ hasText: email })).toHaveCount(0)
  })
})

import { test, expect } from '@playwright/test';

test.describe('Password Validation on Registration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/register');
  });

  test('should show password validation hints after typing', async ({ page }) => {
    // Fill in name and email first
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    
    // Type a weak password
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.fill('weak');
    await passwordInput.blur();
    
    // Wait a bit for validation to appear
    await page.waitForTimeout(500);
    
    // Check that validation messages appear
    await expect(page.locator('text=At least 8 characters')).toBeVisible();
    await expect(page.locator('text=1 uppercase letter (A-Z)')).toBeVisible();
    await expect(page.locator('text=1 number (0-9)')).toBeVisible();
    await expect(page.locator('text=1 special character')).toBeVisible();
    
    // Button should be disabled
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();
  });

  test('should enable submit button when all requirements are met', async ({ page }) => {
    // Fill in all fields
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    
    // Type a strong password that meets all requirements
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.fill('StrongPass123!');
    await passwordInput.blur();
    
    // Wait for validation
    await page.waitForTimeout(500);
    
    // All checks should be green (look for green text color)
    const validationChecks = page.locator('.text-green-600');
    await expect(validationChecks).toHaveCount(5); // 5 validation rules
    
    // Fill confirm password
    await page.fill('input[name="confirm"]', 'StrongPass123!');
    
    // Button should be enabled now
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
  });

  test('should show password mismatch error', async ({ page }) => {
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.fill('StrongPass123!');
    await passwordInput.blur();
    
    // Type different password in confirm field
    await page.fill('input[name="confirm"]', 'DifferentPass123!');
    
    // Should show mismatch error
    await expect(page.locator('text=Passwords do not match')).toBeVisible();
    
    // Button should still be disabled
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();
  });

  test('should show real-time validation as user types', async ({ page }) => {
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', 'test@example.com');
    
    const passwordInput = page.locator('input[name="password"]');
    
    // Start with empty password
    await passwordInput.fill('');
    await passwordInput.blur();
    
    // Type incrementally and check validation updates
    await passwordInput.fill('pass');
    await passwordInput.blur();
    await page.waitForTimeout(300);
    
    // Should show red X for all requirements
    const redChecks = page.locator('.text-red-600');
    await expect(redChecks.first()).toBeVisible();
    
    // Add uppercase
    await passwordInput.fill('Password');
    await passwordInput.blur();
    await page.waitForTimeout(300);
    
    // Should have at least one green check now (uppercase)
    const greenChecks = page.locator('.text-green-600');
    await expect(greenChecks.first()).toBeVisible();
    
    // Complete the password
    await passwordInput.fill('Password123!');
    await passwordInput.blur();
    await page.waitForTimeout(300);
    
    // All should be green now
    await expect(page.locator('.text-green-600')).toHaveCount(5);
  });
});

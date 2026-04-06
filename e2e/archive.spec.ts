import { test, expect } from '@playwright/test';

test.describe('Archive Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.memo-card, .empty-state').first()).toBeVisible({ timeout: 10000 });
  });

  test('归档备忘录', async ({ page }) => {
    // Find first memo
    const firstMemo = page.locator('.memo-card').first();
    await expect(firstMemo).toBeVisible();
    
    // Click archive button
    await firstMemo.locator('.memo-action[title="归档"]').click();
    
    // Wait for toast
    await expect(page.locator('.toast', { hasText: '已归档' })).toBeVisible();
    
    // Memo should no longer be visible in main list
    await expect(firstMemo).not.toBeVisible();
  });

  test('查看已归档备忘录', async ({ page }) => {
    // Archive a memo first
    const firstMemo = page.locator('.memo-card').first();
    await expect(firstMemo).toBeVisible();
    await firstMemo.locator('.memo-action[title="归档"]').click();
    await expect(page.locator('.toast', { hasText: '已归档' })).toBeVisible();
    
    // Click archived notebook
    await page.click('.notebook-item:has-text("已归档")');
    
    // Verify archived memos show
    await expect(page.locator('.memo-card.archived').first()).toBeVisible();
  });

  test('恢复已归档备忘录', async ({ page }) => {
    // Setup: Archive a memo first
    const firstMemo = page.locator('.memo-card').first();
    await expect(firstMemo).toBeVisible();
    await firstMemo.locator('.memo-action[title="归档"]').click();
    await expect(page.locator('.toast', { hasText: '已归档' })).toBeVisible();
    
    // Now test restore
    await page.click('.notebook-item:has-text("已归档")');
    const archivedMemo = page.locator('.memo-card.archived').first();
    await expect(archivedMemo).toBeVisible();
    
    // Click restore button
    await archivedMemo.locator('.memo-action[title="恢复"]').click();
    
    // Select notebook and confirm
    await page.click('#restoreModal .btn-primary');
    
    // Wait for toast
    await expect(page.locator('.toast', { hasText: '已恢复' })).toBeVisible();
  });
});
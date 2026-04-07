// e2e/batch.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Batch Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await expect(page.locator('.notebook-item').first()).toBeVisible({ timeout: 10000 });
  });

  test('进入选择模式', async ({ page }) => {
    // Check if there are memos
    const memoCards = page.locator('.memo-card');
    const count = await memoCards.count();
    
    if (count === 0) {
      // Create a memo first
      await page.click('#newMemoBtn');
      await page.fill('#memoContent', 'Test memo for batch selection');
      await page.click('#memoForm .btn-primary');
      await page.waitForSelector('.memo-card', { timeout: 5000 });
    }
    
    // Hover first memo card to show select circle
    const firstCard = page.locator('.memo-card').first();
    await firstCard.hover();
    
    // Select circle should appear
    const selectCircle = firstCard.locator('.select-circle');
    await expect(selectCircle).toBeVisible();
    
    // Click to select
    await selectCircle.click();
    
    // Card should have selected class
    await expect(firstCard).toHaveClass(/selected/);
    
    // Batch bar should appear
    await expect(page.locator('.batch-bar')).toBeVisible();
    await expect(page.locator('#batchCount')).toContainText('已选择 1 个');
  });

  test('取消选择', async ({ page }) => {
    // Check if there are memos
    const memoCards = page.locator('.memo-card');
    const count = await memoCards.count();
    
    if (count === 0) {
      // Create a memo first
      await page.click('#newMemoBtn');
      await page.fill('#memoContent', 'Test memo for cancel selection');
      await page.click('#memoForm .btn-primary');
      await page.waitForSelector('.memo-card', { timeout: 5000 });
    }
    
    // Select a card
    const firstCard = page.locator('.memo-card').first();
    await firstCard.hover();
    await firstCard.locator('.select-circle').click();
    
    // Click cancel
    await page.locator('.batch-bar').locator('button', { hasText: '取消' }).click();
    
    // No cards should be selected
    await expect(page.locator('.memo-card.selected')).toHaveCount(0);
    
    // Batch bar should be hidden
    await expect(page.locator('.batch-bar')).toBeHidden();
  });

  test('右键菜单显示', async ({ page }) => {
    // Check if there are memos
    const memoCards = page.locator('.memo-card');
    let count = await memoCards.count();
    
    if (count === 0) {
      // Create a memo first
      await page.click('#newMemoBtn');
      await page.fill('#memoContent', 'Test memo for context menu');
      await page.click('#memoForm .btn-primary');
      await page.waitForSelector('.memo-card', { timeout: 5000 });
    }
    
    // Select a card
    const firstCard = page.locator('.memo-card').first();
    await firstCard.hover();
    await firstCard.locator('.select-circle').click();
    
    // Right-click on any card
    await firstCard.click({ button: 'right' });
    
    // Context menu should appear
    await expect(page.locator('.context-menu')).toBeVisible();
    
    // Menu items should be present
    await expect(page.locator('.context-item', { hasText: '归档所选' })).toBeVisible();
    await expect(page.locator('.context-item', { hasText: '删除所选' })).toBeVisible();
  });
});
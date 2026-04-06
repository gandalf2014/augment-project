import { test, expect } from '@playwright/test';

test.describe('Notebook Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.notebook-item').first()).toBeVisible({ timeout: 10000 });
  });

  test('应该显示笔记本列表', async ({ page }) => {
    await expect(page.locator('.notebook-item').first()).toContainText('全部笔记');
  });

  test('创建笔记本', async ({ page }) => {
    // Use unique name to avoid conflicts with previous test runs
    const uniqueName = `测试笔记本_${Date.now()}`;
    
    // Click new notebook button
    await page.click('.notebook-new');
    
    // Fill form
    await page.fill('#notebookName', uniqueName);
    await page.click('#notebookForm .btn-primary');
    
    // Wait for notebook to appear
    await expect(page.locator('.notebook-item', { hasText: uniqueName })).toBeVisible();
  });

  test('切换笔记本', async ({ page }) => {
    // Wait for notebooks to load
    await expect(page.locator('.notebook-item').first()).toBeVisible();

    // Find a user notebook (not "全部笔记")
    const notebookItems = page.locator('.notebook-item');
    const count = await notebookItems.count();

    // Skip if only "全部笔记" exists
    if (count <= 1) {
      test.skip();
      return;
    }

    // Click second notebook (index 1)
    const notebookItem = notebookItems.nth(1);
    await notebookItem.click();

    // Verify active state
    await expect(notebookItem).toHaveClass(/active/);
  });

  test('创建备忘录时选择笔记本', async ({ page }) => {
    // Open new memo modal
    await page.click('#newMemoBtn');
    
    // Verify notebook select exists
    await expect(page.locator('#memoNotebook')).toBeVisible();
    
    // Create memo with notebook
    await page.fill('#memoContent', '测试内容选择笔记本');
    await page.click('#memoForm .btn-primary');
    
    // Verify memo created
    await expect(page.locator('.memo-card', { hasText: '测试内容选择笔记本' })).toBeVisible();
  });
});
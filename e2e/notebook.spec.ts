import { test, expect } from '@playwright/test';

test.describe('Notebook Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.notebook-item', { timeout: 10000 });
  });

  test('应该显示笔记本列表', async ({ page }) => {
    await expect(page.locator('.notebook-item').first()).toContainText('全部笔记');
  });

  test('创建笔记本', async ({ page }) => {
    // Click new notebook button
    await page.click('.notebook-new');
    
    // Fill form
    await page.fill('#notebookName', '测试笔记本');
    await page.click('#notebookForm .btn-primary');
    
    // Wait for notebook to appear
    await expect(page.locator('.notebook-item', { hasText: '测试笔记本' })).toBeVisible();
  });

  test('切换笔记本', async ({ page }) => {
    // Click on a notebook
    const notebookItem = page.locator('.notebook-item').nth(1);
    const notebookName = await notebookItem.textContent();
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
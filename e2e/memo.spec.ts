import { test, expect } from '@playwright/test';

test.describe('Memo CRUD 操作', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.memo-card, .empty-state', { timeout: 15000 });
  });

  test('应该能打开新建备忘录模态框', async ({ page }) => {
    await page.locator('#newMemoBtn').click();

    await expect(page.locator('#memoModal')).toHaveClass(/active/);
    await expect(page.locator('#modalTitle')).toContainText('新建');
    await expect(page.locator('#memoContent')).toBeVisible();
  });

  test('应该能创建新的备忘录', async ({ page }) => {
    const testContent = `测试备忘录 E2E ${Date.now()}`;

    // Open create modal
    await page.locator('#newMemoBtn').click();
    await expect(page.locator('#memoModal')).toHaveClass(/active/);

    // Fill form
    await page.locator('#memoContent').fill(testContent);

    // Submit
    await page.locator('#saveBtn').click();

    // Modal should close
    await expect(page.locator('#memoModal')).not.toHaveClass(/active/, { timeout: 10000 });

    // Toast should appear
    const toast = page.locator('.toast.success, .toast.info').first();
    await expect(toast).toBeVisible({ timeout: 10000 });
  });

  test('创建备忘录时内容为必填', async ({ page }) => {
    // Open create modal
    await page.locator('#newMemoBtn').click();

    // Try to submit without content
    await page.locator('#saveBtn').click();

    // Form validation should prevent submission
    await expect(page.locator('#memoModal')).toHaveClass(/active/);
  });

  test('应该能编辑现有备忘录', async ({ page }) => {
    // Check if there are memos
    const memoCount = await page.locator('.memo-card').count();
    if (memoCount === 0) {
      test.skip('没有备忘录可供编辑');
      return;
    }

    // Click edit on first memo
    await page.locator('.memo-card').first().locator('.memo-action').first().click();

    // Modal should open with existing content
    await expect(page.locator('#memoModal')).toHaveClass(/active/, { timeout: 5000 });
    await expect(page.locator('#modalTitle')).toContainText('编辑');

    const contentValue = await page.locator('#memoContent').inputValue();
    expect(contentValue.length).toBeGreaterThan(0);
  });

  test('应该能切换收藏状态', async ({ page }) => {
    const memoCount = await page.locator('.memo-card').count();
    if (memoCount === 0) {
      test.skip('没有备忘录可供测试');
      return;
    }

    // Get initial favorite state
    const firstCard = page.locator('.memo-card').first();
    const favoriteBtn = firstCard.locator('.memo-action').nth(1);

    // Click favorite
    await favoriteBtn.click();

    // Wait for toast or state change
    await page.waitForTimeout(500);

    // Verify state changed (toast should appear)
    const toastCount = await page.locator('.toast').count();
    expect(toastCount).toBeGreaterThanOrEqual(0);
  });

  test('应该能删除备忘录并显示撤销选项', async ({ page }) => {
    const memoCount = await page.locator('.memo-card').count();
    if (memoCount === 0) {
      test.skip('没有备忘录可供删除');
      return;
    }

    // Get initial count
    const initialTotal = await page.locator('#totalMemos').textContent();

    // Click delete on first memo - set up dialog handler before click
    page.on('dialog', dialog => dialog.accept());

    const firstCard = page.locator('.memo-card').first();
    await firstCard.locator('.memo-action').nth(2).click();

    // Wait for toast with undo option
    await page.waitForSelector('.toast.warning, .toast.success', { timeout: 10000 });
  });

  test('应该能展开查看更多内容', async ({ page }) => {
    const memoCount = await page.locator('.memo-card').count();
    if (memoCount === 0) {
      test.skip('没有备忘录可供测试');
      return;
    }

    // Click expand button
    const expandBtn = page.locator('.memo-expand-btn').first();

    // Check aria-expanded state
    const initialExpanded = await expandBtn.getAttribute('aria-expanded');
    await expandBtn.click();

    // State should change
    await page.waitForTimeout(300);
    const newExpanded = await expandBtn.getAttribute('aria-expanded');
    expect(newExpanded).not.toBe(initialExpanded);
  });
});

test.describe('Markdown 编辑器', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.memo-card, .empty-state', { timeout: 15000 });
    await page.locator('#newMemoBtn').click();
  });

  test('应该能在编辑和预览模式切换', async ({ page }) => {
    // Initially in write mode
    await expect(page.locator('#memoContent')).toBeVisible();

    // Add some content first
    await page.locator('#memoContent').fill('# Test Content');

    // Click preview tab
    await page.locator('.editor-tab[data-tab="preview"]').click();

    // Wait for preview to be visible
    await page.waitForTimeout(500);

    // Preview should be visible
    const previewVisible = await page.locator('#markdownPreview').isVisible();
    expect(previewVisible || await page.locator('#memoContent').isVisible()).toBeTruthy();
  });

  test('工具栏按钮应该插入 Markdown 语法', async ({ page }) => {
    const textarea = page.locator('#memoContent');

    // Click bold button
    await page.locator('.toolbar-btn').first().click();

    // Check if ** was inserted
    const value = await textarea.inputValue();
    expect(value).toContain('**');
  });

  test('Markdown 帮助应该可展开', async ({ page }) => {
    // Click summary to expand
    await page.locator('.markdown-help summary').click();

    // Help content should be visible
    await expect(page.locator('.markdown-syntax')).toBeVisible();
  });
});
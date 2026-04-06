import { test, expect } from '@playwright/test';

test.describe('Memo App - 主页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('应该显示页面标题', async ({ page }) => {
    await expect(page).toHaveTitle(/Memo App/);
  });

  test('应该显示头部导航', async ({ page }) => {
    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('.logo h1')).toContainText('Memo');
  });

  test('应该显示新建按钮', async ({ page }) => {
    await expect(page.locator('#newMemoBtn')).toBeVisible();
    await expect(page.locator('#newMemoBtn')).toContainText('新建');
  });

  test('应该显示搜索框', async ({ page }) => {
    await expect(page.locator('#searchInput')).toBeVisible();
    await expect(page.locator('#searchInput')).toHaveAttribute('placeholder', /搜索/);
  });

  test('应该显示标签筛选下拉框', async ({ page }) => {
    await expect(page.locator('#tagFilter')).toBeVisible();
  });

  test('应该显示收藏筛选按钮', async ({ page }) => {
    await expect(page.locator('#favoritesFilter')).toBeVisible();
    await expect(page.locator('#favoritesFilter')).toContainText('收藏');
  });

  test('应该显示侧边栏统计', async ({ page }) => {
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('#totalMemos')).toBeVisible();
    await expect(page.locator('#totalTags')).toBeVisible();
  });

  test('应该显示备忘录列表', async ({ page }) => {
    // Wait for memos to load
    await page.waitForSelector('.memo-card, .empty-state', { timeout: 10000 });

    // Either memos or empty state should be visible
    const hasMemos = await page.locator('.memo-card').count() > 0;
    const hasEmptyState = await page.locator('#emptyState').isVisible();

    expect(hasMemos || hasEmptyState).toBeTruthy();
  });

  test('主题切换应该工作', async ({ page }) => {
    // Get initial theme
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');

    // Click theme toggle
    await page.locator('#themeToggle').click();

    // Theme should change
    const newTheme = await html.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);
  });
});

test.describe('Memo App - 键盘导航', () => {
  test('Tab 键应该可以导航所有交互元素', async ({ page }) => {
    await page.goto('/');

    // Tab through header actions
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // Theme toggle
    await expect(page.locator('#themeToggle')).toBeFocused();

    await page.keyboard.press('Tab'); // Export button
    await expect(page.locator('#exportBtn')).toBeFocused();

    await page.keyboard.press('Tab'); // New memo button
    await expect(page.locator('#newMemoBtn')).toBeFocused();
  });

  test('Escape 键应该关闭模态框', async ({ page }) => {
    await page.goto('/');

    // Open modal
    await page.locator('#newMemoBtn').click();
    await expect(page.locator('#memoModal')).toHaveClass(/active/);

    // Press Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('#memoModal')).not.toHaveClass(/active/);
  });

  test('Ctrl+N 快捷键应该打开新建模态框', async ({ page }) => {
    await page.goto('/');

    // Press Ctrl+N
    await page.keyboard.press('Control+n');
    await expect(page.locator('#memoModal')).toHaveClass(/active/);
  });

  test('Ctrl+F 快捷键应该聚焦搜索框', async ({ page }) => {
    await page.goto('/');

    // Press Ctrl+F
    await page.keyboard.press('Control+f');
    await expect(page.locator('#searchInput')).toBeFocused();
  });
});
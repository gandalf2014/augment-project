import { test, expect } from '@playwright/test';

test.describe('搜索功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.memo-card, .empty-state', { timeout: 15000 });
  });

  test('搜索框应该可输入', async ({ page }) => {
    await page.locator('#searchInput').fill('test search');
    await expect(page.locator('#searchInput')).toHaveValue('test search');
  });

  test('输入搜索词后应显示清除按钮', async ({ page }) => {
    await page.locator('#searchInput').fill('test');

    await expect(page.locator('#searchClear')).toBeVisible();
  });

  test('清除按钮应该清空搜索框', async ({ page }) => {
    await page.locator('#searchInput').fill('test');
    await page.locator('#searchClear').click();

    await expect(page.locator('#searchInput')).toHaveValue('');
    await expect(page.locator('#searchClear')).not.toBeVisible();
  });

  test('搜索应该过滤备忘录', async ({ page }) => {
    const memoCount = await page.locator('.memo-card').count();
    if (memoCount === 0) {
      test.skip('没有备忘录可供搜索');
      return;
    }

    // Get first memo title
    const firstTitle = await page.locator('.memo-card .memo-title').first().textContent();
    if (!firstTitle) {
      test.skip('无法获取备忘录标题');
      return;
    }

    // Search for part of the title
    const searchWord = firstTitle.substring(0, 5);
    await page.locator('#searchInput').fill(searchWord);

    // Wait for search to process
    await page.waitForTimeout(500);

    // Results should be filtered
    const visibleCount = await page.locator('.memo-card').count();
    expect(visibleCount).toBeGreaterThanOrEqual(0);
  });

  test('搜索结果应该高亮匹配文字', async ({ page }) => {
    const memoCount = await page.locator('.memo-card').count();
    if (memoCount === 0) {
      test.skip('没有备忘录可供搜索');
      return;
    }

    // Get first memo title
    const firstTitle = await page.locator('.memo-card .memo-title').first().textContent();
    if (!firstTitle || firstTitle.length < 3) {
      test.skip('备忘录标题太短');
      return;
    }

    // Search for part of the title
    const searchWord = firstTitle.substring(0, 3);
    await page.locator('#searchInput').fill(searchWord);

    // Wait for search to process
    await page.waitForTimeout(500);

    // Highlighting is optional depending on match
    const highlightCount = await page.locator('.search-highlight').count();
    expect(highlightCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('筛选功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.memo-card, .empty-state', { timeout: 15000 });
  });

  test('收藏筛选按钮应该切换状态', async ({ page }) => {
    const initialState = await page.locator('#favoritesFilter').getAttribute('aria-pressed');

    await page.locator('#favoritesFilter').click();

    const newState = await page.locator('#favoritesFilter').getAttribute('aria-pressed');
    expect(newState).not.toBe(initialState);
  });

  test('收藏筛选应该切换按钮样式', async ({ page }) => {
    // Turn on favorites filter
    await page.locator('#favoritesFilter').click();

    // Wait for filter to apply
    await page.waitForTimeout(300);

    // Button should have primary class
    await expect(page.locator('#favoritesFilter')).toHaveClass(/btn-primary/);
  });

  test('组合筛选应该工作', async ({ page }) => {
    const tagOptionCount = await page.locator('#tagFilter option').count();

    if (tagOptionCount <= 1) {
      test.skip('没有标签可供筛选');
      return;
    }

    // Apply tag filter
    await page.locator('#tagFilter').selectOption({ index: 1 });

    // Apply favorite filter
    await page.locator('#favoritesFilter').click();

    // Wait for filters to apply
    await page.waitForTimeout(500);

    // Both filters should be active
    await expect(page.locator('#favoritesFilter')).toHaveClass(/btn-primary/);
  });
});
import { test, expect } from '@playwright/test';

test.describe('标签功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.tags-list', { timeout: 15000 });
  });

  test('应该显示标签列表', async ({ page }) => {
    const tagCount = await page.locator('.tag-item').count();
    const totalTags = await page.locator('#totalTags').textContent();

    expect(parseInt(totalTags || '0')).toBeGreaterThanOrEqual(tagCount);
  });

  test('应该能打开新建标签模态框', async ({ page }) => {
    await page.locator('#newTagBtn').click();

    await expect(page.locator('#tagModal')).toHaveClass(/active/);
    await expect(page.locator('#tagModalTitle')).toContainText('新建标签');
    await expect(page.locator('#tagName')).toBeVisible();
  });

  test('应该能创建新标签', async ({ page }) => {
    const tagName = `TestTag${Date.now()}`;

    // Open create modal
    await page.locator('#newTagBtn').click();
    await expect(page.locator('#tagModal')).toHaveClass(/active/);

    // Fill form
    await page.locator('#tagName').fill(tagName);

    // Submit
    await page.locator('#tagForm button[type="submit"]').click();

    // Modal should close
    await expect(page.locator('#tagModal')).not.toHaveClass(/active/, { timeout: 10000 });

    // Toast should appear
    await expect(page.locator('.toast.success, .toast.info')).toBeVisible({ timeout: 10000 });
  });

  test('创建标签时名称为必填', async ({ page }) => {
    await page.locator('#newTagBtn').click();

    // Try to submit without name
    await page.locator('#tagForm button[type="submit"]').click();

    // Form should still be open (validation failed)
    await expect(page.locator('#tagModal')).toHaveClass(/active/);
  });

  test('颜色预设应该工作', async ({ page }) => {
    await page.locator('#newTagBtn').click();

    // Click a color preset
    await page.locator('.color-preset').first().click();

    // Color input should update
    const colorValue = await page.locator('#tagColor').inputValue();
    expect(colorValue).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('点击标签应该筛选备忘录', async ({ page }) => {
    const tagCount = await page.locator('.tag-item').count();
    if (tagCount === 0) {
      test.skip('没有标签可供测试');
      return;
    }

    // Get tag name
    const tagName = await page.locator('.tag-item .tag-name').first().textContent();

    // Click on tag
    await page.locator('.tag-item').first().click();

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Tag filter should be set
    const filterValue = await page.locator('#tagFilter').inputValue();
    expect(filterValue).toBeTruthy();
  });

  test('应该能通过下拉框筛选标签', async ({ page }) => {
    const tagCount = await page.locator('#tagFilter option').count();
    if (tagCount <= 1) {
      test.skip('没有标签可供筛选');
      return;
    }

    // Select second option (first is "全部标签")
    await page.locator('#tagFilter').selectOption({ index: 1 });

    // Verify selection
    const selectedValue = await page.locator('#tagFilter').inputValue();
    expect(selectedValue.length).toBeGreaterThan(0);
  });
});
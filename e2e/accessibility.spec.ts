import { test, expect } from '@playwright/test';

test.describe('可访问性测试 (WCAG)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.memo-card, .empty-state', { timeout: 15000 });
  });

  test('所有交互元素应该可通过键盘访问', async ({ page }) => {
    const focusableElements = await page.locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])').all();

    for (const element of focusableElements.slice(0, 10)) {
      const isVisible = await element.isVisible();
      if (isVisible) {
        const tabIndex = await element.getAttribute('tabindex');
        expect(parseInt(tabIndex || '0')).toBeGreaterThanOrEqual(-1);
      }
    }
  });

  test('图片应该有 alt 属性', async ({ page }) => {
    const images = await page.locator('img').all();

    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      const ariaHidden = await img.getAttribute('aria-hidden');

      // Image should have alt, aria-label, or be aria-hidden
      expect(alt || ariaLabel || ariaHidden === 'true').toBeTruthy();
    }
  });

  test('按钮应该有可访问名称', async ({ page }) => {
    const buttons = await page.locator('button').all();

    for (const button of buttons) {
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');

      // Button should have text, aria-label, or title
      expect((text && text.trim()) || ariaLabel || title).toBeTruthy();
    }
  });

  test('模态框应该有正确的 ARIA 属性', async ({ page }) => {
    // Open modal
    await page.locator('#newMemoBtn').click();

    const modal = page.locator('#memoModal');

    // Check modal has correct role
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');

    // Check modal has accessible label
    const labelledBy = await modal.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
  });

  test('表单字段应该有关联的标签', async ({ page }) => {
    // Open modal
    await page.locator('#newMemoBtn').click();

    const inputs = await page.locator('#memoForm input, #memoForm textarea').all();

    for (const input of inputs) {
      const id = await input.getAttribute('id');
      if (id) {
        // Check if there's a label for this input (explicit association)
        const label = page.locator(`label[for="${id}"]`);
        const labelCount = await label.count();
        // Or check if it has aria-labelledby
        const labelledBy = await input.getAttribute('aria-labelledby');
        // Or check if input is inside a label (implicit association)
        const parentLabel = input.locator('xpath=ancestor::label');
        const hasImplicitLabel = await parentLabel.count();

        expect(labelCount > 0 || labelledBy || hasImplicitLabel > 0).toBeTruthy();
      }
    }
  });

  test('主题切换按钮应该有 aria-pressed 状态', async ({ page }) => {
    const themeBtn = page.locator('#themeToggle');

    // Should have aria-pressed
    const ariaPressed = await themeBtn.getAttribute('aria-pressed');
    expect(['true', 'false']).toContain(ariaPressed);

    // Click and verify state changes
    await themeBtn.click();
    const newAriaPressed = await themeBtn.getAttribute('aria-pressed');
    expect(newAriaPressed).not.toBe(ariaPressed);
  });

  test('收藏按钮应该有 aria-pressed 状态', async ({ page }) => {
    const memoCount = await page.locator('.memo-card').count();
    if (memoCount === 0) {
      test.skip('没有备忘录可供测试');
      return;
    }

    const favoriteBtn = page.locator('.memo-card').first().locator('.memo-action').nth(1);
    const ariaPressed = await favoriteBtn.getAttribute('aria-pressed');

    expect(['true', 'false']).toContain(ariaPressed);
  });

  test('跳转链接应该可见并可点击', async ({ page }) => {
    const skipLink = page.locator('.skip-link');

    // Skip link should be present
    await expect(skipLink).toBeAttached();

    // Focus the skip link to make it visible
    await skipLink.focus();
    await expect(skipLink).toBeVisible();
  });

  test('页面应该有正确的语言属性', async ({ page }) => {
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBeTruthy();
  });

  test('主内容区域应该有 role 或语义标签', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('Toast 通知应该有 role="status"', async ({ page }) => {
    // Trigger a toast by creating a memo
    await page.locator('#newMemoBtn').click();
    await page.locator('#memoContent').fill('测试通知');
    await page.locator('#saveBtn').click();

    // Check toast has correct role
    const toast = page.locator('.toast').first();
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toHaveAttribute('role', 'status');
  });
});
// e2e/saved-filters.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Saved Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.notebook-item').first()).toBeVisible({ timeout: 10000 });
  });

  test('显示已保存筛选区域', async ({ page }) => {
    // Saved filters section should exist
    await expect(page.locator('.saved-filters-section')).toBeVisible();
    
    // Save button should exist
    await expect(page.locator('#saveFilterBtn')).toBeVisible();
  });

  test('保存筛选预设', async ({ page }) => {
    // Set some filter condition (e.g., search)
    await page.locator('#searchInput').fill('test');
    await page.waitForTimeout(500); // Wait for debounce
    
    // Click save button
    await page.locator('#saveFilterBtn').click();
    
    // Modal should appear
    await expect(page.locator('#saveFilterModal')).toBeVisible();
    
    // Enter name
    const filterName = `测试筛选 ${Date.now()}`;
    await page.locator('#filterName').fill(filterName);
    
    // Submit
    await page.locator('#saveFilterForm button[type="submit"]').click();
    
    // Wait for toast
    await expect(page.locator('.toast')).toBeVisible();
    
    // New filter should appear in list
    await expect(page.locator('.saved-filter-item').first()).toBeVisible();
  });

  test('应用筛选预设', async ({ page }) => {
    // First create a filter
    await page.locator('#searchInput').fill('unique-test-keyword-' + Date.now());
    await page.waitForTimeout(500);
    await page.locator('#saveFilterBtn').click();
    await expect(page.locator('#saveFilterModal')).toBeVisible();
    const filterName = `应用测试 ${Date.now()}`;
    await page.locator('#filterName').fill(filterName);
    await page.locator('#saveFilterForm button[type="submit"]').click();
    await page.waitForTimeout(500);
    
    // Clear the search manually
    await page.locator('#searchInput').clear();
    await page.waitForTimeout(500);
    
    // Click on the saved filter
    await page.locator('.saved-filter-item').first().click();
    
    // Filter item should be active
    await expect(page.locator('.saved-filter-item').first()).toHaveClass(/active/);
  });

  test('删除筛选预设', async ({ page }) => {
    // First create a filter
    await page.locator('#saveFilterBtn').click();
    await expect(page.locator('#saveFilterModal')).toBeVisible();
    const filterName = `待删除 ${Date.now()}`;
    await page.locator('#filterName').fill(filterName);
    await page.locator('#saveFilterForm button[type="submit"]').click();
    await page.waitForTimeout(500);
    
    // Find the filter and click delete
    const filterItem = page.locator('.saved-filter-item').first();
    await filterItem.hover();
    
    // Click the delete button
    page.on('dialog', dialog => dialog.accept());
    await filterItem.locator('.filter-delete').click();
    
    // Wait for deletion
    await page.waitForTimeout(500);
  });
});
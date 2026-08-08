// 拼音学习项目 - 冒烟测试（Playwright）
// 运行: node tests/smoke.js  （需本地服务器 http://localhost:8765）
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:8765';
let failures = 0;

function check(name, cond, detail) {
  console.log((cond ? '✅' : '❌') + ' ' + name + (cond ? '' : ' | ' + (detail || '')));
  if (!cond) failures++;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  // ===== 1. 汉字消消乐 =====
  console.log('\n=== 汉字消消乐 ===');
  await page.goto(BASE + '/hanzi-xiaoxiaole.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const cellCount = await page.locator('.cell').count();
  check('网格渲染 16 格', cellCount === 16, 'cells=' + cellCount);

  // 翻卡显示拼音 + 组词
  const firstCell = page.locator('.cell').first();
  await firstCell.click();
  await page.waitForTimeout(900);
  const backPinyin = await firstCell.locator('.back-pinyin').textContent();
  const backWord = await firstCell.locator('.back-word').textContent();
  check('翻卡显示拼音', !!backPinyin, backPinyin);
  check('翻卡显示组词', !!backWord, backWord);

  // 取消刚才的选中状态（避免配对时触发取消逻辑）
  await firstCell.click();
  await page.waitForTimeout(400);

  // 配对成功
  const hanzi = await firstCell.locator('.cell-front').textContent();
  const sameLoc = page.locator('.cell').filter({ has: page.locator('.cell-front', { hasText: hanzi }) });
  const sameCount = await sameLoc.count();
  await sameLoc.nth(0).click();
  await page.waitForTimeout(200);
  await sameLoc.nth(1).click();
  await page.waitForTimeout(2600);
  const hidden = await page.locator('.cell').evaluateAll(cs => cs.filter(c => c.style.visibility === 'hidden').length);
  check('配对成功消除', hidden >= 2 && sameCount >= 2, 'hidden=' + hidden + ' same=' + sameCount);

  // ===== 2. 拼音连连看 =====
  console.log('\n=== 拼音连连看 ===');
  await page.goto(BASE + '/pinyin-%E8%BF%9E%E8%BF%9E%E7%9C%8B.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.locator('button:has-text("开始游戏")').click().catch(() => {});
  await page.waitForTimeout(300);
  const llkCards = await page.locator('.card').count();
  check('16 张配对卡', llkCards === 16, 'cards=' + llkCards);

  // 键盘翻卡（无障碍）
  await page.locator('.card').first().focus();
  await page.keyboard.press(' ');
  await page.waitForTimeout(700);
  const flipped = await page.locator('.card').first().evaluate(c => c.classList.contains('flipped'));
  check('键盘空格翻卡', flipped);

  // ===== 3. 拼音学习 =====
  console.log('\n=== 拼音学习 ===');
  await page.goto(BASE + '/pinyin-game.html', { waitUntil: 'networkidle' });
  const pyShengmu = await page.locator('#shengmu .card').count();
  const pyYunmu = await page.locator('#yunmu .card').count();
  check('23 张声母卡', pyShengmu === 23, 'cards=' + pyShengmu);
  check('24 张韵母卡', pyYunmu === 24, 'cards=' + pyYunmu);

  // ===== 4. 索引页 =====
  console.log('\n=== 索引页 ===');
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  const links = await page.locator('.game-card').count();
  check('3 个游戏入口', links === 3, 'links=' + links);

  // ===== 5. 全局 JS 错误 =====
  check('无 JS 错误 / 资源 404', errors.length === 0, errors.slice(0, 3).join(' ; '));

  await browser.close();
  console.log('\n' + (failures === 0 ? '🎉 冒烟测试全部通过' : `❌ ${failures} 项失败`));
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => {
  console.error('测试执行异常:', e.message);
  process.exit(1);
});

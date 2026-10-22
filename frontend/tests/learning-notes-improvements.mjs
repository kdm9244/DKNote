// Browser regressions with in-memory API responses; never writes user data.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.LEARNING_UI_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
const page = await context.newPage();
page.setDefaultTimeout(10000);
await context.addInitScript(() => sessionStorage.setItem('accessToken', 'ui-test'));
const stamp = '2026-10-22T12:00:00';
const entry = e => ({ body: '', format: 'plain', startDate: '2026-10-22', endDate: '2026-12-31', details: {}, position: 0, version: 0, createdAt: stamp, updatedAt: stamp, ...e });
const richBody = '<p>선택한 핵심 개념</p><p>  첫  줄<br>다음 줄</p><p></p><p>    들여쓰기</p><pre><code>  const a = 1;\n\n  return a;\n</code></pre><table><tbody><tr><th><p>항목</p></th><td><p>두  칸</p></td></tr></tbody></table><p>마지막 줄<br></p>';
const entries = [
  entry({ id: 'r1', kind: 'ROADMAP', title: '웹 개발' }),
  entry({ id: 'r2', kind: 'ROADMAP', title: '외국어' }),
  entry({ id: 'm1', kind: 'MILESTONE', title: '기초', parentId: 'r1' }),
  entry({ id: 'm2', kind: 'MILESTONE', title: '기초', parentId: 'r2' }),
  entry({ id: 't1', kind: 'TASK', title: '복습', parentId: 'm1' }),
  entry({ id: 't2', kind: 'TASK', title: '복습', parentId: 'm2' }),
  ...Array.from({ length: 60 }, (_, i) => entry({ id: `goal${i}`, kind: 'TASK', title: `분류 항목 ${i}`, parentId: 'm1' })),
  entry({ id: 'note', kind: 'RECORD', title: '공백 보존 노트', body: richBody, format: 'richtext', parentId: 't1' }),
  entry({ id: 'md', kind: 'RECORD', title: 'Markdown 노트', body: '첫  줄\n다음 줄\n\n새 문단', format: 'markdown', parentId: 'm2' }),
  entry({ id: 'plain', kind: 'RECORD', title: '일반 노트', body: '  첫  줄\n다음 줄\n\n    끝', format: 'plain' }),
  ...Array.from({ length: 13 }, (_, i) => entry({ id: `n${i}`, kind: 'RECORD', title: `개발 메모 ${i}`, body: '<p>메모</p>', format: 'richtext', parentId: 'r1' })),
];
const errors = [], unexpected = [], writes = [];
page.on('pageerror', e => errors.push(e.message));
await context.route('**/api/**', async route => {
  const req = route.request(), path = new URL(req.url()).pathname;
  if (!path.startsWith('/api/')) return route.continue();
  if (path === '/api/users/myProfile') return route.fulfill({ json: { userId: 'ui-test', role: 'USER' } });
  if (path === '/api/workspace/settings') return route.fulfill({ json: {} });
  if (path === '/api/workspace/entries') return route.fulfill({ json: entries });
  if (path.startsWith('/api/workspace/entries/') && ['POST','PUT'].includes(req.method())) {
    const body = req.postDataJSON();
    const saved = entry({ ...body, id: body.id || `new${writes.length}`, version: (body.version || 0) + 1 });
    writes.push(saved);
    const i = entries.findIndex(e => e.id === saved.id);
    if (i < 0) entries.push(saved); else entries[i] = saved;
    return route.fulfill({ json: saved });
  }
  unexpected.push(`${req.method()} ${path}`);
  return route.fulfill({ status: 501, json: {} });
});
const visit = path => page.goto(base + path);
const editor = () => page.getByRole('textbox', { name: '학습 내용', exact: true });
const save = async () => { await page.getByRole('button', { name: '저장', exact: true }).click(); await page.locator('.learning-entry-composer').waitFor({ state: 'hidden' }); };
const overflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page must fit viewport');
await mkdir('../.local/learning-notes-qa', { recursive: true });
try {
  // Direct navigation must load document styles without visiting the editor first.
  await visit('/learning/records/note');
  await page.locator('.rich-view').waitFor();
  assert.equal(await page.locator('.rich-view').evaluate(e => getComputedStyle(e).whiteSpace), 'pre-wrap');
  assert.ok(await page.locator('.rich-view p:empty').evaluate(e => e.getBoundingClientRect().height > 20), 'empty paragraphs remain visible');
  assert.match(await page.locator('.rich-view').textContent(), /  첫  줄/);
  assert.equal(await page.locator('.learning-code-lines>div').count(), 4, 'keep the final empty line in rich code');
  assert.ok(await page.locator('.rich-view p').filter({ hasText: '마지막 줄' }).evaluate(e => e.getBoundingClientRect().height >= parseFloat(getComputedStyle(e).lineHeight) * 2 - 1), 'keep a final hard break visible');
  assert.equal(await page.getByRole('navigation', { name: '노트 연결 경로' }).getByRole('link').count(), 3);
  assert.equal(await page.locator('.record-comments>details').getAttribute('open'), null);
  await page.locator('.learning-code-lines').getByRole('button', { name: '1', exact: true }).click();
  assert.notEqual(await page.locator('.record-comments>details').getAttribute('open'), null);

  await visit('/learning/records/note/edit');
  await editor().waitFor();
  assert.match(await editor().textContent(), /  첫  줄/);
  assert.match(await editor().textContent(), /    들여쓰기/);
  const toolbar = page.getByRole('toolbar', { name: '글쓰기 서식', exact: true });
  // Drag across actual text and apply several marks without losing the selection.
  const drag = await editor().locator('p').first().evaluate(p => {
    const range = document.createRange(); range.selectNodeContents(p);
    const box = range.getBoundingClientRect();
    return { x: box.x + 1, y: box.y + box.height / 2, end: box.right - 1 };
  });
  await page.mouse.move(drag.x, drag.y); await page.mouse.down(); await page.mouse.move(drag.end, drag.y, { steps: 12 }); await page.mouse.up();
  const bubble = page.getByRole('toolbar', { name: '선택한 글자 서식', exact: true });
  await bubble.waitFor({ state: 'visible' });
  await bubble.getByLabel('글자 색', { exact: true }).selectOption('#315cbb');
  await bubble.getByLabel('형광펜', { exact: true }).selectOption('#fff2a8');
  await bubble.getByRole('button', { name: '굵게', exact: true }).click();
  assert.ok(await editor().locator('mark strong, strong mark').count());
  assert.match(await editor().locator('p').first().innerHTML(), /color:/);
  assert.equal(await toolbar.getByLabel('형광펜', { exact: true }).inputValue(), '#fff2a8');
  await editor().press('ArrowRight');
  await bubble.waitFor({ state: 'hidden' });
  await page.screenshot({ path: '../.local/learning-notes-qa/editor-desktop.png', fullPage: true });
  await save();
  await page.reload(); await page.locator('.rich-view').waitFor();
  assert.match(await page.locator('.rich-view').textContent(), /  첫  줄/);
  assert.match(await page.locator('.rich-view').textContent(), /    들여쓰기/);
  assert.ok(await page.locator('.rich-view mark strong, .rich-view strong mark').count());
  assert.match(entries.find(e => e.id === 'note').body, /<br>/);
  assert.match(entries.find(e => e.id === 'note').body, /<p><\/p>/);
  await visit('/learning/records/note/edit');
  await editor().waitFor(); assert.match(await editor().textContent(), /  첫  줄/);
  await editor().locator('strong').first().click();
  assert.equal(await toolbar.getByLabel('글자 색', { exact: true }).inputValue(), '#315cbb');

  // Same-titled descendants must be distinguishable and all levels can be destinations.
  const picker = page.locator('.learning-goal-picker');
  const openGoalPicker = () => page.locator('.learning-note-goal-details>summary').click();
  await openGoalPicker();
  await picker.getByRole('searchbox').fill('분류 항목');
  assert.equal(await picker.getByRole('listitem').count(), 40);
  assert.match(await picker.getByRole('status').textContent(), /60개/);
  await picker.getByRole('searchbox').fill('분류 항목 59');
  assert.equal(await picker.getByRole('listitem').count(), 1);
  await picker.getByRole('searchbox').fill('복습');
  assert.equal(await picker.getByRole('listitem').count(), 2);
  await picker.getByRole('button').filter({ hasText: '외국어 / 기초' }).click();
  assert.equal(await picker.getByLabel('연결할 목표 학습 할 일').inputValue(), 't2');
  await picker.getByLabel('연결할 목표 로드맵').selectOption('r1');
  assert.equal(await picker.getByLabel('연결할 목표 세부 목표').inputValue(), '');
  await save(); assert.equal(writes.at(-1).parentId, 'r1');
  await visit('/learning/records/note/edit');
  await openGoalPicker();
  await picker.getByLabel('연결할 목표 세부 목표').selectOption('m1');
  await save(); assert.equal(writes.at(-1).parentId, 'm1');
  await visit('/learning/records/note/edit'); await openGoalPicker(); await picker.getByRole('button', { name: '독립 노트', exact: true }).click();
  await save(); assert.equal(writes.at(-1).parentId, null);

  await visit('/learning/records/md'); await page.locator('.learning-markdown').waitFor();
  assert.match(await page.locator('.learning-markdown p').first().textContent(), /첫  줄\n다음 줄/);
  assert.equal(await page.locator('.learning-markdown p').first().evaluate(e => getComputedStyle(e).whiteSpace), 'pre-wrap');
  await visit('/learning/records/md/edit'); await page.getByRole('button', { name: '문서 편집', exact: true }).click();
  assert.equal(await editor().locator('p').first().locator('br').count(), 1);
  assert.match(await editor().textContent(), /첫  줄/); await save();
  await visit('/learning/records/plain'); await page.locator('.learning-plain').waitFor();
  assert.equal(await page.locator('.learning-plain').textContent(), '  첫  줄\n다음 줄\n\n    끝');
  await visit('/learning/records/plain/edit'); await editor().waitFor();
  assert.match(await editor().textContent(), /  첫  줄/);
  await editor().press('Control+End'); await editor().press('End'); await page.keyboard.type('!'); await save();
  assert.equal(writes.at(-1).format, 'richtext'); assert.match(writes.at(-1).body, /    끝!/);

  await visit('/learning/records'); const library = page.getByRole('region', { name: '학습 자료 목록' });
  // Sections have accessible region names via aria-label on <section>.
  await library.waitFor(); await overflow();
  assert.equal(await library.locator('.record-list-item').count(), 10);
  await library.getByRole('button', { name: '다음', exact: true }).click();
  await library.getByRole('searchbox', { name: '노트 검색' }).fill('Markdown');
  assert.equal(await library.locator('.record-list-item').count(), 1);
  assert.equal(await library.locator('.ws-pagination').count(), 0);
  await library.getByRole('searchbox', { name: '노트 검색' }).fill('');
  await library.getByText('분류·상세 필터', { exact: false }).click();
  await library.getByLabel('자료 분류 로드맵').selectOption('r2');
  assert.equal(await library.locator('.record-list-item').count(), 1);
  await library.getByRole('checkbox', { name: '독립 자료만' }).check();
  assert.equal(await library.locator('.record-list-item').count(), 2);
  await library.getByRole('button', { name: '필터 초기화', exact: true }).click();
  await page.screenshot({ path: '../.local/learning-notes-qa/library-desktop.png', fullPage: true });
  await visit('/learning/roadmaps/r1');
  await page.locator('.learning-materials[open] .record-list-item').first().waitFor();
  assert.equal(await page.locator('.learning-materials .record-list-item').count(), 10);
  // Exercise actual input, including hard breaks and an intentionally empty paragraph.
  await visit('/learning/records/new');
  await page.getByLabel('제목', { exact: true }).fill('줄바꿈 입력 검증');
  await editor().click();
  await page.keyboard.type('첫  줄'); await editor().press('Shift+Enter');
  await page.keyboard.type('다음 줄'); await editor().press('Enter'); await editor().press('Enter');
  await page.keyboard.type('    끝');
  await page.getByRole('button', { name: '미리보기', exact: true }).click();
  assert.match(await page.locator('.record-preview .rich-view').textContent(), /첫  줄/);
  assert.equal(await page.locator('.record-preview .rich-view br').count(), 1);
  assert.ok(await page.locator('.record-preview .rich-view p:empty').count());
  await save(); const typedId = writes.at(-1).id;
  await page.reload(); await page.locator('.rich-view').waitFor();
  assert.match(await page.locator('.rich-view').textContent(), /    끝/);
  await visit(`/learning/records/${typedId}/edit`); await editor().waitFor();
  assert.match(await editor().textContent(), /첫  줄/);
  assert.match(await editor().textContent(), /    끝/);
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ['/learning/records', '/learning/records/note/edit', '/learning/records/note']) {
      await visit(path); await page.locator('.workspace-main').waitFor(); await overflow();
      if (path.endsWith('edit')) {
        await editor().waitFor(); await overflow();
        assert.equal(await picker.getByLabel('연결할 목표 세부 목표').isDisabled(), true);
      }
      if (width === 390) await page.screenshot({ path: `../.local/learning-notes-qa/mobile-${path.endsWith('edit') ? 'editor' : path.endsWith('note') ? 'detail' : 'library'}.png`, fullPage: true });
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  console.log('PASS: whitespace and empty paragraphs across direct view/save/reload/edit, Markdown/plain conversion, drag formatting, same-title hierarchy search, optional destinations, independent notes, filtered pagination, embedded library, desktop/mobile; all APIs mocked.');
} catch (error) {
  console.error({ url: page.url(), errors, unexpected });
  await page.screenshot({ path: '../.local/learning-notes-qa/failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); }

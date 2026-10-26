import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.LEARNING_UI_URL || 'http://127.0.0.1:4175';
const browser = await chromium.launch({channel:'chrome', headless:true});
const page = await browser.newPage();
try {
  await page.route(`${base}/__qa__`, route=>route.fulfill({contentType:'text/html', body:'<!doctype html><html><body></body></html>'}));
  await page.goto(`${base}/__qa__`);
  const cases = await page.evaluate(async () => {
    const {toMarkdown} = await import('/src/services/markdownConversion.js');
    const {editorHtml} = await import('/src/services/richText.js');
    const fixtures = [
      ['indented text', '<p>    일반 문장</p>'],
      ['empty paragraph', '<p>첫 문단</p><p></p><p>다음 문단</p>'],
      ['final hard break', '<p>문장<br></p>'],
      ['inline emphasis spacing', '<p><strong> 강조 </strong></p>'],
      ['inline code newline', '<p><code>first\nsecond</code></p>'],
      ['consecutive blank paragraphs', '<p></p><p></p>'],
    ];
    return fixtures.map(([name, html]) => {
      try { const markdown=toMarkdown(html); return {name, blocked:false, markdown, html:editorHtml(markdown,'markdown')}; }
      catch (error) { return {name, blocked:true, message:error.message}; }
    });
  });
  for (const result of cases) {
    assert.equal(result.blocked,true,`${result.name} must be protected from lossy conversion: ${JSON.stringify(result)}`);
    assert.match(result.message,/Markdown으로 돌아가실 수 없습니다/);
  }
  const supported = await page.evaluate(async () => {
    const {toMarkdown} = await import('/src/services/markdownConversion.js');
    toMarkdown('<h2>개념</h2><p>내용 <strong>강조</strong></p><pre><code>const a = 1;</code></pre><p></p>');
    return toMarkdown('<h2>제목</h2><p>내용 <strong>강조</strong><br>다음 줄</p><ul><li><p>첫째</p><ul><li><p>하위</p></li></ul></li><li><p>둘째</p></li></ul><blockquote><p>인용</p></blockquote><pre><code>const a = `value`;\n</code></pre>');
  });
  assert.match(supported,/## 제목/); assert.match(supported,/\*\*강조\*\*/); assert.match(supported,/const a/);
  console.log('PASS: lossy indentation, blank paragraph, final break, emphasis and inline-code conversions blocked; headings, nested lists, quotes and fenced code supported.');
} finally {await browser.close();}

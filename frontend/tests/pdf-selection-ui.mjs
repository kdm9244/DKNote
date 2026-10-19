// Focused view-mode tests: all API requests are intercepted; no real DB/file writes.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4174'],{stdio:'ignore'});
process.on('exit',()=>server.kill());
await new Promise(resolve=>setTimeout(resolve,1500));
import assert from 'node:assert/strict';
const base=process.env.PDF_UI_URL || 'http://127.0.0.1:4174';
const japanese=[...'日本語の学習'].map(c=>c.charCodeAt(0).toString(16).padStart(4,'0')).join('');
const streams=Array.from({length:3},(_,i)=>i===2?'':`BT /F1 24 Tf 60 660 Td (PDF view test - Page ${i+1}) Tj ET\nBT /F2 24 Tf 60 610 Td <${japanese}> Tj ET\n`);
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>',
  ...streams.map((_,i)=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 780] /Resources << /Font << /F1 6 0 R /F2 10 0 R >> >> /Contents ${7+i} 0 R >>`),
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',...streams.map(s=>`<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}endstream`),
  '<< /Type /Font /Subtype /Type0 /BaseFont /HeiseiMin-W3 /Encoding /UniJIS-UCS2-H /DescendantFonts [11 0 R] >>',
  '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiMin-W3 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 6 >> /FontDescriptor 12 0 R /DW 1000 >>',
  '<< /Type /FontDescriptor /FontName /HeiseiMin-W3 /Flags 6 /FontBBox [-123 -257 1001 910] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>'];
let file='%PDF-1.4\n';const offsets=[];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(file));file+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(file);
file+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const pdf={id:'pdf',kind:'PDF',title:'PDF 보기 검증',details:{fileName:'test.pdf',pages:{'1':{body:'<p>첫 페이지 필기</p>',format:'richtext'},'2':{body:'<p>두 번째 필기</p>',format:'richtext'}}},version:0,position:0,createdAt:'2026-10-11'};
const settings={pdfNoteRatio:55,pdfWordRatio:40},errors=[],unexpected=[],noteWrites=[];
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();page.setDefaultTimeout(10000);
await context.addInitScript(()=>{if(window.top===window)sessionStorage.setItem('accessToken','ui-only');});page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack)});
await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;if(!path.startsWith('/api/'))return route.continue();
  if(path==='/api/users/myProfile')return route.fulfill({json:{userId:'ui-only',email:'ui@example.com'}});
  if(path==='/api/workspace/entries')return route.fulfill({json:[pdf]});
  if(path==='/api/workspace/settings'){if(req.method()==='PATCH')Object.assign(settings,req.postDataJSON());return route.fulfill({json:settings});}
  if(path==='/api/workspace/pdf/pdf/file'){return route.fulfill({contentType:'application/pdf',body:file});}
  const note=path.match(/^\/api\/workspace\/pdf\/pdf\/pages\/(\d+)$/);
  if(note){const body=req.postDataJSON();noteWrites.push(body);pdf.details.pages[note[1]]={body:body.body,format:body.format};pdf.version++;return route.fulfill({json:pdf});}
  unexpected.push(path);return route.fulfill({status:501,json:{message:'Unmocked request'}});
});
try {
 await mkdir('../.local/compact-qa',{recursive:true});
 await page.goto(`${base}/learning/pdf/pdf`);
 await page.locator('iframe[title="PDF 보기 검증 원본 PDF"]').waitFor();
 assert.equal(await page.getByRole('button',{name:'원본 보기',exact:true}).getAttribute('aria-pressed'),'true');
 const compactBar=async()=>{const bar=page.locator('.pdf-reader-toolbar');const box=await bar.boundingBox();assert.ok(box.height<=47,'PDF toolbar should occupy one row');assert.equal(await page.locator('.pdf-reader-hint').count(),0);const view=await page.locator('.pdf-original-reader iframe,.pdf-reader-viewport').boundingBox();assert.ok(view.y-(box.y+box.height)<=10,'PDF should start directly below the toolbar');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));};
 await compactBar();await page.waitForTimeout(600);await page.screenshot({path:'../.local/compact-qa/pdf-original.png',fullPage:true});
 for(const width of [360,390,768]){await page.setViewportSize({width,height:844});await compactBar();}
 await page.setViewportSize({width:1366,height:768});
 await page.getByRole('button',{name:'학습 보기',exact:true}).click();
 const layer=page.locator('.pdf-reader-text-layer');
 await layer.getByText('PDF view test - Page 1',{exact:true}).waitFor();
 assert.notEqual(await page.locator('.pdf-note-heading').evaluate(e=>getComputedStyle(e).position),'sticky');
 const toolsBox=await page.locator('.rich-toolbar').boundingBox(),noteBox=await page.locator('.rich-editor .tiptap').boundingBox();assert.ok(toolsBox.y+toolsBox.height<=noteBox.y,'tools must not overlap the note');
 const select=async()=>{
  const span=layer.locator('span').filter({hasText:'PDF view test'}).first();
  const box=await span.boundingBox();
  assert.ok(box.width>100 && box.height>5);
  await page.mouse.move(box.x+1,box.y+box.height/2);
  await page.mouse.down(); await page.mouse.move(box.x+box.width-1,box.y+box.height/2,{steps:20}); await page.mouse.up();
  assert.match(await page.evaluate(()=>getSelection().toString()),/PDF view test/);
 };
 await select();
 const jp=layer.locator('span').filter({hasText:'日本語の学習'}).first();await jp.waitFor();const jb=await jp.boundingBox();assert.ok(jb.width>20);await page.mouse.move(jb.x+1,jb.y+jb.height/2);await page.mouse.down();await page.mouse.move(jb.x+jb.width-1,jb.y+jb.height/2,{steps:20});await page.mouse.up();assert.match(await page.evaluate(()=>getSelection().toString()),/日本語/);
 await compactBar();await page.screenshot({path:'../.local/compact-qa/pdf-study.png',fullPage:true});
 await page.getByRole('button',{name:'PDF 확대',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.pdf-reader-surface')?.style.getPropertyValue('--total-scale-factor')>1);
 await layer.getByText('PDF view test - Page 1',{exact:true}).waitFor(); await select();
 await page.getByRole('button',{name:'다음 페이지',exact:true}).click();
 await layer.getByText('PDF view test - Page 2',{exact:true}).waitFor(); await select();
 await page.getByRole('button',{name:'화면 이동',exact:true}).click();assert.ok(await page.locator('.pdf-reader-viewport').evaluate(e=>getComputedStyle(e).touchAction==='none'));
 await page.getByRole('button',{name:'글자 선택',exact:true}).click();await select();assert.notEqual(await page.locator('.pdf-reader-viewport').evaluate(e=>getComputedStyle(e).touchAction),'none');
 await page.getByRole('button',{name:'원본 보기',exact:true}).click();assert.match(await page.locator('iframe[title="PDF 보기 검증 원본 PDF"]').getAttribute('src'),/#page=2$/);
 assert.equal(await page.getByLabel('원본 보기 필기 페이지').inputValue(),'2');assert.match(await page.getByRole('textbox',{name:'페이지 필기',exact:true}).innerText(),/두 번째 필기/);
 await page.getByRole('button',{name:'학습 보기',exact:true}).click();await layer.getByText('PDF view test - Page 2',{exact:true}).waitFor();await select();
 await page.reload();assert.equal(await page.getByRole('button',{name:'학습 보기',exact:true}).getAttribute('aria-pressed'),'true');await layer.getByText('PDF view test - Page 1',{exact:true}).waitFor();
 await page.getByLabel('PDF 페이지 번호',{exact:true}).fill('3');await page.getByLabel('PDF 페이지 번호',{exact:true}).press('Enter');await page.getByRole('status').filter({hasText:'텍스트 없음'}).waitFor();
 await page.getByLabel('PDF 페이지 번호',{exact:true}).fill('1');await page.getByLabel('PDF 페이지 번호',{exact:true}).press('Enter');
 await page.setViewportSize({width:390,height:844});await page.reload();
 await layer.getByText('PDF view test - Page 1',{exact:true}).waitFor();await compactBar();
 await page.getByRole('button',{name:'너비 맞춤',exact:true}).click();await layer.getByText('PDF view test - Page 1',{exact:true}).waitFor();await page.getByRole('button',{name:'학습 보기',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'../.local/compact-qa/pdf-study-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]); assert.deepEqual(unexpected,[]);assert.deepEqual(noteWrites,[],'opening or switching view must not save unchanged notes');
 console.log('PASS: native/study view switching, page notes retained, mode remembered, English/Japanese mouse selection with bundled CMap, blank page guidance, zoom, page change, selection/pan separation, mobile text layer and no horizontal overflow');
} finally {await browser.close(); server.kill();}

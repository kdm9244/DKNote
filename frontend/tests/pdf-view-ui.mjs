// Focused view-mode tests: all API requests are intercepted; no real DB/file writes.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.PDF_UI_URL || 'http://127.0.0.1:4173';
const streams=Array.from({length:3},(_,i)=>`BT /F1 24 Tf 60 660 Td (PDF view test - Page ${i+1}) Tj ET\n`);
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>',
  ...streams.map((_,i)=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 780] /Resources << /Font << /F1 6 0 R >> >> /Contents ${7+i} 0 R >>`),
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',...streams.map(s=>`<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}endstream`)];
let file='%PDF-1.4\n';const offsets=[];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(file));file+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(file);
file+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const pdf={id:'pdf',kind:'PDF',title:'PDF 보기 검증',details:{fileName:'test.pdf',pages:{'1':{body:'<p>첫 페이지 필기</p>',format:'richtext'},'2':{body:'<p>두 번째 필기</p>',format:'richtext'}}},version:0,position:0,createdAt:'2026-10-11'};
const settings={pdfNoteRatio:55,pdfWordRatio:40},errors=[],unexpected=[];let downloads=0;
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();page.setDefaultTimeout(10000);
await context.addInitScript(()=>{if(window.top===window)sessionStorage.setItem('accessToken','ui-only');});page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;if(!path.startsWith('/api/'))return route.continue();
  if(path==='/api/users/myProfile')return route.fulfill({json:{userId:'ui-only',email:'ui@example.com'}});
  if(path==='/api/workspace/entries')return route.fulfill({json:[pdf]});
  if(path==='/api/workspace/settings'){if(req.method()==='PATCH')Object.assign(settings,req.postDataJSON());return route.fulfill({json:settings});}
  if(path==='/api/workspace/pdf/pdf/file'){downloads++;return route.fulfill({contentType:'application/pdf',body:file});}
  const note=path.match(/^\/api\/workspace\/pdf\/pdf\/pages\/(\d+)$/);
  if(note){const body=req.postDataJSON();pdf.details.pages[note[1]]={body:body.body,format:body.format};pdf.version++;return route.fulfill({json:pdf});}
  unexpected.push(path);return route.fulfill({status:501,json:{message:'Unmocked request'}});
});
const doc=()=>page.locator('.pdf-document'),pane=()=>page.locator('.pdf-notes-pane'),separator=()=>page.getByRole('separator',{name:'PDF와 필기 너비 조절'});
const togglePdf=()=>page.getByRole('button',{name:'PDF 넓게 보기',exact:true}).click();
const split=()=>page.getByRole('button',{name:'분할 화면으로',exact:true}).click();
const overflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
try{
  await page.goto(`${base}/learning/pdf/pdf`);await page.getByRole('textbox',{name:'페이지 필기',exact:true}).waitFor();await doc().locator('iframe').waitFor();
  await separator().focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.getByText('비율 저장됨',{exact:true}).waitFor();assert.equal(settings.pdfNoteRatio,59);
  const width=(await doc().boundingBox()).width,initialDownloads=downloads;await doc().locator('iframe').evaluate(e=>e.dataset.uiIdentity='retained');
  const saved=page.waitForResponse(r=>r.url().endsWith('/pages/1')&&r.request().method()==='PUT');await page.getByRole('textbox',{name:'페이지 필기',exact:true}).fill('넓게 보기 전 작성한 필기');await togglePdf();assert.equal(await pane().isVisible(),false);assert.equal(await separator().isVisible(),false);assert.ok((await doc().boundingBox()).width>width+100);assert.ok((await saved).ok());
  await overflow();assert.equal(await doc().locator('iframe').getAttribute('data-ui-identity'),'retained');await split();assert.equal(await separator().getAttribute('aria-valuenow'),'59');assert.ok((await page.getByRole('textbox',{name:'페이지 필기',exact:true}).innerText()).includes('넓게 보기 전 작성한 필기'));
  await page.getByRole('button',{name:'필기 넓게 보기',exact:true}).click();assert.equal(await doc().isVisible(),false);await togglePdf();assert.equal(await doc().isVisible(),true);assert.equal(await pane().isVisible(),false);await page.getByRole('button',{name:'필기 넓게 보기',exact:true}).click();assert.equal(await doc().isVisible(),false);assert.equal(await pane().isVisible(),true);await page.getByRole('button',{name:'PDF와 함께 보기',exact:true}).click();assert.equal(await doc().locator('iframe').getAttribute('data-ui-identity'),'retained');assert.equal(downloads,initialDownloads);
  await togglePdf();await page.getByRole('button',{name:'다음 페이지',exact:true}).click();assert.equal(await page.getByLabel('페이지',{exact:true}).inputValue(),'2');await split();assert.ok((await page.getByRole('textbox',{name:'페이지 필기',exact:true}).innerText()).includes('두 번째 필기'));
  await page.getByRole('button',{name:'단어 (0)',exact:true}).click();await page.getByLabel('여러 단어 붙여넣기',{exact:true}).fill('旅行\tりょこう\t여행');assert.equal(await separator().getAttribute('aria-valuenow'),'40');await togglePdf();await split();assert.equal(await page.getByLabel('여러 단어 붙여넣기',{exact:true}).inputValue(),'旅行\tりょこう\t여행');assert.equal(await separator().getAttribute('aria-valuenow'),'40');await page.getByRole('button',{name:'단어 넓게 보기',exact:true}).click();assert.equal(await doc().isVisible(),false);await page.getByRole('button',{name:'PDF와 함께 보기',exact:true}).click();
  for(const size of [{width:1280,height:640},{width:390,height:844}]){await page.setViewportSize(size);await togglePdf();assert.equal(await pane().isVisible(),false);await overflow();const box=await doc().boundingBox();assert.ok(box.width>size.width-350);await split();assert.equal(await pane().isVisible(),true);await overflow();}
  if(process.env.PDF_UI_SCREENSHOT){await page.setViewportSize({width:1366,height:768});await togglePdf();await page.screenshot({path:'../.local/runtime/qa-pdf-wide.png'});}
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log('PASS: PDF wide/split/note/word modes, retained viewer, page navigation, hidden-pane autosave, note/word drafts, prior split ratios, laptop/mobile. No real DB/file writes.');
}catch(e){console.error({url:page.url(),errors,unexpected});throw e;}finally{await browser.close();}

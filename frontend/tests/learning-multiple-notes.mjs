// Focused note-page regression checks; every API request is mocked (no DB writes).
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.LEARNING_UI_URL || 'http://127.0.0.1:4173';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();
page.setDefaultTimeout(10000);
await context.addInitScript(()=>{
 if(window.top!==window)return;
 sessionStorage.setItem('accessToken','ui-only');
 if(localStorage.getItem('qa-seeded'))return;
 localStorage.setItem('qa-seeded','1');
 localStorage.setItem('dknote_draft_anonymous_RECORD_independent',JSON.stringify({kind:'RECORD',title:'예전 독립 초안',body:'<p>기존 초안 내용</p>',format:'richtext',startDate:'2026-10-26',details:{}}));
 localStorage.setItem('dknote_draft_anonymous_RECORD_broken','broken-json');
});
await context.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
const errors=[],unexpected=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
let fail=false,serial=0;
const entries=[{id:'task',kind:'TASK',title:'공부할 일',body:'기존 학습 상세',details:{},startDate:'2026-01-01',endDate:'2027-12-31',position:0,version:0,createdAt:'2026-01-01'},
  {id:'markdown',kind:'RECORD',title:'기존 Markdown 노트',body:'# 기존 본문',format:'markdown',startDate:'2026-10-11',details:{},position:1,version:0,createdAt:'2026-10-11'}];
entries.push(...[{id:'roadmap',kind:'ROADMAP',title:'학습 로드맵'},{id:'milestone',kind:'MILESTONE',title:'기존 세부 목표',parentId:'roadmap'}].map(e=>({...e,body:'기존 설명',details:{},startDate:'2026-01-01',endDate:'2027-12-31',position:0,version:0,createdAt:'2026-01-01'})));entries[0].parentId='milestone';
await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(!path.startsWith('/api/'))return route.continue();
  if(path==='/api/users/myProfile')return route.fulfill({json:{userId:'ui-only',email:'ui@example.com'}});
  if(path==='/api/workspace/settings')return route.fulfill({json:{}});
  if(path==='/api/workspace/entries')return route.fulfill({json:entries});
  if(path.startsWith('/api/workspace/entries/')){
    if(fail)return route.fulfill({status:500,json:{message:'검증용 저장 실패'}});
    const body=req.postDataJSON(),key=path.split('/').at(-1);
    const result={...body,id:req.method()==='POST'?`note${++serial}`:key,version:(body.version || 0)+1,position:0,createdAt:'2026-10-11'};
    writes.push(result);const index=entries.findIndex(e=>e.id===result.id);if(index<0)entries.push(result);else entries[index]=result;
    return route.fulfill({json:result});
  }
  unexpected.push(path);return route.fulfill({status:501,json:{message:'Unmocked request'}});
});
const composer=()=>page.locator('.learning-note-composer');
const title=()=>composer().getByLabel('제목',{exact:true});
const body=()=>composer().getByRole('textbox',{name:'학습 내용',exact:true});
const newForTask=async()=>{
 await page.goto(`${base}/learning/tasks/task`);
 await page.getByRole('button',{name:'＋ 노트 작성',exact:true}).click();
 await composer().waitFor();
 assert.equal(await title().inputValue(),'');
 assert.equal((await body().innerText()).trim(),'');
 return page.url();
};
const resume=async name=>{
 await page.locator('.learning-draft-list>summary').click();
 await page.getByRole('button',{name:`${name} · 이어서 작성`,exact:true}).click();
 await composer().waitFor(); assert.equal(await title().inputValue(),name);
};
const save=async()=>{
 await composer().getByRole('button',{name:'저장',exact:true}).click();
 await composer().waitFor({state:'hidden'});
};
try {
 const firstUrl=await newForTask();
 await title().fill('첫 번째 노트');await body().fill('첫 번째 본문');
 const secondUrl=await newForTask();assert.notEqual(firstUrl,secondUrl);
 await title().fill('두 번째 노트');await body().fill('두 번째 본문');
 await page.reload();await composer().waitFor();
 assert.equal(await title().inputValue(),'두 번째 노트');assert.match(await body().innerText(),/두 번째 본문/);
 await resume('첫 번째 노트');assert.equal(new URL(page.url()).searchParams.get('draft'),new URL(firstUrl).searchParams.get('draft'));assert.match(await body().innerText(),/첫 번째 본문/);
 fail=true;await composer().getByRole('button',{name:'저장',exact:true}).click();await composer().getByRole('alert').waitFor();
 assert.equal(writes.length,0);assert.equal(await title().inputValue(),'첫 번째 노트');
 fail=false;await save();assert.equal(writes.at(-1).parentId,'task');
 await newForTask();await resume('두 번째 노트');assert.match(await body().innerText(),/두 번째 본문/);await save();
 const taskNotes=entries.filter(e=>e.kind==='RECORD'&&e.parentId==='task');
 assert.equal(taskNotes.length,2);assert.notEqual(taskNotes[0].id,taskNotes[1].id);
 assert.deepEqual(taskNotes.map(e=>e.title).sort(),['두 번째 노트','첫 번째 노트'].sort());
 await page.goto(`${base}/learning/tasks/task`);
 await page.locator('.learning-record-library').waitFor();
 assert.match(await page.locator('.record-result-count').innerText(),/2개 자료/);
 for(const note of taskNotes)await page.getByRole('heading',{name:note.title,exact:true}).waitFor();
 await page.goto(`${base}/learning/records/new`);await composer().waitFor();assert.equal(await title().inputValue(),'');
 await resume('예전 독립 초안');assert.match(await body().innerText(),/기존 초안 내용/);
 assert.equal(await page.evaluate(()=>localStorage.getItem('dknote_draft_anonymous_RECORD_independent')),null);
 await page.reload();await composer().waitFor();assert.equal(await title().inputValue(),'예전 독립 초안');
 await save();assert.equal(writes.at(-1).parentId,null);
 await page.goto(`${base}/learning/records/new?parent=task`);await composer().waitFor();assert.equal(await title().inputValue(),'');
 assert.equal(await page.locator('.learning-draft-list').count(),0,'saved and empty drafts are not listed');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 console.log('PASS: new notes start blank; same-goal drafts remain independent; explicit resume, reload, failed-save retry, two distinct saved notes, legacy draft migration, independent notes and mobile width. All API data mocked.');
} catch(error) {console.error({url:page.url(),errors,unexpected,drafts:await page.locator('.learning-draft-list').allTextContents()});throw error;} finally {await browser.close();}

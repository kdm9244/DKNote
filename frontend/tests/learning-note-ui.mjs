// Focused note-page regression checks; every API request is mocked (no DB writes).
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.LEARNING_UI_URL || 'http://127.0.0.1:4173';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();
page.setDefaultTimeout(10000);
await context.addInitScript(()=>{if(window.top===window)sessionStorage.setItem('accessToken','ui-only');});
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
const assertPage=async()=>{
  await composer().waitFor();assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await page.locator('.learning-detail-heading,.record-detail-columns,.record-list-item,.learning-home-columns,.pdf-reading-layout').count(),0,'previous content must be replaced');
  assert.equal(await page.locator('.feature-sidebar').count(),1,'keep learning navigation');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
};
const save=async()=>{await composer().getByRole('button',{name:'저장',exact:true}).click();await composer().waitFor({state:'hidden'});};
const back=()=>composer().getByRole('button',{name:'편집 닫기'}).click();
try{
  await page.goto(`${base}/learning/tasks/task`);await page.getByRole('button',{name:'＋ 노트 작성',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/learning/records/new' && url.searchParams.get('parent')==='task' && Boolean(url.searchParams.get('draft')));await assertPage();assert.equal(await composer().getByLabel('연결할 목표 학습 할 일').inputValue(),'task');
  await composer().getByLabel('제목',{exact:true}).fill('공부 노트');await composer().getByRole('textbox',{name:'학습 내용',exact:true}).fill('페이지 작성 초안');
  await composer().getByRole('button',{name:'미리보기',exact:true}).click();await composer().locator('.record-preview').getByText('페이지 작성 초안').waitFor();await composer().getByRole('button',{name:'편집',exact:true}).click();
  await back();await page.waitForURL('**/learning/tasks/task');await page.getByRole('button',{name:'＋ 노트 작성',exact:true}).click();await assertPage();assert.equal(await composer().getByLabel('제목',{exact:true}).inputValue(),'');
  await page.locator('.learning-draft-list>summary').click();await page.getByRole('button',{name:'공부 노트 · 이어서 작성',exact:true}).click();await assertPage();
  await page.reload();await assertPage();assert.ok((await composer().getByRole('textbox',{name:'학습 내용',exact:true}).innerText()).includes('페이지 작성 초안'));
  fail=true;await composer().getByRole('button',{name:'저장',exact:true}).click();await composer().getByRole('alert').waitFor();assert.equal(await composer().getByLabel('제목',{exact:true}).inputValue(),'공부 노트');assert.equal(writes.length,0);fail=false;await save();await page.waitForURL('**/learning/records/note1');assert.equal(writes[0].parentId,'task');
  await page.locator('.record-detail-columns').getByRole('button',{name:'편집',exact:true}).first().click();await page.waitForURL('**/learning/records/note1/edit');await assertPage();assert.equal(await composer().getByLabel('제목',{exact:true}).inputValue(),'공부 노트');
  // Ctrl+S must respect required title validation, just like the save button.
  await composer().getByLabel('제목',{exact:true}).fill('');await composer().getByRole('textbox',{name:'학습 내용',exact:true}).press('Control+s');assert.equal(await composer().getByLabel('제목',{exact:true}).evaluate(e=>e.validity.valid),false);assert.equal(writes.length,1);
  await composer().getByLabel('제목',{exact:true}).fill('수정한 노트');await composer().getByRole('textbox',{name:'학습 내용',exact:true}).fill('수정된 본문');await composer().getByRole('textbox',{name:'학습 내용',exact:true}).press('Control+s');await composer().waitFor({state:'hidden'});await page.waitForURL('**/learning/records/note1');assert.equal(writes.at(-1).id,'note1');assert.equal(entries.find(e=>e.id==='note1').title,'수정한 노트');
  await page.goto(`${base}/learning/records/markdown/edit`);await assertPage();assert.equal(await composer().getByLabel('학습 내용',{exact:true}).inputValue(),'# 기존 본문');await composer().getByLabel('학습 내용',{exact:true}).fill('# 변경된 Markdown');await save();assert.equal(entries.find(e=>e.id==='markdown').body,'# 변경된 Markdown');
  await page.goto(`${base}/learning/records`);await page.getByRole('button',{name:'＋ 노트 작성',exact:true}).click();await assertPage();assert.equal(await composer().getByLabel('연결할 목표 로드맵').inputValue(),'');await back();await page.waitForURL('**/learning/records');
  for(const size of [{width:1280,height:640},{width:390,height:844}]){await page.setViewportSize(size);await page.goto(`${base}/learning/records/new?parent=task`);await assertPage();await back();await page.waitForURL('**/learning/tasks/task');}
  await page.goto(`${base}/learning/records/missing/edit`);await page.getByText('노트가 없거나 접근할 수 없습니다.').waitFor();assert.equal(await composer().count(),0);
  await page.goto(`${base}/learning/roadmaps`);await page.getByRole('button',{name:'＋ 학습 목표',exact:true}).click();const inline=page.locator('.learning-entry-composer');await inline.getByLabel('제목',{exact:true}).fill('학습 목표 검증');await inline.getByRole('button',{name:'저장',exact:true}).click();await inline.waitFor({state:'hidden'});assert.equal(writes.at(-1).kind,'ROADMAP');
  const entryEditor=()=>page.locator('.learning-entry-composer');
  const assertEntryPage=async()=>{await entryEditor().waitFor();assert.equal(await page.locator('.learning-detail-heading,.milestone-row,.learning-task-row,.roadmap-grid').count(),0);assert.equal(await page.getByRole('dialog').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));};
  await page.setViewportSize({width:1366,height:768});await page.goto(`${base}/learning/roadmaps/roadmap`);await page.getByRole('button',{name:'＋ 세부 목표',exact:true}).click();await page.waitForURL('**/milestones/new?parent=roadmap');await assertEntryPage();assert.equal(await entryEditor().getByLabel('연결할 목표').inputValue(),'roadmap');assert.equal(await entryEditor().getByLabel('시작일').inputValue(),'2026-01-01');assert.equal(await entryEditor().getByLabel('목표 완료일').inputValue(),'2027-12-31');
  await entryEditor().getByLabel('제목',{exact:true}).fill('새 세부 목표');await entryEditor().getByLabel('설명 / 완료 기준').fill('세부 공부 내용');await entryEditor().getByRole('button',{name:'편집 닫기'}).click();await page.waitForURL('**/roadmaps/roadmap');await page.getByRole('button',{name:'＋ 세부 목표',exact:true}).click();await assertEntryPage();assert.equal(await entryEditor().getByLabel('제목',{exact:true}).inputValue(),'새 세부 목표');await page.reload();await assertEntryPage();assert.equal(await entryEditor().getByLabel('설명 / 완료 기준').inputValue(),'세부 공부 내용');
  const beforeFailure=writes.length;fail=true;await entryEditor().getByRole('button',{name:'저장',exact:true}).click();await entryEditor().getByRole('alert').waitFor();assert.equal(writes.length,beforeFailure);fail=false;await entryEditor().getByRole('button',{name:'저장',exact:true}).click();await entryEditor().waitFor({state:'hidden'});const newMilestone=writes.at(-1);assert.equal(newMilestone.kind,'MILESTONE');assert.equal(newMilestone.parentId,'roadmap');await page.waitForURL(`**/milestones/${newMilestone.id}`);
  await page.locator('.learning-detail-heading').getByRole('button',{name:'편집',exact:true}).click();await assertEntryPage();await entryEditor().getByLabel('제목',{exact:true}).fill('수정한 세부 목표');await entryEditor().getByRole('button',{name:'저장',exact:true}).click();await entryEditor().waitFor({state:'hidden'});assert.equal(writes.at(-1).id,newMilestone.id);
  await page.getByRole('button',{name:'＋ 할 일',exact:true}).click();await assertEntryPage();assert.equal(await entryEditor().getByLabel('연결할 목표').inputValue(),newMilestone.id);await entryEditor().getByLabel('제목',{exact:true}).fill('새 공부 할 일');await entryEditor().getByRole('button',{name:'저장',exact:true}).click();await entryEditor().waitFor({state:'hidden'});const newTask=writes.at(-1);assert.equal(newTask.kind,'TASK');assert.equal(newTask.parentId,newMilestone.id);await page.waitForURL(`**/tasks/${newTask.id}`);
  await page.locator('.learning-related:not(.learning-materials)>summary').click();await page.getByRole('button',{name:'＋ 공부 날짜',exact:true}).click();const schedule=page.getByRole('region',{name:'학습 예정일',exact:true});await schedule.waitFor();assert.match(await schedule.evaluate(e=>e.closest('details').querySelector(':scope > summary').textContent),/^학습 예정일/);await schedule.getByRole('button',{name:'예정일 저장'}).click();await schedule.waitFor({state:'hidden'});assert.equal(writes.at(-1).parentId,newTask.id);
  for(const size of [{width:1280,height:640},{width:390,height:844}]){await page.setViewportSize(size);for(const [section,parent] of [['milestones','roadmap'],['tasks','milestone']]){await page.goto(`${base}/learning/${section}/new?parent=${parent}`);await assertEntryPage();await entryEditor().getByRole('button',{name:'편집 닫기'}).click();await entryEditor().waitFor({state:'hidden'});}}
  await page.setViewportSize({width:1366,height:768});await page.goto(`${base}/learning/roadmaps?new=1`);await page.waitForURL('**/roadmaps/new');await assertEntryPage();await entryEditor().getByRole('button',{name:'편집 닫기'}).click();await page.waitForURL('**/learning/roadmaps');
  if(process.env.LEARNING_UI_SCREENSHOT){await page.setViewportSize({width:1366,height:768});await page.goto(`${base}/learning/records/new?parent=task`);await assertPage();await page.screenshot({path:'../.local/runtime/qa-learning-note.png'});}
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  console.log('PASS: dedicated note/roadmap/milestone/task create/edit pages, parent/date context, draft/reload, failed save, return, richtext/Markdown, Ctrl+S validation, inline schedule placement, legacy links, laptop/mobile. No DB writes.');
}catch(e){console.error({url:page.url(),errors,unexpected,screen:(await page.locator('body').innerText()).slice(0,1200)});throw e;}finally{await browser.close();}

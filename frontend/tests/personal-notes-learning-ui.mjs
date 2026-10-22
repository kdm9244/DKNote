// All network writes are intercepted; this test does not touch user records.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4177'],{stdio:'ignore'});
process.on('exit',()=>server.kill());
await new Promise(r=>setTimeout(r,1500));
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'}),page=await context.newPage();
page.setDefaultTimeout(10000);
await context.addInitScript(()=>{if(location.protocol.startsWith('http'))sessionStorage.setItem('accessToken','ui-only');});
let entries=[],counter=0,fail=false,attempts=0;const uploads=[],errors=[],unexpected=[];
const stamp='2026-10-20T12:00:00';
page.on('pageerror',e=>errors.push(e.message));
await context.route('**/api/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname,json=data=>route.fulfill({json:data});
 if(!path.startsWith('/api/'))return route.continue();
 if(path==='/api/users/myProfile')return json({userId:'u',nickname:'메모 사용자',role:'USER'});
 if(path==='/api/workspace/settings')return json({aiEnabled:false});
 if(path==='/api/workspace/entries')return json(entries);
 if(path==='/api/workspace/entries/MEMO'){
  const memo={...req.postDataJSON(),id:`memo${++counter}`,kind:'MEMO',version:0,position:0,createdAt:stamp,updatedAt:stamp};entries.push(memo);return json(memo);
 }
 if(path.startsWith('/api/workspace/entries/memo')){
  const id=path.split('/').at(-1);
  if(req.method()==='DELETE'){entries=entries.filter(e=>e.id!==id);return route.fulfill({status:204});}
  attempts++;
  if(fail)return route.fulfill({status:409,json:{message:'다른 화면에서 변경되었습니다. 새로고침 후 다시 저장하세요.'}});
  const next={...req.postDataJSON(),version:attempts,updatedAt:stamp};entries=entries.map(e=>e.id===id?next:e);return json(next);
 }
 if(path==='/api/workspace/pdf'){
  uploads.push(req.postDataBuffer().toString());
  const pdf={id:`pdf${uploads.length}`,kind:'PDF',title:`자료 ${uploads.length}`,parentId:'task',body:'',format:'plain',details:{fileName:'test.pdf'},version:0,position:0,createdAt:stamp,updatedAt:stamp};entries.push(pdf);return json(pdf);
 }
 unexpected.push(path);return route.fulfill({status:501,json:{message:'Unmocked request'}});
});
const visit=path=>page.goto(`http://127.0.0.1:4177${path}`);
try{
 await visit('/notes');
 assert.equal(await page.getByRole('link',{name:'♙ 마이',exact:true}).count(),0);
 await page.getByRole('button',{name:'＋ 새 메모',exact:true}).click();
 await page.getByLabel('메모 제목',{exact:true}).fill('오류 발견 기록');
 await page.getByLabel('메모 내용',{exact:true}).fill('매도 화면 개선');
 await page.getByLabel('상단 고정',{exact:true}).check();
 await page.getByRole('status').filter({hasText:'저장됨'}).waitFor();
 assert.equal(entries[0].details.pinned,true);assert.equal(entries[0].body,'매도 화면 개선');
 await page.reload();await page.getByRole('button',{name:/오류 발견 기록.*매도 화면 개선/}).click();
 assert.equal(await page.getByLabel('메모 내용',{exact:true}).inputValue(),'매도 화면 개선');
 await page.getByLabel('메모 검색').fill('찾을 수 없는 내용');await page.getByText('검색 결과가 없습니다.').waitFor();
 await page.getByLabel('메모 검색').fill('');
 // Failed saves retain the draft and stop retrying until the user acts.
 fail=true;await page.getByLabel('메모 내용',{exact:true}).fill('충돌 시 보존할 초안');
 await page.getByRole('status').filter({hasText:'다른 화면에서 변경되었습니다'}).waitFor();const failedAttempts=attempts;
 await page.waitForTimeout(1600);assert.equal(attempts,failedAttempts);
 fail=false;await page.getByRole('button',{name:'지금 저장',exact:true}).click();await page.getByRole('status').filter({hasText:'저장됨'}).waitFor();
 assert.equal(entries[0].body,'충돌 시 보존할 초안');
 for(const width of [1366,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.waitForFunction(()=>document.querySelector('.feature-sidebar').getBoundingClientRect().right<=1);
 await mkdir('../.local/personal-notes-qa',{recursive:true});await page.screenshot({path:'../.local/personal-notes-qa/notes-mobile.png',fullPage:true});
 await page.setViewportSize({width:1366,height:768});
 // Changing selection before debounce leaves a recoverable draft.
 await page.getByRole('button',{name:'＋ 새 메모',exact:true}).click();await page.getByLabel('메모 내용',{exact:true}).fill('이동 전 초안');
 await page.getByRole('button',{name:/오류 발견 기록.*충돌 시 보존할 초안/}).click();
 await page.getByRole('button',{name:/새 메모.*내용 없음/}).click();
 assert.equal(await page.getByLabel('메모 내용',{exact:true}).inputValue(),'이동 전 초안');
 await page.getByRole('status').filter({hasText:'저장됨'}).waitFor();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'새 메모 삭제',exact:true}).click();await page.getByText('메모를 선택하거나 새로 작성하세요.').waitFor();assert.equal(entries.length,1);
 const entry=(id,kind,title,parentId)=>({id,kind,title,parentId,body:'',details:{},format:'plain',startDate:'2026-10-01',endDate:'2026-10-31',version:0,position:0,createdAt:stamp,updatedAt:stamp});
 entries.push(entry('root','ROADMAP','로드맵'),entry('mile','MILESTONE','목표','root'),entry('task','TASK','학습 할 일','mile'));
 await visit('/learning/tasks/task');await page.locator('details.learning-materials[open]').waitFor();
 await page.getByRole('link',{name:'PDF 올리기·관리',exact:true}).click();
 assert.equal(new URL(page.url()).searchParams.get('parent'),'task');
 assert.equal(await page.getByLabel('연결할 학습 목표',{exact:true}).inputValue(),'task');
 const file={name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF')};
 await page.locator('input[type=file]').setInputFiles([file,{...file,name:'test2.pdf'}]);
 await page.getByRole('heading',{name:'자료 2',exact:true}).waitFor();
 assert.equal(uploads.length,2);assert.ok(uploads.every(raw=>raw.includes('name="parentId"\r\n\r\ntask')));
 await visit('/learning/pdf');assert.equal(await page.getByLabel('연결할 학습 목표',{exact:true}).inputValue(),'');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 console.log('PASS memo autosave/reload/pin/search/delete/conflict/draft recovery/mobile and PDF automatic task association, multiple uploads and independent upload. APIs mocked.');
}catch(e){console.error({url:page.url(),errors,unexpected,text:(await page.locator('body').innerText()).slice(-1400)});throw e;}
finally{await browser.close();server.kill();}

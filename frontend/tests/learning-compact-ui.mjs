// Changed UI flows only. API writes are mocked and do not touch application data.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4183'],{stdio:'ignore'});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'}),page=await context.newPage();
page.setDefaultTimeout(10000);await mkdir('../.local/compact-qa',{recursive:true});
// Keep layout checks independent of external font availability.
await context.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
const item=(id,kind,title,extra={})=>({id,kind,title,body:'',details:{},completed:false,version:0,position:0,createdAt:'2026-10-19T12:00:00',...extra});
const entries=[item('r','ROADMAP','일본어 학습',{startDate:'2026-10-19',endDate:'2026-12-31'}),item('r2','ROADMAP','다음 학습'),item('m','MILESTONE','일상 회화',{parentId:'r'}),item('t','TASK','인사 표현 복습',{parentId:'m'}),item('t2','TASK','듣기 연습',{parentId:'m'}),item('note','RECORD','연습 노트',{startDate:'2026-10-19',format:'richtext',parentId:'t',body:Array.from({length:30},(_,i)=>`<p>학습 내용 ${i+1}</p>`).join('')}),...Array.from({length:12},(_,i)=>item(`w${i}`,'WORD',i===0?'挨拶':`単語${i}`,{body:i===0?'인사':`복습할 단어 ${i}`,details:{language:'ja',reading:i===0?'あいさつ':'たんご'}}))];
const notices=[{id:'n',title:'더 편리해진 학습 화면',releaseVersion:'1.2',createdAt:'2026-10-19T12:00:00',body:Array.from({length:20},()=> 'PDF와 학습노트 화면을 개선했습니다.').join('\n')}];
let fail=false,failNews=false;const errors=[],unexpected=[],failedResources=[];
page.on('requestfailed',req=>failedResources.push({url:req.url(),failure:req.failure()}));
page.on('response',res=>{if(res.status()>=400&&!res.url().includes('/api/'))failedResources.push({url:res.url(),status:res.status()});});
await context.addInitScript(()=>sessionStorage.setItem('accessToken','ui-test'));
await context.route('**/api/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname,method=req.method(),json=(data,status=200)=>route.fulfill({status,json:data});
 if(path==='/api/users/myProfile')return json({userId:'ui-test',email:'ui@test',role:'USER'});
 if(path==='/api/workspace/entries')return json(entries);
 if(path==='/api/workspace/settings')return json({});
 if(path==='/api/notices/public'){assert.equal(req.headers().authorization,undefined);return failNews?json({},500):json(notices);}
 if(path==='/api/auth/policy')return json({signupEnabled:false});
 if(path==='/api/workspace/words/mastery'){
  if(fail)return json({message:'검증용 저장 실패'},500);const body=req.postDataJSON();const changed=entries.filter(e=>body.ids.includes(e.id));changed.forEach(e=>e.completed=body.completed);return json(changed);
 }
 if(path.startsWith('/api/workspace/entries/')&&method==='PUT'){
  if(fail)return json({message:'검증용 저장 실패'},500);const body=req.postDataJSON(),i=entries.findIndex(e=>e.id===body.id);entries[i]={...body,version:body.version+1};return json(entries[i]);
 }
 unexpected.push(`${method} ${path}`);return json({},501);
});
page.on('pageerror',e=>errors.push(e.stack));
const overflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal page overflow');
try {
 await new Promise(r=>setTimeout(r,1000));
 await page.goto('http://127.0.0.1:4183/learning/records/note/edit');
 const editor=page.getByRole('textbox',{name:'학습 내용',exact:true});await editor.waitFor();
 const toolbar=page.getByRole('toolbar',{name:'글쓰기 서식'}),before=await toolbar.boundingBox();
 await toolbar.getByRole('button',{name:'▦ 표 만들기',exact:true}).click();
 const picker=page.getByRole('dialog',{name:'표 크기 선택'});await picker.waitFor();
 const after=await toolbar.boundingBox();assert.ok(Math.abs(before.height-after.height)<=2,'picker must not stretch toolbar');
 await picker.getByRole('gridcell',{name:'2행 4열 표 삽입',exact:true}).click();await picker.waitFor({state:'hidden'});
 assert.equal(await editor.locator('tr').count(),2);assert.equal(await editor.locator('tr').first().locator('th,td').count(),4);
 await editor.locator('th').first().click();await toolbar.getByText('행·열 편집',{exact:true}).click();await toolbar.getByRole('button',{name:'아래에 행 추가',exact:true}).click();assert.equal(await editor.locator('tr').count(),3);
 await toolbar.getByRole('button',{name:'▦ 표 만들기',exact:true}).click();await picker.getByRole('gridcell',{name:'2행 4열 표 삽입',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator(':focus').getAttribute('aria-label'),'2행 5열 표 삽입');await page.keyboard.press('Escape');assert.equal(await picker.count(),0);
 assert.notEqual(await toolbar.evaluate(e=>getComputedStyle(e).position),'sticky');assert.notEqual(await page.locator('.learning-note-toolbar').evaluate(e=>getComputedStyle(e).position),'sticky');
 await page.getByRole('button',{name:'저장',exact:true}).click();await page.waitForURL('**/learning/records/note');assert.match(entries.find(e=>e.id==='note').body,/<table/);
 await page.goto('http://127.0.0.1:4183/learning/words');const row=page.locator('.word-library-row').first();await row.waitFor();
 assert.equal(await row.locator('.word-entry-title').innerText(),'挨拶');assert.equal(await row.locator('.word-entry-reading').innerText(),'あいさつ');assert.match(await row.locator('.word-entry-meaning').innerText(),/인사/);
 const boxes=await Promise.all(['.word-entry-title','.word-entry-reading','.word-entry-meaning'].map(s=>row.locator(s).boundingBox()));assert.ok(boxes[0].x<boxes[1].x&&boxes[1].x<boxes[2].x);assert.ok((await row.boundingBox()).height<110);
 await row.getByRole('checkbox').click();await page.waitForFunction(()=>document.querySelector('.word-library-row').classList.contains('mastered'));assert.ok(entries.find(e=>e.id==='w0').completed);
 await row.getByRole('button',{name:'편집',exact:true}).click();const editing=page.getByRole('region',{name:'단어 편집',exact:true});await editing.getByLabel('뜻 / 예문',{exact:true}).fill('인사하다');
 fail=true;await editing.getByRole('button',{name:'저장',exact:true}).click();await editing.getByRole('alert').waitFor();assert.equal(await editing.getByLabel('뜻 / 예문').inputValue(),'인사하다');fail=false;await editing.getByRole('button',{name:'저장',exact:true}).click();await editing.waitFor({state:'hidden'});
 await page.getByLabel('단어 검색').fill('挨拶');assert.equal(await page.locator('.word-library-row').count(),1);assert.equal(await page.locator('.word-library .ws-pagination').count(),0);
 await page.screenshot({path:'../.local/compact-qa/words-desktop.png',fullPage:true});
 await page.goto('http://127.0.0.1:4183/learning/roadmaps');await page.locator('.roadmap-summary-row').first().waitFor();assert.equal(await page.locator('.roadmap-summary-row').count(),2);assert.match(await page.locator('.roadmap-summary-row').first().innerText(),/인사 표현 복습/);
 await page.screenshot({path:'../.local/compact-qa/roadmaps-desktop.png',fullPage:true});
 await page.getByRole('link').filter({has:page.getByRole('heading',{name:'일본어 학습',exact:true})}).click();
 const step=page.locator('.roadmap-step');await step.waitFor();assert.equal(await step.getAttribute('open'),null);assert.equal(await page.locator('.learning-related[open]').count(),1);
 await step.locator(':scope > summary').click();await step.getByRole('checkbox',{name:'인사 표현 복습 완료'}).click();await page.waitForFunction(()=>document.querySelector('.roadmap-step summary small').textContent==='50%');
 const materials=page.locator('.learning-materials');await materials.getByText('연습 노트',{exact:true}).waitFor();await materials.locator(':scope > summary').click();assert.equal(await materials.getByText('연습 노트',{exact:true}).isVisible(),false);await materials.locator(':scope > summary').click();
 await page.screenshot({path:'../.local/compact-qa/roadmap-detail-desktop.png',fullPage:true});
 for(const width of [360,390,768]){
  await page.setViewportSize({width,height:844});
  for(const path of ['/learning/words','/learning/roadmaps','/learning/roadmaps/r','/learning/records/note/edit']){
   await page.goto('http://127.0.0.1:4183'+path);await page.locator('.word-library,.roadmap-summary-row,.roadmap-outline,.rich-toolbar').first().waitFor();await overflow();
   if(path.endsWith('/edit')){await page.getByRole('button',{name:'▦ 표 만들기'}).click();await picker.waitFor();const b=await picker.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width);await overflow();await page.screenshot({path:`../.local/compact-qa/table-${width}.png`,fullPage:true});}
   if(path==='/learning/words')await page.screenshot({path:`../.local/compact-qa/words-${width}.png`,fullPage:true});
  }
 }
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:4183/login');const link=page.getByRole('link',{name:/전체 보기/});await link.waitFor();assert.ok((await page.locator('.auth-updates').boundingBox()).height<110);assert.equal(await page.locator('.auth-updates-content').isVisible(),false);
 await page.getByLabel('아이디 또는 이메일').fill('my-login');await page.locator('#login-password').fill('client-memory-only');await link.click();await page.waitForURL('**/news');await page.getByRole('heading',{name:notices[0].title,exact:true}).waitFor();await overflow();assert.equal(await page.locator('.public-news-shell').evaluate(e=>e.scrollHeight>innerHeight),true);await page.screenshot({path:'../.local/compact-qa/news-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'← 로그인으로'}).click();assert.equal(await page.getByLabel('아이디 또는 이메일').inputValue(),'my-login');assert.equal(await page.locator('#login-password').inputValue(),'client-memory-only');
 assert.equal(await page.evaluate(()=>Object.values(sessionStorage).some(s=>s.includes('client-memory-only'))||Object.values(localStorage).some(s=>s.includes('client-memory-only'))),false);
 failNews=true;await link.click();await page.getByRole('alert').waitFor();failNews=false;await page.getByRole('button',{name:'다시 불러오기'}).click();await page.getByRole('heading',{name:notices[0].title,exact:true}).waitFor();
 await page.reload();await page.getByRole('heading',{name:'업데이트 소식',exact:true}).waitFor();await page.getByRole('button',{name:'← 로그인으로'}).click();await page.waitForURL('**/login');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log('PASS: grid picker/keyboard/no layout shift/table save, non-sticky tools, compact word columns/mastery/edit failure retry/search, roadmap outline/task completion/linked materials, 360/390/768 layouts, mobile public news navigation/retry/login fields kept in memory only. APIs mocked.');
} catch(e){console.error({url:page.url(),errors,unexpected,failedResources});await page.screenshot({path:'../.local/compact-qa/failure.png',fullPage:true});throw e;}
finally{await browser.close();server.kill();}

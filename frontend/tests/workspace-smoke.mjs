import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';

// Runs only against a temporary user created and removed by WorkspaceBrowserTest.
const base=process.env.WORKSPACE_TEST_URL,token=process.env.WORKSPACE_TEST_TOKEN;
if(!base||!token)throw new Error('Run with Maven -Dworkspace.browser.test=true; do not supply a real account.');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();page.setDefaultTimeout(12000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const headers={Authorization:`Bearer ${token}`};
const request=context.request;
const localToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const today=localToday();
const travelFixture={tripId:'qa-trip',teamId:'qa-team',title:'가을 교토 여행',description:'함께 걷고 기록하는 여행',startDate:today,endDate:today,status:'ACTIVE'};
const call=async(method,url,data)=>{const res=await request[method](`${base}${url}`,{headers,data});assert.ok(res.ok(),`${method} ${url}: ${res.status()}`);return res.status()===204?null:res.json();};
const create=(kind,data)=>call('post',`/api/workspace/entries/${kind}`,{title:'테스트',details:{},...data});
const qa=name=>path.resolve('../.local',`qa-${name}.png`);
await context.addInitScript(({token})=>{sessionStorage.setItem('accessToken',token);localStorage.setItem('dknote_data_reset_version','2026-08-production-start-v1');localStorage.setItem('mika_settings_security_migration',JSON.stringify({geminiApiKey:'fake-key-for-security-test',model:'preserve-preference'}));},{token});
await page.route('**/*',async route=>{
  const url=route.request().url();
  if(url.includes('/api/chat')||url.includes('/api/ai/ollama/chat'))return route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({message:{content:'브라우저 검증 응답'},done:true})+'\n'});
  if(url.includes('/api/ai/ollama/status'))return route.fulfill({json:{available:true,models:[]}});
  if(url.includes('/api/ai/exchange-rate')){const currency=new URL(url).searchParams.get('base');return route.fulfill({json:{base:currency,quote:'KRW',rate:currency==='JPY'?9:1300,baseUnit:1,provider:'KIS',updatedAt:'2026-10-11T12:00:00'}});}
  if(url.includes('/api/ai/'))return route.fulfill({json:{available:true,models:[]}});
  if(url.includes('/api/ledger/accounts'))return route.fulfill({json:{accounts:[{accountId:'qa-cash',currency:'KRW',accountType:'CHECKING',cachedBookBalance:1000000},{accountId:'qa-investment',currency:'KRW',accountType:'INVESTMENT',cachedBookBalance:100000},{accountId:'qa-usd',currency:'USD',accountType:'CHECKING',cachedBookBalance:1000},{accountId:'qa-yen',currency:'JPY',accountType:'FOREIGN_CURRENCY',cachedBookBalance:2000}]}});
  if(url.includes('/api/ledger/'))return route.fulfill({json:{month:'2026-10',monthlyIncome:{KRW:0},monthlyExpense:{KRW:12000},monthlyNetCashFlow:{KRW:-12000},investment:{totals:[{currency:'KRW',marketValue:2000000,totalAsset:2100000,cashBalance:100000}],holdings:[],accounts:[],allocations:[],recentTrades:[]},debt:{totals:[],accounts:[],recentPayments:[]}}});
  if(url.endsWith('/api/travel/trips'))return route.fulfill({json:[{...travelFixture,id:'qa-trip',timezone:'Asia/Tokyo',status:'여행 중'}]});
  if(url.includes('/api/travel/trips/qa-trip'))return route.fulfill({json:{trip:{...travelFixture,id:'qa-trip',timezone:'Asia/Tokyo',version:0},days:[{id:'qa-day',date:today,number:1,activities:[]}],places:[],reservations:[],expenses:[],checklist:[],budget:{actualKrw:0,plannedKrw:0,nativeTotals:{}}}});
  if(url.endsWith('/api/teams'))return route.fulfill({json:[{teamId:'qa-team',teamName:'우리 여행 팀'}]});
  if(url.includes('/api/teams/qa-team/trips'))return route.fulfill({json:[travelFixture]});
  if(url.includes('/api/teams/qa-team/members'))return route.fulfill({json:[]});
  if(url.includes('/api/feeds'))return route.fulfill({json:[]});
  if(url.includes('/api/trips/qa-trip/itinerary'))return route.fulfill({json:{days:[{dayId:'qa-day',date:today,dayNumber:1,activities:[{activityId:'qa-activity',title:'동네 산책',startTime:'10:00',activityType:'SPOT',locationName:'교토'}]}]}});
  if(url.includes('/api/trips/qa-trip/budget'))return route.fulfill({json:{totalBudget:0,totalExpense:0,categories:[],expenses:[],settlements:[]}});
  if(url.includes('/api/trips/qa-trip/checklist'))return route.fulfill({json:{items:[]}});
  if(url.includes('/api/trips/qa-trip/polls'))return route.fulfill({json:[]});
  if(url.endsWith('/api/trips/qa-trip'))return route.fulfill({json:travelFixture});
  if(url.startsWith(base)||url.startsWith('blob:'))return route.continue();
  return route.abort();
});
try {
  const roadmap=await create('ROADMAP',{title:'테스트 로드맵',startDate:'2026-01-01',endDate:'2027-12-31'});
  const milestone=await create('MILESTONE',{title:'테스트 세부 목표',parentId:roadmap.id,startDate:'2026-01-01',endDate:'2027-12-31'});
  const task=await create('TASK',{title:'테스트 할 일',parentId:milestone.id,startDate:'2026-01-01',endDate:'2027-12-31'});
  await create('SCHEDULE',{title:task.title,parentId:task.id,startDate:today});
  await page.goto(base);
  await page.locator('.home-feature-card').first().waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mika_settings_security_migration')).geminiApiKey),undefined,'Legacy browser API key must be removed');
  assert.equal(await page.evaluate(()=>localStorage.getItem('accessToken')),null,'Auth token must not persist in localStorage');
  assert.equal(await page.locator('.home-feature-card').count(),4);
  await page.getByText('총자산 ₩4,418,000',{exact:true}).waitFor();
  assert.equal(await page.locator('.mika-dialogue-stream').isVisible(),false);
  await page.screenshot({path:qa('home-desktop'),fullPage:true});
  await page.locator('.mika-dock-input').fill('안녕하세요');await page.locator('.mika-dock-input').press('Enter');
  await page.getByText('브라우저 검증 응답',{exact:true}).waitFor();
  assert.ok(await page.locator('.home-chat-dock').evaluate(e=>e.classList.contains('is-expanded')));
  await page.getByRole('button',{name:'대화 접기'}).click();
  assert.ok(await page.locator('.home-feature-card').first().isVisible());
  await page.goto(`${base}/calendar`);
  await page.getByRole('button',{name:'＋ 일정 추가',exact:true}).click();
  await page.getByLabel('제목',{exact:true}).fill('검증 일정');
  await page.getByRole('button',{name:'＋ 체크 항목',exact:true}).click();
  await page.getByLabel('체크 항목 1').fill('준비물 확인');
  await page.locator('.ws-inline-editor,.learning-entry-composer').getByRole('button',{name:'저장',exact:true}).click();
  await page.locator('.ws-inline-editor,.learning-entry-composer').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'검증 일정',exact:true}).first().click();
  await page.locator('.ws-inline-editor,.learning-entry-composer').locator('.check-edit-row input[type=checkbox]').check();
  await page.locator('.ws-inline-editor,.learning-entry-composer').getByRole('button',{name:'저장',exact:true}).click();
  await page.locator('.ws-inline-editor,.learning-entry-composer').waitFor({state:'hidden'});
  const event=(await call('get','/api/workspace/entries')).find(e=>e.title==='검증 일정');assert.equal(event.details.checks[0].done,true);
  await page.screenshot({path:qa('calendar-desktop'),fullPage:true});
  const calendarNav=page.getByRole('navigation',{name:'캘린더 메뉴'});
  assert.equal(await page.locator('.main-portal-sidebar').count(),0,'Calendar has its own sidebar');
  await calendarNav.getByRole('link',{name:'일정 목록',exact:true}).click();await page.waitForURL('**/calendar/events');await page.getByRole('button',{name:'검증 일정',exact:true}).waitFor();
  await page.getByRole('navigation',{name:'캘린더 메뉴'}).getByRole('link',{name:'오늘 일정',exact:true}).click();await page.waitForURL('**/calendar/today');await page.locator('.calendar-event-list').waitFor();
  await page.getByRole('navigation',{name:'캘린더 메뉴'}).getByRole('link',{name:'체크리스트 템플릿',exact:true}).click();await page.waitForURL('**/calendar/templates');await page.getByRole('button',{name:'＋ 템플릿 만들기',exact:true}).click();await page.getByLabel('제목',{exact:true}).fill('전용 페이지 템플릿');await page.getByRole('button',{name:'＋ 체크 항목',exact:true}).click();await page.getByLabel('체크 항목 1').fill('자료 준비');await page.locator('.ws-inline-editor,.learning-entry-composer').getByRole('button',{name:'저장',exact:true}).click();await page.locator('.ws-inline-editor,.learning-entry-composer').waitFor({state:'hidden'});await page.getByRole('heading',{name:'전용 페이지 템플릿',exact:true}).waitFor();
  await page.getByRole('navigation',{name:'캘린더 메뉴'}).getByRole('link',{name:'캘린더·연결 설정',exact:true}).click();await page.waitForURL('**/calendar/sources');const prefUpdated=page.waitForResponse(r=>r.url().endsWith('/api/workspace/settings')&&r.request().method()==='PATCH');await page.getByLabel('주 시작 요일').selectOption('1');await prefUpdated;
  assert.equal((await call('get','/api/workspace/settings')).weekStart,1);
  await page.goto(`${base}/learning/roadmaps`);const studyAside=page.getByRole('complementary',{name:'학습 전용 사이드바'});await studyAside.getByRole('button',{name:'테스트 로드맵 펼치기',exact:true}).click();await studyAside.getByRole('link',{name:/테스트 세부 목표/}).click();await page.waitForURL(`**/learning/milestones/${milestone.id}`);assert.equal(await page.locator('.learning-nav').count(),0,'Learning uses its sidebar instead of top tabs');
  await page.getByRole('complementary',{name:'학습 전용 사이드바'}).getByRole('link',{name:'새 로드맵 만들기',exact:true}).click();await page.locator('.ws-inline-editor,.learning-entry-composer').waitFor();await page.getByLabel('제목',{exact:true}).fill('사이드바에서 만든 목표');await page.locator('.ws-inline-editor,.learning-entry-composer').getByRole('button',{name:'저장',exact:true}).click();await page.locator('.ws-inline-editor,.learning-entry-composer').waitFor({state:'hidden'});
  await page.getByRole('navigation',{name:'학습 메뉴'}).getByRole('link',{name:'오늘 할 학습',exact:true}).click();await page.waitForURL('**/learning/today');await page.getByText('테스트 할 일',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'사이드바 접기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.feature-sidebar').getBoundingClientRect().width<90);await page.getByRole('button',{name:'사이드바 펼치기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.feature-sidebar').getBoundingClientRect().width>250);
  await page.screenshot({path:qa('learning-sidebar-desktop'),fullPage:true});
  await page.goto(`${base}/ledger`);await page.getByText('₩ 4,418,000',{exact:true}).first().waitFor();await page.getByText('총자산 통화별 내역',{exact:true}).click();await page.getByText('JPY ¥ 2,000',{exact:true}).first().waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight+1),'Ledger outer page stays in viewport');
  await page.goto(`${base}/learning/tasks/${task.id}`);
  await page.getByLabel('할 일 완료',{exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.learning-detail-heading input[type=checkbox]')?.checked);
  await page.getByRole('button',{name:'＋ 노트 작성',exact:true}).click();
  await page.getByLabel('제목',{exact:true}).fill('검증 노트');
  await page.locator('.ws-inline-editor,.learning-entry-composer').getByRole('button',{name:'Markdown',exact:true}).click();await page.getByLabel('학습 내용',{exact:true}).fill('# Spring 공부\n\n```java\nint value = 1;\nSystem.out.println(value);\n```');
  await page.locator('.ws-inline-editor,.learning-entry-composer').getByRole('button',{name:'저장',exact:true}).click();
  await page.locator('.ws-inline-editor,.learning-entry-composer').waitFor({state:'hidden'});
  await page.waitForURL('**/learning/records/*');
  await page.locator('.learning-code-lines button').first().click();
  await page.getByLabel('설명 작성',{exact:true}).fill('첫 번째 코드 줄 설명');
  const commentSaved=page.waitForResponse(r=>r.url().endsWith('/api/workspace/entries/COMMENT')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'댓글 저장',exact:true}).click();assert.ok((await commentSaved).ok());
  await page.locator('.record-comment p').getByText('첫 번째 코드 줄 설명',{exact:true}).waitFor();
  const data=await call('get','/api/workspace/entries');assert.equal(data.find(e=>e.id===task.id).completed,true);assert.ok(data.some(e=>e.kind==='COMMENT'));
  await page.screenshot({path:qa('learning-note-desktop'),fullPage:true});
  await page.goto(`${base}/learning/pdf`);
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length 43 >>\nstream\nBT /F1 18 Tf 40 200 Td (Test PDF) Tj ET\nendstream'];
  let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  await page.locator('input[type=file]').setInputFiles({name:'검증.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)});
  await page.waitForURL('**/learning/pdf/*');
  assert.equal(await page.getByLabel('PDF 제목',{exact:true}).count(),0,'PDF metadata starts folded');
  await page.getByRole('button',{name:'자료 정보',exact:true}).click();await page.getByLabel('PDF 제목',{exact:true}).fill('검증 자료.pdf');
  await page.getByRole('button',{name:'자료 정보 저장',exact:true}).click();await page.getByText('자료 정보를 저장했습니다.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'자료 정보 접기',exact:true}).click();
  await page.setViewportSize({width:1366,height:768});
  const footerBox=await page.locator('.pdf-resource-footer').boundingBox();const workBox=await page.locator('.pdf-workspace').boundingBox();assert.ok(footerBox.y>=workBox.y+workBox.height-1,'PDF management actions stay below the reading workspace');
  await page.getByRole('separator',{name:'PDF와 필기 너비 조절',exact:true}).focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.getByText('비율 저장됨',{exact:true}).waitFor();
  assert.equal((await call('get','/api/workspace/settings')).pdfNoteRatio,59);
  await page.reload();await page.getByRole('textbox',{name:'페이지 필기',exact:true}).waitFor();assert.equal(await page.getByRole('separator',{name:'PDF와 필기 너비 조절',exact:true}).getAttribute('aria-valuenow'),'59','Reload restores account split ratio');
  const delayedRatio=async route=>{if(route.request().method()==='PATCH'&&route.request().postDataJSON()?.pdfNoteRatio===61)await new Promise(resolve=>setTimeout(resolve,900));await route.fallback();};
  await page.route('**/api/workspace/settings',delayedRatio);
  const ratioRequest=page.waitForRequest(r=>r.url().endsWith('/api/workspace/settings')&&r.method()==='PATCH'&&r.postDataJSON()?.pdfNoteRatio===61);
  await page.getByRole('separator',{name:'PDF와 필기 너비 조절',exact:true}).focus();await page.keyboard.press('ArrowRight');await ratioRequest;
  const restoredRatio=page.waitForResponse(r=>r.url().endsWith('/api/workspace/settings')&&r.request().method()==='PATCH'&&r.request().postDataJSON()?.pdfNoteRatio===59);
  await page.keyboard.press('ArrowLeft');assert.ok((await restoredRatio).ok());assert.equal((await call('get','/api/workspace/settings')).pdfNoteRatio,59,'Latest split selection wins even while an earlier save is pending');await page.unroute('**/api/workspace/settings',delayedRatio);
  await page.waitForFunction(()=>document.querySelector('.pdf-document iframe').getBoundingClientRect().height>300);
  const pdfBox=await page.locator('.pdf-document').boundingBox();assert.ok(pdfBox.y+pdfBox.height<=768+1,'PDF viewing area fits laptop viewport');
  await page.screenshot({path:qa('pdf-notes-polished'),fullPage:true});
  await page.getByRole('textbox',{name:'페이지 필기',exact:true}).fill('PDF 첫 페이지 필기');
  await page.locator('.pdf-note-heading .save-status.is-draft').waitFor();
  await page.getByRole('textbox',{name:'페이지 필기',exact:true}).press('Control+a');await page.getByRole('button',{name:'굵게',exact:true}).click();
  await page.getByRole('button',{name:'페이지 필기 저장',exact:true}).click();
  await page.getByText('1페이지 필기를 저장했습니다.',{exact:true}).waitFor();
  const storedPdf=(await call('get','/api/workspace/entries')).find(e=>e.kind==='PDF');
  assert.equal(storedPdf.details.pages['1'].format,'richtext');assert.ok(storedPdf.details.pages['1'].body.includes('PDF 첫 페이지 필기'));assert.ok(storedPdf.details.pages['1'].body.includes('<strong>'));
  await page.getByRole('button',{name:'다음 페이지',exact:true}).click();await page.getByRole('textbox',{name:'페이지 필기',exact:true}).fill('두 번째 페이지 자동 저장');
  await page.getByText('2페이지 필기를 저장했습니다.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'이전 페이지',exact:true}).click();assert.ok((await page.getByRole('textbox',{name:'페이지 필기',exact:true}).innerText()).includes('PDF 첫 페이지 필기'));
  await page.getByRole('button',{name:'PDF 넓게 보기',exact:true}).click();assert.equal(await page.locator('.pdf-notes-pane').isVisible(),false);assert.equal(await page.getByRole('separator',{name:'PDF와 필기 너비 조절'}).isVisible(),false);await page.getByRole('button',{name:'분할 화면으로',exact:true}).click();assert.equal(await page.getByRole('separator',{name:'PDF와 필기 너비 조절'}).getAttribute('aria-valuenow'),'59');
  await page.getByRole('button',{name:'필기 넓게 보기',exact:true}).click();assert.equal(await page.locator('.pdf-document').isVisible(),false);await page.getByRole('button',{name:'PDF와 함께 보기',exact:true}).click();
  await page.getByRole('button',{name:'단어 (0)',exact:true}).click();
  await page.getByLabel('여러 단어 붙여넣기',{exact:true}).fill('可用性\tかようせい\t가용성\n冗長化\t이중화\n整合性');await page.getByRole('button',{name:'붙여넣기 미리보기',exact:true}).click();await page.getByRole('button',{name:'선택한 단어 일괄 등록',exact:true}).click();await page.getByText('3개 단어를 등록했습니다. 중복 0개는 건너뛰었습니다.',{exact:true}).waitFor();
  await page.screenshot({path:qa('pdf-words-improved'),fullPage:true});
  await page.getByLabel('可用性 뜻 수정',{exact:true}).fill('시스템 가용성');await page.locator('.word-input-table tr').filter({has:page.getByLabel('可用性 뜻 수정',{exact:true})}).getByRole('button',{name:'저장',exact:true}).click();await page.getByText('저장됨',{exact:true}).waitFor();
  assert.equal((await call('get','/api/workspace/entries')).find(e=>e.kind==='WORD'&&e.title==='可用性').body,'시스템 가용성');
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.feature-sidebar').getBoundingClientRect().right<=1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'PDF mobile width');await page.screenshot({path:qa('pdf-mobile-polished'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
  await page.getByText('한 단어씩 추가',{exact:true}).click();await page.getByLabel('단어',{exact:true}).fill('Spring');await page.getByLabel('뜻 / 예문',{exact:true}).fill('스프링 프레임워크');await page.getByLabel('언어',{exact:true}).selectOption('en');
  await page.getByRole('button',{name:'단어 저장',exact:true}).click();await page.getByText('단어를 저장했습니다.',{exact:true}).waitFor();
  await page.goto(`${base}/learning/words`);await page.locator('.word-library-row').first().waitFor();await page.locator('.word-library-row input[type=checkbox]').first().click();await page.waitForFunction(()=>document.querySelector('.word-library-row input[type=checkbox]')?.checked);
  await page.getByRole('button',{name:'Spring 편집',exact:true}).click();await page.getByLabel('뜻 / 예문',{exact:true}).fill('수정한 뜻');await page.locator('.ws-inline-editor,.learning-entry-composer').getByRole('button',{name:'저장',exact:true}).click();await page.locator('.ws-inline-editor,.learning-entry-composer').waitFor({state:'hidden'});
  assert.equal((await call('get','/api/workspace/entries')).find(e=>e.kind==='WORD'&&e.title==='Spring').body,'수정한 뜻');
  await page.goto(`${base}/settings`);await page.getByLabel('홈에서 AI 채팅 사용',{exact:true}).uncheck();await page.getByRole('checkbox',{name:'여행',exact:true}).uncheck();await page.getByRole('button',{name:'설정 저장',exact:true}).click();await page.getByText('설정을 저장했습니다.',{exact:true}).waitFor();
  await page.goto(base);await page.locator('.home-feature-card').first().waitFor();assert.equal(await page.locator('.home-feature-card').count(),3);assert.equal(await page.locator('.home-chat-dock').isVisible(),false);
  await call('patch','/api/workspace/settings',{aiEnabled:true,cards:['calendar','learning','ledger','travel']});
  for(const size of [{width:1366,height:768},{width:1280,height:640},{width:1440,height:900}]) {
    await page.setViewportSize(size);await page.goto(base);await page.locator('.home-feature-card').first().waitFor();await page.getByText('총자산 ₩4,418,000',{exact:true}).waitFor();
    assert.ok(await page.evaluate(()=>{const total=document.querySelector('.home-feature-card.is-green .home-card-summary strong'),summary=total.parentElement;const a=total.getBoundingClientRect(),b=summary.getBoundingClientRect();return a.height>=parseFloat(getComputedStyle(total).lineHeight)-1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;}),'Home total assets must remain fully visible on laptops');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight+1),'Home must not create a document scrollbar on laptops');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Home must not overflow horizontally');
    const composer=await page.locator('.home-chat-dock').boundingBox();const lastCard=await page.locator('.home-feature-card').last().boundingBox();assert.ok(lastCard.y+lastCard.height<=composer.y+1,'Home cards must remain above the composer');
    if(size.width===1366){await page.screenshot({path:qa('home-laptop'),fullPage:true});await page.getByRole('button',{name:'대화 열기'}).click();const chat=await page.locator('.home-chat-dock').boundingBox();const heading=await page.locator('.workspace-heading').boundingBox();assert.ok(chat.y>=heading.y+heading.height,'Chat must not overlap the heading');assert.ok(chat.y+chat.height<=size.height,'Chat stays in viewport');assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight+1),'Expanded chat must not create a document scrollbar');await page.locator('.home-chat-dock').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:qa('chat-laptop'),fullPage:true});await page.getByRole('button',{name:'대화 접기'}).click();}
    await page.goto(`${base}/calendar`);await page.locator('.calendar-grid').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight+1),'Calendar must keep outer document in viewport');
    await page.waitForFunction(()=>[...document.querySelectorAll('.calendar-grid.is-month .calendar-event')].every(el=>el.getBoundingClientRect().bottom<=el.parentElement.getBoundingClientRect().bottom+1));
    assert.ok(await page.locator('.calendar-cell.today .calendar-event').count()>0,'Daily items remain visible alongside long projects');
    assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.calendar-grid.is-month .calendar-event')].every(el=>el.getBoundingClientRect().bottom<=el.closest('.calendar-cell').getBoundingClientRect().bottom+1)),'Daily calendar entries must not clip below their cell');
    await page.locator('.calendar-project-more').first().click();await page.locator('.ws-inline-editor,.learning-entry-composer').locator('.calendar-project-row').first().waitFor();await page.locator('.ws-inline-editor,.learning-entry-composer').getByRole('button',{name:'편집 닫기',exact:true}).click();
    if(size.width===1366)await page.screenshot({path:qa('calendar-laptop'),fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base);await page.locator('.home-feature-card').first().waitFor();await page.locator('.mika-dock-input').waitFor();
  const dock=await page.locator('.home-chat-dock').boundingBox();assert.ok(dock.height<220,'Collapsed mobile chat must not cover the dashboard');
  const inputBox=await page.locator('.mika-dock-input').boundingBox();assert.ok(await page.evaluate(({x,y})=>Boolean(document.elementFromPoint(x,y)?.closest('.home-chat-dock')),{x:inputBox.x+inputBox.width/2,y:inputBox.y+inputBox.height/2}),'Mobile navigation must not cover the AI input');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Mobile horizontal overflow');
  await page.screenshot({path:qa('home-mobile'),fullPage:true});
  await page.locator('.mika-dock-input').fill('모바일 대화');await page.locator('.mika-dock-input').press('Enter');await page.getByRole('button',{name:'대화 접기'}).waitFor();assert.ok(await page.locator('.mika-dialogue-stream').isVisible());await page.getByRole('button',{name:'대화 접기'}).click();
  await page.goto(`${base}/calendar`);await page.locator('.calendar-grid').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Calendar mobile overflow');await page.screenshot({path:qa('calendar-mobile'),fullPage:true});
  await page.getByRole('button',{name:'캘린더 메뉴 열기',exact:true}).click();await page.getByRole('navigation',{name:'캘린더 메뉴'}).getByRole('link',{name:'오늘 일정',exact:true}).click();await page.waitForURL('**/calendar/today');await page.waitForFunction(()=>!document.querySelector('.feature-sidebar').classList.contains('is-mobile-open'));
  await page.goto(`${base}/learning`);await page.getByRole('button',{name:'학습 메뉴 열기',exact:true}).click();await page.getByRole('navigation',{name:'학습 메뉴'}).getByRole('link',{name:'학습노트',exact:true}).click();await page.waitForURL('**/learning/records');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Learning mobile overflow');
  // Shared navigation must behave identically on state-based ledger/travel pages.
  for(const size of [{width:1366,height:768},{width:390,height:844}]) {
    await page.setViewportSize(size);
    for(const [routeName,selector,label] of [['ledger','.ledger-dashboard-page','가계부'],['planner','.personal-trip-card','여행'],['trips/qa-trip/home','.travel-daybar','여행']]) {
      await page.goto(`${base}/${routeName}`);await page.locator(selector).waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${routeName} horizontal overflow at ${size.width}`);
      if(size.width>760) {
        assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),`${routeName} document overflow`);
        assert.equal(Math.round((await page.locator('.feature-sidebar').boundingBox()).width),260);
        await page.getByRole('button',{name:'사이드바 접기',exact:true}).click();
        assert.equal(Math.round((await page.locator('.feature-sidebar').boundingBox()).width),76);
        await page.getByRole('button',{name:'사이드바 펼치기',exact:true}).click();
      } else {
        assert.equal(await page.locator('.feature-layout').evaluate(el=>getComputedStyle(el).paddingLeft),'0px',`${routeName} mobile must use full content width`);
        await page.waitForFunction(()=>document.querySelector('.feature-sidebar').getBoundingClientRect().right<=1);
        await page.getByRole('button',{name:`${label} 메뉴 열기`,exact:true}).click();
        const navigation=page.getByRole('navigation',{name:`${label} 메뉴`,exact:true});
        if(routeName==='ledger')await navigation.getByRole('button',{name:'계좌',exact:true}).click();
        else await navigation.getByRole('link',{name:'여행 목록',exact:true}).click();
        await page.waitForFunction(()=>!document.querySelector('.feature-sidebar').classList.contains('is-mobile-open'));
        await page.waitForFunction(()=>document.querySelector('.feature-sidebar').getBoundingClientRect().right<=1);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${routeName} menu destination overflow`);
        if(routeName==='ledger') {
          const tile=await page.locator('.ledger-account-tile').first().boundingBox();
          assert.ok(tile.width>=300,'Mobile account cards must not stay in three narrow columns');
        }
      }
      await page.screenshot({path:qa(`${routeName.replaceAll('/','-')}-${size.width>760?'bright-laptop':'bright-mobile'}`),fullPage:true});
    }
  }
  assert.deepEqual(errors,[],'Unexpected JavaScript errors');
  console.log('PASS: home cards, AI expansion/collapse, calendar checklist persistence, learning task/note/comment, PDF upload/notes, word editing/mastery, settings persistence, mobile layouts.');
} catch(error) {await page.screenshot({path:qa('failure'),fullPage:true});throw error;} finally {await browser.close();}





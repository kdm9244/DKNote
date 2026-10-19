// Targeted notice layout/editor checks. All API writes are mocked.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4182'],{stdio:'ignore'});
const browser=await chromium.launch({channel:'chrome',headless:true});
const anon=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'}),page=await anon.newPage();
page.setDefaultTimeout(10000);
await mkdir('../.local/notices-qa',{recursive:true});
const notices=[{id:'new',title:'더 편리해진 PDF와 학습노트',releaseVersion:'2026.10.19',createdAt:'2026-10-19T12:00:00',body:Array.from({length:13},(_,i)=>`${i+1}. ${['PDF 글자를 드래그해서 선택하고 복사할 수 있습니다.','학습노트 표의 행과 열을 자유롭게 편집할 수 있습니다.','등록한 투자 거래의 수수료와 세금을 수정할 수 있습니다.'][i%3]}`).join('\n'),version:0},
 {id:'old',title:'지난 업데이트',releaseVersion:'1.0',createdAt:'2026-10-17T12:00:00',body:'• 모바일 화면을 개선했습니다.\n• 일정 화면을 정리했습니다.',version:0}];
const errors=[],unexpected=[];let failPublic=false,failSave=false,posted=null;
const installRoutes=async(context,publisher)=>{
 await context.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,method=req.method();if(!path.startsWith('/api/'))return route.continue();
  const json=(data,status=200)=>route.fulfill({status,json:data});
  if(path==='/api/auth/policy')return json({signupEnabled:false});
  if(path==='/api/notices/public'){
   assert.equal(req.headers().authorization,undefined,'public notices should not send an application credential');
   return failPublic?json({message:'검증용 장애'},500):json(notices);
  }
  if(path==='/api/users/myProfile')return json({userId:'publisher',email:'publisher',role:'NOTICE_PUBLISHER'});
  if(path==='/api/notices'){
   assert.ok(publisher);
   if(method==='GET')return json({canManage:false,canPublish:true,notices});
   if(failSave)return json({message:'저장 실패 · 입력 내용은 유지됩니다.'},500);
   posted={...req.postDataJSON(),id:'posted',version:0,createdAt:'2026-10-19T20:00:00'};notices.unshift(posted);return json(posted,201);
  }
  unexpected.push(path);return json({message:'Unmocked API'},501);
 });
};
const overflow=async p=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
try{
 await installRoutes(anon,false);page.on('pageerror',e=>errors.push(e.message));await new Promise(resolve=>setTimeout(resolve,1000));
 await page.goto('http://127.0.0.1:4182/login');const panel=page.getByRole('complementary',{name:'업데이트 소식'});await panel.getByRole('heading',{name:notices[0].title}).waitFor();
 for(const size of [{width:1366,height:900},{width:1280,height:720}]){
  await page.setViewportSize(size);await overflow(page);const news=await panel.boundingBox(),login=await page.locator('.auth-login-content').boundingBox();assert.ok(news.x+news.width<=login.x);assert.ok(news.y>=0&&news.y+news.height<=size.height);assert.equal(await panel.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
 }
 assert.equal(await panel.locator('.notice-body li').count(),13);
 await panel.locator('.auth-updates-content').evaluate(e=>e.scrollTop=e.scrollHeight);await panel.getByRole('button',{name:'이전 소식 ›',exact:true}).click();await panel.getByRole('heading',{name:'지난 업데이트'}).waitFor();assert.equal(await panel.locator('.auth-updates-content').evaluate(e=>e.scrollTop),0);
 await panel.getByRole('button',{name:'‹ 최신 소식',exact:true}).click();await panel.getByRole('heading',{name:notices[0].title}).waitFor();await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'../.local/notices-qa/login-desktop.png',fullPage:true});
 for(const width of [360,390,768]){
  await page.setViewportSize({width,height:844});await overflow(page);const news=await panel.boundingBox(),login=await page.locator('.auth-login-content').boundingBox();assert.ok(news.y>=login.y+login.height,'mobile announcements must follow the login form');
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'../.local/notices-qa/login-mobile.png',fullPage:true});
 await page.setViewportSize({width:1366,height:900});failPublic=true;await page.reload();await page.getByText('소식을 불러오지 못했습니다.',{exact:true}).waitFor();await page.getByLabel('아이디 또는 이메일').fill('my-account');failPublic=false;await page.getByRole('button',{name:'다시 불러오기',exact:true}).click();await panel.getByRole('heading',{name:notices[0].title}).waitFor();assert.equal(await page.getByLabel('아이디 또는 이메일').inputValue(),'my-account');
 await page.goto('http://127.0.0.1:4182/signup');assert.equal(await page.locator('.auth-updates').count(),0);

 const pub=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await pub.addInitScript(()=>sessionStorage.setItem('accessToken','ui-test'));await installRoutes(pub,true);const writer=await pub.newPage();writer.setDefaultTimeout(10000);writer.on('pageerror',e=>errors.push(e.message));
 await writer.goto('http://127.0.0.1:4182/updates');await writer.getByRole('button',{name:'공지 작성',exact:true}).click();
 const composer=writer.getByRole('region',{name:'공지 작성',exact:true});await composer.getByLabel('제목',{exact:true}).fill('오늘의 업데이트');await composer.getByLabel('버전',{exact:true}).fill('1.2');await composer.getByLabel('업데이트 내용',{exact:true}).fill('PDF 글자를 선택할 수 있습니다.\n학습노트 표를 편집할 수 있습니다.');
 await composer.getByLabel('업데이트 내용',{exact:true}).evaluate(e=>e.setSelectionRange(0,e.value.length));await composer.getByRole('button',{name:'• 목록 넣기',exact:true}).click();assert.ok((await composer.getByLabel('업데이트 내용',{exact:true}).inputValue()).startsWith('• '));
 const preview=composer.getByRole('complementary',{name:'공지 미리보기'});assert.equal(await preview.locator('.notice-body li').count(),2);await preview.getByRole('heading',{name:'오늘의 업데이트',exact:true}).waitFor();await overflow(writer);await writer.screenshot({path:'../.local/notices-qa/editor-desktop.png',fullPage:true});
 for(const width of [360,390]){
  await writer.setViewportSize({width,height:844});await composer.getByRole('button',{name:'미리보기',exact:true}).click();assert.ok(await preview.isVisible());assert.equal(await composer.getByLabel('업데이트 내용',{exact:true}).isVisible(),false);await overflow(writer);await writer.screenshot({path:`../.local/notices-qa/editor-mobile-${width}.png`,fullPage:true});await composer.getByRole('button',{name:'작성',exact:true}).click();assert.ok((await composer.getByLabel('업데이트 내용',{exact:true}).inputValue()).includes('PDF'));
 }
 failSave=true;await composer.getByRole('button',{name:'공지 저장',exact:true}).click();await writer.getByRole('alert').filter({hasText:'저장 실패'}).waitFor();assert.equal(await composer.getByLabel('제목',{exact:true}).inputValue(),'오늘의 업데이트');failSave=false;await composer.getByRole('button',{name:'공지 저장',exact:true}).click();await composer.waitFor({state:'hidden'});await writer.getByRole('heading',{name:'오늘의 업데이트',exact:true}).waitFor();
 await page.goto('http://127.0.0.1:4182/login');await page.getByRole('complementary',{name:'업데이트 소식'}).getByRole('heading',{name:'오늘의 업데이트',exact:true}).waitFor();assert.equal(posted.releaseVersion,'1.2');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log('PASS: anonymous opaque login notice panel, desktop/mobile placement and scroll, history navigation, failure retry without losing login fields, signup isolation, composer bullets/live preview/mobile tabs/save failure/retry, published content on login. APIs mocked.');
}catch(e){console.error({url:page.url(),errors,unexpected});throw e;}finally{await browser.close();server.kill();}

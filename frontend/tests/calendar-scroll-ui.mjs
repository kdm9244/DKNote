// Calendar scroll-container regression. APIs are mocked; no application data changes.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4185'],{stdio:'ignore'});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:2560,height:1390},timezoneId:'Asia/Seoul',reducedMotion:'reduce'}),page=await context.newPage();
page.setDefaultTimeout(10000);await mkdir('../.local/calendar-scroll-qa',{recursive:true});
await context.addInitScript(()=>sessionStorage.setItem('accessToken','calendar-ui'));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const checks=Array.from({length:11},(_,i)=>({id:`c${i}`,title:`준비 항목 ${i+1} — 일정에 필요한 내용을 확인하세요.`,done:false}));
const item=(id,kind,title,extra={})=>({id,kind,title,body:'',details:{},version:0,position:0,createdAt:'2026-10-19T12:00:00',...extra});
const entries=[...Array.from({length:14},(_,i)=>item(`e${i}`,'EVENT',`확인할 일정 ${i+1}`,{startDate:today,endDate:today,details:{allDay:true,color:'#6b90c8',checks:i===0?checks:[]}})),...Array.from({length:18},(_,i)=>item(`template${i}`,'TEMPLATE',`준비물 템플릿 ${i+1}`,{details:{checks}}))];
const settings={calendarView:'month',weekStart:0,hiddenCalendarIds:[]},errors=[],unexpected=[];
await context.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname,json=data=>route.fulfill({json:data});
 if(path==='/api/users/myProfile')return json({userId:'calendar-ui',email:'ui@example.com',nickname:'검증 사용자',provider:'LOCAL',role:'USER'});
 if(path==='/api/workspace/entries')return json(entries);
 if(path==='/api/workspace/settings')return json(settings);
 if(path==='/api/calendar/google/status')return json({tokenAvailable:false,calendarReady:false});
 unexpected.push(path);return route.fulfill({status:501,json:{message:'Unexpected API'}});
});
page.on('pageerror',e=>errors.push(e.message));
const routes=['/calendar','/calendar/today','/calendar/events','/calendar/templates','/calendar/sources'];
const visit=async path=>{await page.goto(`http://127.0.0.1:4185${path}?date=${today}`);await page.locator('.workspace-heading h1').waitFor();await page.locator('.calendar-workspace,.calendar-subpage').first().waitFor();};
const geometry=()=>page.evaluate(()=>{
 const main=document.querySelector('.workspace-main'),heading=document.querySelector('.workspace-heading'),sidebar=document.querySelector('.feature-sidebar'),rect=main.getBoundingClientRect(),head=heading.getBoundingClientRect(),side=sidebar.getBoundingClientRect();
 return {right:rect.right,left:rect.left,width:rect.width,headingLeft:head.left,headingWidth:head.width,sidebarRight:side.right,viewport:innerWidth,horizontal:document.documentElement.scrollWidth>innerWidth+1,scrollHeight:main.scrollHeight,clientHeight:main.clientHeight};
});
try {
 await new Promise(r=>setTimeout(r,900));
 await visit('/calendar');
 if(process.env.CALENDAR_SCROLL_BASELINE){console.log('BASELINE',await geometry());await page.screenshot({path:'../.local/calendar-scroll-qa/before-wide.png',fullPage:true});}
 for(const width of [2560,1920,1366,1024,768]){
  await page.setViewportSize({width,height:width===2560?1390:900});
  for(const path of routes){
   await visit(path);const bounds=await geometry();assert.ok(Math.abs(bounds.right-width)<=1,`${path} ${width}px: scroll edge ${bounds.right} must reach screen edge`);assert.equal(bounds.horizontal,false,`${path}: horizontal overflow`);
   const expectedLeft=bounds.left+Math.max(28,(bounds.width-1740)/2+28);assert.ok(Math.abs(bounds.headingLeft-expectedLeft)<=18,`${path}: content must remain centered`);
   if(width===2560)await page.screenshot({path:`../.local/calendar-scroll-qa/${path.split('/').at(-1)||'calendar'}-wide.png`,fullPage:true});
   if(path==='/calendar/today'){
    assert.ok(bounds.scrollHeight>bounds.clientHeight,'fixture must exercise actual page scrolling');
    await page.locator('.workspace-main').evaluate(e=>e.scrollTop=e.scrollHeight);assert.ok(await page.locator('.workspace-main').evaluate(e=>e.scrollTop>100));
    const last=page.locator('.calendar-event-card').last();await last.getByRole('button',{name:'상세 보기',exact:true}).click();await page.locator('.ws-inline-editor').waitFor();await page.locator('.ws-inline-editor').getByRole('button',{name:'닫기',exact:true}).click();
   }
  }
  await visit('/calendar/today');await page.getByRole('button',{name:'사이드바 접기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.feature-layout').classList.contains('feature-collapsed'));assert.ok(Math.abs((await geometry()).right-width)<=1,'collapsed sidebar scroll edge');
 }
 for(const width of [390,360]){
  await page.setViewportSize({width,height:844});
  for(const path of routes){await visit(path);assert.equal((await geometry()).horizontal,false);}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log('PASS: all five calendar routes scroll at screen edge on 2560/1920/1366/1024/768px, centered content, expanded/collapsed sidebar, long-list scrolling and detail access, 390/360px no overflow. APIs mocked.');
}catch(e){console.error({url:page.url(),errors,unexpected,geometry:await geometry()});throw e;}
finally{await browser.close();server.kill();}

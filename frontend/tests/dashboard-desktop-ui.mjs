// Desktop dashboard QA with representative, entirely mocked financial records.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4181','--strictPort'],{stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('Local:'))resolve();});server.on('exit',code=>reject(new Error('Preview exited '+code)));setTimeout(()=>reject(new Error('Preview timeout')),15000).unref();});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:960},timezoneId:'Asia/Seoul',reducedMotion:'reduce'});
await context.addInitScript(()=>sessionStorage.setItem('accessToken','dashboard-qa'));
await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
const page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(30000);
await page.clock.setFixedTime(new Date('2026-11-21T03:00:00Z'));
const errors=[],unexpected=[];page.on('pageerror',e=>errors.push(e.message));
let empty=false,failRates=false;
const account=(id,name,type,balance,currency='KRW')=>({accountId:id,accountName:name,accountType:type,cachedBookBalance:balance,currency,isActive:true,bankName:'DK Bank',displayOrder:Number(id)});
const accounts=[account('1','생활비 통장','CHECKING',2360000),account('2','목돈 모으기','SAVINGS',12000000),account('3','주식 투자','INVESTMENT',1280000),account('4','일본 생활비','FOREIGN_CURRENCY',50000,'JPY'),account('5','주택 대출','DEBT',-3400000)];
const labels=['식비·카페','교통','생활비','문화·여가'];
const records=Array.from({length:21},(_,i)=>({transactionId:'t'+i,accountId:'1',accountName:'생활비 통장',transactionDate:'2026-11-'+String(i+1).padStart(2,'0')+'T12:00:00',transactionType:'EXPENSE',title:['점심 식사','교통카드 충전','주말 장보기','문화 생활'][i%4],category:labels[i%4],amount:(i%6+1)*9500+(i%7===0?80000:0),currency:'KRW'}));
records.push({transactionId:'income',accountName:'생활비 통장',transactionDate:'2026-11-20T09:00:00',transactionType:'INCOME',title:'이번 달 급여',category:'급여',amount:3900000,currency:'KRW'});
const expense=records.filter(t=>t.transactionType==='EXPENSE').reduce((sum,t)=>sum+t.amount,0);
const categories=labels.map(category=>{const amount=records.filter(t=>t.category===category).reduce((sum,t)=>sum+t.amount,0);return {category,amount,currency:'KRW',ratio:amount/expense*100};}).sort((a,b)=>b.amount-a.amount);
await context.route('**/api/**',async r=>{
 const u=new URL(r.request().url()),p=u.pathname;
 if(!p.startsWith('/api/'))return r.continue();
 const json=data=>r.fulfill({json:data});
 if(p==='/api/users/myProfile')return json({userId:'qa',role:'USER',email:'qa@example.com'});
 if(p==='/api/workspace/entries')return json([]);
 if(p==='/api/workspace/settings')return json({});
 if(p==='/api/ledger/accounts')return json({accounts:empty?[]:accounts,totalAccounts:empty?0:accounts.length});
 if(p==='/api/ai/exchange-rate')return failRates?r.fulfill({status:503,json:{message:'QA rate unavailable'}}):json({rate:940,baseUnit:100,provider:'QA'});
 if(p==='/api/ledger/dashboard'){
   const prior=u.searchParams.get('from')?.startsWith('2026-10');
   return json({month:prior?'2026-10':'2026-11',generatedAt:'2026-11-21T12:00:00',monthlyExpense:empty?{}:{KRW:prior?expense*.8:expense,JPY:12800},monthlyIncome:empty?{}:{KRW:3900000},monthlyNetCashFlow:{},categorySpending:empty?[]:categories,recentTransactions:empty?[]:records.map(t=>prior?{...t,transactionDate:t.transactionDate.replace('2026-11','2026-10'),amount:t.transactionType==='EXPENSE'?t.amount*.8:t.amount}:t).sort((a,b)=>b.transactionDate.localeCompare(a.transactionDate)),investment:{accountCount:empty?0:1,totals:empty?[]:[{currency:'KRW',marketValue:8300000,cashBalance:1280000,totalAsset:9580000}]},debt:{}});
 }
 unexpected.push(p);return r.fulfill({status:501,json:{message:'Unexpected API'}});
});
await mkdir('../.local/dashboard-desktop-qa',{recursive:true});
const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page horizontal overflow');
try{
 await page.goto('http://127.0.0.1:4181/ledger');
 await page.getByRole('heading',{name:'지출 흐름',exact:true}).waitFor();
 await page.locator('.overview-allocation-legend').getByText('외화',{exact:true}).waitFor();
 for(const viewport of [{width:1440,height:960},{width:1366,height:768},{width:1920,height:1080}]){
   await page.setViewportSize(viewport);await noOverflow();
   const boxes=await page.locator('.overview-metric').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y};}));
   assert.equal(boxes.length,4);assert.ok(boxes.every(b=>Math.abs(b.y-boxes[0].y)<2),'desktop KPIs must share a row');
   const chart=await page.locator('.overview-flow').boundingBox(), allocation=await page.locator('.overview-allocation').boundingBox();
   assert.ok(Math.abs(chart.y-allocation.y)<2&&allocation.x>chart.x,'chart and allocation must share a row');
   assert.ok((await page.locator('.overview-transactions').boundingBox()).y<viewport.height,'recent transactions visible in first viewport');
   await page.screenshot({path:'../.local/dashboard-desktop-qa/dashboard-'+viewport.width+'.png',fullPage:true});
 }
 await page.getByRole('button',{name:'일별 지출',exact:true}).click();assert.equal(await page.getByRole('button',{name:'일별 지출',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.overview-spending-chart rect').count(),21);
 await page.getByLabel('대시보드 거래 통화').selectOption('JPY');assert.match(await page.getByRole('button',{name:/이번 달 사용액/}).innerText(),/12,800/);
 await page.getByLabel('대시보드 거래 통화').selectOption('KRW');
 await page.setViewportSize({width:390,height:844});await noOverflow();await page.screenshot({path:'../.local/dashboard-desktop-qa/dashboard-mobile.png',fullPage:true});
 failRates=true;await page.reload();await page.getByRole('button',{name:'환율 다시 조회'}).waitFor();assert.match(await page.locator('.overview-metric').first().innerText(),/환율 확인 필요/);
 empty=true;failRates=false;await page.reload();await page.getByText('아직 이번 달 거래가 없습니다.',{exact:true}).waitFor();await noOverflow();
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log('PASS desktop KPI/grid density at 1366/1440/1920, daily chart, currency switch, mobile, missing FX and empty states');
}finally{await browser.close();server.kill();}

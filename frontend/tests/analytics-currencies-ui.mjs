// All financial data and exchange rates are mocked; no user records are changed.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4182','--strictPort'],{stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('Local:'))resolve();});server.on('exit',c=>reject(new Error('Server exit '+c)));setTimeout(()=>reject(new Error('Server timeout')),15000).unref();});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});
await context.addInitScript(()=>sessionStorage.setItem('accessToken','qa'));
await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
const page=await context.newPage();page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(30000);
const errors=[],unexpected=[];page.on('pageerror',e=>errors.push(e.message));let failRate=false,foreignOnly=false;
const rows=[['KRW',10000,'원화 점심'],['JPY',1000,'엔화 점심'],['USD',10,'달러 교통']].map(([currency,amount,title],i)=>({transactionId:'t'+i,transactionDate:'2026-11-01T12:00:00',transactionType:'EXPENSE',title,category:i<2?'식비':'교통',amount,currency,accountName:currency+' 계좌'}));
await context.route('**/api/**',async r=>{
 const u=new URL(r.request().url()),p=u.pathname,json=data=>r.fulfill({json:data});
 if(!p.startsWith('/api/'))return r.continue();
 if(p==='/api/users/myProfile')return json({userId:'qa',role:'USER'});
 if(p==='/api/workspace/entries')return json([]);
 if(p==='/api/workspace/settings')return json({});
 if(p==='/api/ledger/accounts')return json({accounts:[],totalAccounts:0});
 if(p==='/api/ai/exchange-rate')return failRate?r.fulfill({status:503,json:{message:'QA failed quote'}}):json(u.searchParams.get('base')==='JPY'?{rate:940,baseUnit:100,provider:'QA'}:{rate:1400,baseUnit:1,provider:'QA'});
 if(p==='/api/ledger/investment-accounts/transactions')return json([{tradeType:'PROFIT_SETTLEMENT',accountCurrency:'JPY',realizedProfitLoss:-100},{tradeType:'SELL',accountCurrency:'USD',realizedProfitLoss:2}]);
 if(p==='/api/ledger/dashboard')return json({month:'2026-11',monthlyExpense:foreignOnly?{JPY:1000,USD:10}:{KRW:10000,JPY:1000,USD:10},monthlyIncome:{KRW:50000,JPY:2000,USD:20},monthlyNetCashFlow:{},categorySpending:(foreignOnly?rows.slice(1):rows).map(row=>({category:row.category,amount:row.amount,currency:row.currency,ratio:100})),recentTransactions:foreignOnly?rows.slice(1):rows,investment:{totals:[]},debt:{}});
 unexpected.push(p);return r.fulfill({status:501,json:{message:'Unexpected API'}});
});
const open=async()=>{await page.goto('http://127.0.0.1:4182/ledger');await page.getByRole('button',{name:'통계',exact:true}).click();await page.getByRole('heading',{name:'통화별 내역'}).waitFor();};
await mkdir('../.local/analytics-currencies-qa',{recursive:true});
try{
 await open();assert.equal(await page.getByLabel('통계 통화').inputValue(),'ALL');
 await page.locator('.ledger-kpi-card').first().getByText('₩33,400',{exact:true}).waitFor();
 await page.locator('.ledger-kpi-card').nth(3).getByText('₩1,860',{exact:true}).waitFor();
 const trades=page.locator('.ledger-card').filter({has:page.getByRole('heading',{name:'기간 내 거래',exact:true})});
 for(const title of ['원화 점심','엔화 점심','달러 교통'])await trades.getByText(title,{exact:false}).waitFor();
 assert.equal(await trades.locator('tbody tr').count(),3);assert.match(await trades.innerText(),/JP¥1,000/);assert.match(await trades.innerText(),/\$10/);
 const categories=page.locator('.ledger-card').filter({has:page.getByRole('heading',{name:'카테고리별 사용액',exact:true})});assert.equal(await categories.getByText('식비',{exact:true}).count(),1);assert.match(await categories.innerText(),/19,400/);
 await page.screenshot({path:'../.local/analytics-currencies-qa/all-desktop.png',fullPage:true});
 await page.getByLabel('통계 통화').selectOption('JPY');assert.equal(await trades.locator('tbody tr').count(),1);await trades.getByText('엔화 점심',{exact:false}).waitFor();assert.match(await trades.innerText(),/JP¥1,000/);
 await page.getByLabel('통계 통화').selectOption('ALL');await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'../.local/analytics-currencies-qa/all-mobile.png',fullPage:true});
 await page.setViewportSize({width:1366,height:900});failRate=true;await open();await page.getByRole('button',{name:'환율 다시 조회',exact:true}).waitFor();assert.match(await page.locator('.ledger-kpi-card').first().innerText(),/환율 확인 필요/);assert.equal(await trades.locator('tbody tr').count(),3);assert.match(await categories.innerText(),/JP¥1,000/);
 failRate=false;await page.getByRole('button',{name:'환율 다시 조회',exact:true}).click();await page.locator('.ledger-kpi-card').first().getByText('₩33,400',{exact:true}).waitFor();
 foreignOnly=true;await open();await trades.getByText('엔화 점심',{exact:false}).waitFor();assert.equal(await trades.locator('tbody tr').count(),2);await page.locator('.ledger-kpi-card').first().getByText('₩23,400',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log('PASS default all currencies, KRW-equivalent totals/categories/profit, original trade currencies, filtering, mobile, FX failure/retry, foreign-only expenses');
}catch(e){console.error({errors,unexpected,body:(await page.locator('body').innerText()).slice(-2600)});await page.screenshot({path:'../.local/analytics-currencies-qa/failure.png',fullPage:true});throw e;}finally{await browser.close();server.kill();}

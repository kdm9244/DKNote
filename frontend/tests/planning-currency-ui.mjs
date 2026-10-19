// Planning currency regressions; all writes are mocked.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4188'],{stdio:'ignore'});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100},timezoneId:'Asia/Seoul',reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(10000);
await context.addInitScript(()=>sessionStorage.setItem('accessToken','planning-test'));
await mkdir('../.local/planning-currency-qa',{recursive:true});
const errors=[],unexpected=[],writes=[],plans=new Map(),budgets=new Map(),goals=[];
let loadFail=false;
page.on('pageerror',e=>errors.push(e.message));
const accounts=['KRW','JPY','USD'].map((currency,i)=>({accountId:`a${i}`,accountName:`${currency} 생활비`,accountType:'CHECKING',currency,cachedBookBalance:100000,isActive:true}));
const initial={KRW:100000,JPY:200000,USD:1000};
const key=(month,currency)=>`${month}:${currency}`;
const snapshot=(month,currency)=>{
 const id=key(month,currency),plan=plans.get(id)||{expectedIncome:initial[currency],savingsTarget:0,investmentTarget:0,debtRepaymentTarget:0,memo:''};
 const rows=budgets.get(id)||[{categoryName:'식비 · 카페',budgetAmount:currency==='JPY'?1000:currency==='USD'?100:10000}];
 const actual=currency==='JPY'?860:currency==='USD'?20.5:3000;
 return {targetMonth:month,currency,...plan,actualIncome:initial[currency],actualExpense:actual,fixedExpenseAmount:0,categoryBudgetTotal:rows.reduce((sum,r)=>sum+r.budgetAmount,0),availableAmount:1000,dailyAvailableAmount:100,categoryBudgets:rows.map(r=>({...r,actualAmount:actual})),goals:goals.filter(g=>g.currency===currency)};
};
await context.route('**/api/**',async route=>{
 const req=route.request(),url=new URL(req.url()),p=url.pathname,body=req.method()==='GET'?null:req.postDataJSON(),json=value=>route.fulfill({json:value});
 if(p==='/api/workspace/entries')return json([]);
 if(p==='/api/workspace/settings')return json({});
 if(p==='/api/users/myProfile')return json({userId:'u',nickname:'검증 사용자',role:'USER'});
 if(p==='/api/ledger/accounts')return json({accounts,totalAccounts:accounts.length,totalCachedBalance:100000});
 if(p==='/api/ledger/taxes/residences')return json([]);
 if(p==='/api/ledger/planning')return loadFail?route.fulfill({status:503,json:{message:'계획 조회 실패 테스트'}}):json(snapshot(url.searchParams.get('month'),url.searchParams.get('currency')));
 if(p==='/api/ledger/planning/monthly'){writes.push(body);plans.set(key(body.targetMonth,body.currency),body);return route.fulfill({status:204});}
 if(p==='/api/ledger/planning/budgets'){writes.push(body);budgets.set(key(body.targetMonth,body.currency),body.budgets);return route.fulfill({status:204});}
 if(p==='/api/ledger/planning/goals'&&body){writes.push(body);const goal={...body,goalId:`g${goals.length}`,currentAmount:body.initialAmount,progressRate:0,status:'IN_PROGRESS'};goals.push(goal);return json(goal);}
 if(p.endsWith('/contributions')&&body){writes.push(body);const goal=goals.find(g=>p.includes(`/${g.goalId}/`));goal.currentAmount+=body.amount;return json(goal);}
 unexpected.push(p);return route.fulfill({status:501,json:{message:'Unexpected API'}});
});
const visit=path=>page.goto(`http://127.0.0.1:4188${path}`);
const row=()=>page.locator('.budget-table-row').filter({has:page.getByLabel('식비 · 카페 예산',{exact:true})});
const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
try{
 await new Promise(r=>setTimeout(r,800));await visit('/ledger?tab=settings');
 await page.getByLabel('자금 계획 기본 통화').selectOption('JPY');await page.getByRole('button',{name:'저장',exact:true}).click();
 await page.getByRole('button',{name:'자금 계획',exact:true}).click();await page.getByLabel('계획 통화',{exact:true}).waitFor();assert.equal(await page.getByLabel('계획 통화',{exact:true}).inputValue(),'JPY');
 await row().getByText('JP¥860',{exact:true}).waitFor();await row().getByText('JP¥140',{exact:true}).waitFor();assert.equal(await row().getByText('₩860',{exact:true}).count(),0);
 await page.getByLabel('예상 수입',{exact:true}).fill('250000');await page.getByLabel('식비 · 카페 예산',{exact:true}).fill('2000');await page.getByRole('button',{name:'계획 저장',exact:true}).click();await page.getByLabel('예상 수입',{exact:true}).waitFor();assert.equal(writes.at(-1).currency,'JPY');await row().getByText('JP¥1,140',{exact:true}).waitFor();
 await page.screenshot({path:'../.local/planning-currency-qa/planning-desktop.png',fullPage:true});
 await page.getByLabel('계획 통화',{exact:true}).selectOption('KRW');await page.getByLabel('예상 수입',{exact:true}).waitFor();assert.equal(await page.getByLabel('예상 수입',{exact:true}).inputValue(),'100000');await row().getByText('₩3,000',{exact:true}).waitFor();
 await page.getByLabel('예상 수입',{exact:true}).fill('123');page.once('dialog',d=>d.dismiss());await page.getByLabel('계획 통화',{exact:true}).selectOption('USD');assert.equal(await page.getByLabel('계획 통화',{exact:true}).inputValue(),'KRW');assert.equal(await page.getByLabel('예상 수입',{exact:true}).inputValue(),'123');
 page.once('dialog',d=>d.accept());loadFail=true;await page.getByLabel('계획 통화',{exact:true}).selectOption('USD');await page.getByRole('alert').filter({hasText:'계획 조회 실패 테스트'}).waitFor();loadFail=false;await page.getByRole('button',{name:'다시 불러오기',exact:true}).click();await row().getByText('US$20.50',{exact:true}).waitFor();
 await page.getByLabel('계획 통화',{exact:true}).selectOption('JPY');await page.getByLabel('예상 수입',{exact:true}).waitFor();assert.equal(await page.getByLabel('예상 수입',{exact:true}).inputValue(),'250000');
 await page.reload();await page.getByRole('button',{name:'자금 계획',exact:true}).click();await page.getByLabel('계획 통화',{exact:true}).waitFor();assert.equal(await page.getByLabel('계획 통화',{exact:true}).inputValue(),'JPY');
 for(const width of [768,390,360]){await page.setViewportSize({width,height:1000});await noOverflow();}await page.screenshot({path:'../.local/planning-currency-qa/planning-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1100});await page.getByRole('button',{name:/목표·위시리스트/}).click();await page.getByRole('button',{name:'첫 목표 만들기',exact:true}).click();
 await page.getByLabel('목표 이름 *',{exact:true}).fill('엔화 여행');await page.getByLabel('목표 금액 *',{exact:true}).fill('10000');await page.getByLabel('연결 적립 계좌',{exact:true}).waitFor();assert.equal(await page.getByLabel('연결 적립 계좌',{exact:true}).locator('option').count(),2);await page.getByLabel('연결 적립 계좌',{exact:true}).selectOption('a1');await page.getByRole('button',{name:'목표 저장',exact:true}).click();await page.getByRole('heading',{name:'엔화 여행',exact:true}).waitFor();assert.equal(writes.at(-1).currency,'JPY');
 await page.getByRole('button',{name:'목표에 적립하기',exact:true}).click();await page.getByLabel('적립 금액 *',{exact:true}).fill('500');assert.equal(await page.getByLabel('출금 계좌',{exact:true}).locator('option').count(),1);await page.getByRole('button',{name:'적립 반영',exact:true}).click();await page.locator('.goal-amount-line').getByText('JP¥500',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);console.log('PASS planning currency setting/persistence, ¥860 category display, currency-specific saves and switching, unsaved changes guard, load failure/retry, USD decimals, matching goal accounts/contributions, desktop/mobile overflow. APIs mocked.');
}catch(e){console.error({errors,unexpected,text:(await page.locator('body').innerText()).slice(-1800)});throw e;}finally{await browser.close();server.kill();}

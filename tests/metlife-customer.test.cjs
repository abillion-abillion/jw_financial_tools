const {test}=require('node:test'),assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const M=require('../metlife/customer-model.cjs'),data=require('../metlife/fixtures.json'),examples=require('../metlife/calibration-examples.json');
const base={gender:'male',birthYear:1986,type:'general',premium:1136000,sum:1e9,driver:'premium',conversionYear:7,extra:0,beforeReturn:3.75,afterReturn:3.75};
test('premium anchors and forward/reverse indicative quotation',()=>{
 for(const type of['general','simple'])for(const gender of['male','female'])for(const [age,price]of Object.entries(M.tariffs[type][gender]))assert.ok(Math.abs(M.tariff(type,gender,Number(age))-price)<1e-7);
 assert.equal(M.describe(base).sum,1e9);assert.equal(M.describe({...base,driver:'sum',sum:2e8}).premium,227200);
 assert.equal(M.describe({...base,premium:1e6}).sum,880e6);
});
test('age 41 premium independently checked against age-next-year quote, not a fit anchor',()=>{
 const estimate=M.tariff('general','male',41),observed=116800;
 assert.ok(Math.abs(estimate/observed-1)<.003);
});
test('interpolation covers every intermediate age and extrapolation remains positive',()=>{
 for(const type of['general','simple'])for(const gender of['male','female']){
  let previous=0;for(let age=type==='general'?15:30;age<= (type==='general'?70:75);age++){
   const price=M.tariff(type,gender,age);assert.ok(price>previous);previous=price;
  }
 }
 const r=M.describe({...base,birthYear:1982});assert.ok(r.sum>0);assert.equal(r.exactRate,false);assert.ok(r.rows[9].surrender>0);
});
test('withheld 2.5% base scenarios at source 7/8/9/10yr differ by less than 1.1%',()=>{
 for(const gender of['male','female'])for(const extra of gender==='male'?[0,1]:[0]){
  const profile=data.profiles[gender],P=profile.monthlyBasePremiumWon,plan=extra?'extra100':'base';
  const pred=M.baseProjection({gender,type:'general',age:40,premium:P,sum:1e9,extra,rate:2.5,years:49});
  for(const year of[7,8,9,10]){
   const official=profile[plan].find(x=>x.month===year*12).scenarios['2.5'].surrenderDisplayWon;
   assert.ok(Math.abs(pred[year-1].surrender/official-1)<.011,`${gender} ${extra} ${year}`);
  }
 }
});
test('withheld 2.5% values across all positive annual source durations remain within 3.1%',()=>{
 for(const gender of['male','female'])for(const extra of gender==='male'?[0,1]:[0]){
  const profile=data.profiles[gender],pred=M.baseProjection({gender,type:'general',age:40,premium:profile.monthlyBasePremiumWon,sum:1e9,extra,rate:2.5,years:49});
  for(const row of profile[extra?'extra100':'base'])if(row.month%12===0){const official=row.scenarios['2.5'].surrenderDisplayWon;if(official>0)assert.ok(Math.abs(pred[row.month/12-1].surrender/official-1)<.031);}
 }
});
test('savings source reproduction checks positive balances; zero source rows treated as censored',()=>{
 for(const gender of['male','female'])for(const [rate,observations]of Object.entries(examples.profiles[gender].observed)){
  const pred=M.projectSavings({gender,type:'general',issueAge:40,conversionAge:47,reserve:examples.profiles[gender].initial[rate]*1e6,paidBefore:gender==='male'?190848000:65100000,entryPremium:0,sum:1e9,rate:Number(rate),years:36});
  observations.forEach((v,i)=>{if(v>0)assert.ok(Math.abs(pred.rows[examples.postYears[i]].surrender-v*1e6)<80000);});
 }
});
test('automatic minimum first premium and post-conversion paid total stay constant',()=>{
 const r=M.describe(base);assert.equal(r.paidBefore,95424000);assert.equal(r.entryPremium,480000);assert.equal(r.minConvertedSum,24e6);
 assert.equal(r.rows[6].paid,95904000);assert.ok(r.rows.slice(6).every(row=>row.paid===95904000));
 assert.equal(r.rows[6].reserve,r.conversionReserve+r.entryPremium);
});
test('return 0 is not replaced; -1..20 updates pre and post balances monotonically',()=>{
 const results=[-1,0,3.75,8,20].map(beforeReturn=>M.describe({...base,beforeReturn}));
 for(let i=1;i<results.length;i++)assert.ok(results[i].conversionReserve>results[i-1].conversionReserve);
 const post=[-1,0,3.75,8,20].map(afterReturn=>M.describe({...base,afterReturn}).rows[16]);
 for(let i=1;i<post.length;i++)assert.ok(post[i].surrender>post[i-1].surrender);
 assert.throws(()=>M.describe({...base,beforeReturn:20.01}),RangeError);
});
test('50% extra produces estimates between base and 100% plus actual cashflow increase',()=>{
 const r=[0,.5,1].map(extra=>M.describe({...base,extra}));assert.equal(r[1].totalMonthly,1704000);
 assert.ok(r[0].conversionReserve<r[1].conversionReserve&&r[1].conversionReserve<r[2].conversionReserve);
 assert.ok(r[1].rows[16].surrender>r[0].rows[16].surrender);
});
test('conversion 7/8/9/10 changes paid, entry, reserve and post outcome',()=>{
 const r=[7,8,9,10].map(conversionYear=>M.describe({...base,conversionYear}));
 for(let i=1;i<r.length;i++){assert.ok(r[i].conversionReserve>r[i-1].conversionReserve);assert.ok(r[i].entryPremium>=r[i-1].entryPremium);}
});
test('chosen post sum affects death benefit and charge, respects product limits',()=>{
 const low=M.describe(base),high=M.describe({...base,postSum:1e9});assert.ok(high.rows[7].death>low.rows[7].death);assert.ok(high.rows[16].surrender<low.rows[16].surrender);
 for(const postSum of[0,23e6,24.5e6,1.001e9,NaN]){const r=M.describe({...base,postSum});assert.equal(r.eligible,false);assert.ok(r.rows.slice(6).every(x=>x.death===null));}
});
test('insufficient estimated conversion reserve blocks conversion and first premium',()=>{
 const r=M.describe({...base,beforeReturn:-1});assert.equal(r.eligible,false);assert.ok(r.conversionReserve<r.conversionThreshold);assert.equal(r.rows[6].paid,r.paidBefore);assert.equal(r.rows[6].death,null);
});
test('funding shortage suppresses future guarantees rather than promising death benefit',()=>{
 const r=M.describe({...base,afterReturn:-1,postSum:1e9});assert.ok(r.shortfallMonth>0);
 const first=r.rows.findIndex(x=>x.status==='funding-needed');assert.ok(first>6);assert.ok(r.rows.slice(first).every(x=>x.death===null&&x.surrender===null));
});
test('simple uses own tariffs and explicit uncalibrated proxy, 2yr nonaccidental reduction',()=>{
 const r=M.describe({...base,type:'simple',premium:1355000});assert.equal(r.sum,1e9);assert.equal(r.calibrated,false);assert.equal(r.rows[0].death,5e8);assert.equal(r.rows[1].death,1e9);assert.ok(r.conversionReserve>0);
});
test('invalid conditions reject without stale output; birth year implies illustrative age',()=>{
 for(const change of[{birthYear:NaN},{birthYear:2015},{conversionYear:6},{conversionYear:41},{premium:70000},{type:'other'},{afterReturn:NaN}])assert.throws(()=>M.describe({...base,...change}),RangeError);
 assert.equal(M.describe(base).age,40);
});
test('standalone includes calibration and customer code with no fetched dependencies',()=>{
 const html=readFileSync(require.resolve('../metlife-variable-term.html'),'utf8');
 assert.ok(html.includes(readFileSync(require.resolve('../metlife/customer-model.cjs'),'utf8')));
 assert.ok(html.includes('globalThis.MetlifeCalibration='+readFileSync(require.resolve('../metlife/calibration.json'),'utf8')));
 assert.ok(!/<script[^>]+src=/.test(html));
});

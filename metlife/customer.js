(function(){
'use strict';const root=document.getElementById('customer-workbench'),data=JSON.parse(document.getElementById('metlife-fixtures').textContent),M=globalThis.MetlifeCustomer;
const state={gender:'male',birthYear:1986,type:'general',premium:1136000,sum:1000000000,driver:'premium',conversionYear:7,extra:0,beforeReturn:3.75,afterReturn:3.75};let zoom=true,postTouched=false;
const n=(v,d=0)=>v.toLocaleString('ko-KR',{maximumFractionDigits:d});const won=v=>v===null||!Number.isFinite(v)?'산출 제외':n(Math.round(v))+'원';const $=id=>document.getElementById('c-'+id);
root.innerHTML=`<div class="customer-layout"><aside class="customer-inputs"><h2>고객 조건 입력</h2><p class="customer-kicker">값을 바꾸면 바로 반영됩니다</p>
<label for="c-gender">성별</label><select id="c-gender"><option value="male">남성</option><option value="female">여성</option></select>
<label for="c-birth">출생연도 <output id="c-age"></output></label><div class="unit-input"><input id="c-birth" type="number" step="1" value="1986"><span>년생</span></div>
<label for="c-type">가입형</label><select id="c-type"><option value="general">일반가입형</option><option value="simple">간편가입형</option></select>
<label for="c-premium">월 기본보험료 <output id="c-premium-label"></output></label><input id="c-premium-range" type="range" aria-label="월 기본보험료 조절" min="8" max="500" step="0.01" value="113.6"><div class="unit-input"><input id="c-premium" type="number" min="8" step="0.01" value="113.6"><span>만원</span></div>
<label for="c-sum">보험가입금액 <output id="c-sum-label"></output></label><div class="unit-input"><input id="c-sum" type="number" min="1000" step="100" value="100000"><span>만원</span></div>
<p id="c-price-note" class="customer-note"></p>
<label>납입기간 / 보험기간</label><div class="locked-period">전기납 / 90세 만기</div>
<label for="c-conversion">적립형 전환 시점</label><div class="unit-input"><input id="c-conversion" type="number" min="7" max="40" step="1" value="7"><span>년 후</span></div>
<label for="c-extra">납입방식</label><select id="c-extra"><option value="0">기본납입</option><option value="0.5">기본 + 추가납입 50%</option><option value="1">기본 + 추가납입 100%</option></select>
<label for="c-before">전환 전 연 투자수익률 <output id="c-before-label">3.75%</output></label><input id="c-before-range" aria-label="전환 전 수익률 조절" type="range" min="-1" max="20" step="0.05" value="3.75"><div class="unit-input"><input id="c-before" type="number" min="-1" max="20" step="0.05" value="3.75"><span>%</span></div>
<label for="c-after">전환 후 연 투자수익률 <output id="c-after-label">3.75%</output></label><input id="c-after-range" aria-label="전환 후 수익률 조절" type="range" min="-1" max="20" step="0.05" value="3.75"><div class="unit-input"><input id="c-after" type="number" min="-1" max="20" step="0.05" value="3.75"><span>%</span></div>
<label for="c-post-sum">적립형 전환 후 가입금액</label><div class="unit-input"><input id="c-post-sum" type="number" step="100"><span>만원</span></div><p id="c-post-bounds" class="customer-note"></p>
<div class="auto-summary"><span>월 총 납입액</span><strong id="c-total">—</strong><span>전환 당일 최저 초회보험료</span><strong id="c-entry">—</strong><p>초회보험료 자동 설정 · 전환 후 정기납입 0원 가정</p></div></aside>
<main class="customer-results"><span class="eyebrow">METLIFE · FINANCIAL PLANNING</span><h1>보장과 자산의 흐름을<br>한눈에 비교하세요.</h1><p>메트라이프 변액리치정기보험 · 기준일 2026.10.28</p><div id="c-status" class="customer-status" role="status" aria-live="polite"></div>
<section class="customer-cards"><article><span>보험가입금액 · 추정 환산</span><strong id="c-sum-result">—</strong></article><article><span>전환 전 총 납입예산</span><strong id="c-paid-result">—</strong></article><article><span>전환 직전 추정 적립금</span><strong id="c-min-sum">—</strong></article></section>
<section class="panel customer-chart-panel"><div class="section-top"><h2>납입액 · 사망보장 · 환급금</h2><button id="c-zoom" class="button">전체 기간 보기</button></div><div class="customer-legend"><span class="blue">● 누적 납입액</span><span class="gold">● 사망보험금 · 추정</span><span class="green">● 해약환급금 · 추정</span></div><div id="c-chart"></div><p class="customer-note">동일한 원 단위 축, 0원 기준입니다. 전환 후 정기납입은 0원이며 초회 최저보험료는 포함합니다. 전환 후는 종신 계약을 90세까지만 예시합니다. 사망보험금과 환급금은 합산 수령액이 아닙니다.</p></section>
<section class="panel"><h2>적립형 전환 결과</h2><div id="c-converted" class="customer-status"></div><div id="c-post-cards" class="customer-cards post-cards"></div><p class="customer-note">추정 적립금이 전환 기준을 충족하는 경우만 전환 후를 계산합니다. 비용 재원이 부족해지면 이후 보장·환급금 산출을 중단합니다. 실제 전환 심사·납입최고·실효일은 가입설계에서 확인합니다.</p></section><section class="panel"><h2>7 · 8 · 9 · 10년 전환 비교</h2><p class="customer-note">각 시점에 전환한 뒤 10년이 지난 결과입니다. 기본 설정은 각 전환시점의 최저 가입금액이며, 가입금액을 직접 수정하면 같은 금액으로 비교합니다.</p><div id="c-comparisons" class="conversion-comparisons"></div></section>
<section class="panel"><h2>연도별 금액</h2><div class="table-scroll"><table><thead><tr><th>경과</th><th>나이 예시</th><th>누적 납입액</th><th>사망보험금 · 추정</th><th>해약환급금 · 추정</th><th>환급률</th></tr></thead><tbody id="c-rows"></tbody></table></div></section>
<section class="panel estimate-method"><h2>상담 예시용 추정 모델입니다</h2><p>보험료는 리플렛의 남녀·일반/간편 연령별 예시를 연결한 참고 환산입니다. 환급금은 일반가입형 40세 설계서의 여러 수익률 사례를 이용해 월별 합산 공제비용을 역산했습니다. 실제 위험보험료·사업비를 각각 복원한 값은 아닙니다.</p><p>다른 나이·금액·추가납입 50%는 확장 추정이며, 간편형은 보험료 차이를 비용에 반영한 임시 추정이며, 첫 2년은 재해 이외 사망의 가입금액 50% 감액을 가정합니다. 전환 후 초회보험료는 전액 투입으로 가정하고, 월별 추정 비용과 보증비용을 차감합니다. 실제 초회 공제·해약공제와 차이가 날 수 있습니다.</p><p>입력 수익률은 펀드 기준가 기준의 가정입니다. 보정 범위인 -1~3.75%를 벗어나면 오차가 더 커질 수 있으며, 높은 수익률을 예상·보장하지 않습니다. 출생연도는 연나이 예시이므로 실제 보험나이는 다를 수 있습니다. 모든 금액은 세전 예시입니다. 최종 금액과 가입·전환 가능 여부는 반드시 보험사의 가입설계로 확인합니다.</p></section></main></div>`;
function chart(result){const W=Math.max(260,Math.min(850,$('chart').clientWidth||850)),H=330,L=70,T=20,R=25,B=45,maxYear=zoom?Math.min(90-result.age,state.conversionYear+15):90-result.age;const rows=result.rows.filter(r=>r.year<=maxYear);const vals=rows.flatMap(r=>[r.paid,r.death,r.surrender]).filter(v=>v!==null);const max=Math.max(1,...vals)*1.12;const x=y=>L+y/maxYear*(W-L-R),yy=v=>H-B-v/max*(H-T-B);let out=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="누적 납입액, 추정 사망보험금, 추정 해약환급금. 산출 제외 기간은 생략합니다.">`;
for(let i=0;i<=4;i++){const v=max*i/4;out+=`<line x1="${L}" x2="${W-R}" y1="${yy(v)}" y2="${yy(v)}" stroke="#d7e2ed"/><text x="${L-10}" y="${yy(v)+6}" text-anchor="end" font-size="16" fill="#3d5369">${n(v/1e8,2)}억</text>`;}
for(let i=0;i<=4;i++){const y=Math.round(maxYear*i/4);out+=`<text x="${x(y)}" y="${H-12}" text-anchor="middle" font-size="16">${y}년</text>`;}
for(const [key,color]of[['paid','#245baf'],['death','#be7412'],['surrender','#008268']]){let prior=null;for(const row of rows){if(row[key]===null){prior=null;continue;}if(prior)out+=`<path d="M${x(prior.year)} ${yy(prior[key])} L${x(row.year)} ${yy(row[key])}" fill="none" stroke="${color}" stroke-width="4"/>`;out+=`<circle cx="${x(row.year)}" cy="${yy(row[key])}" r="5" fill="${color}"><title>${row.year}년 ${key==='paid'?'누적 납입액':key==='death'?row.deathKind:'추정 환급금'} ${won(row[key])}</title></circle>`;prior=row;}}
out+=`<line x1="${x(state.conversionYear)}" x2="${x(state.conversionYear)}" y1="${T}" y2="${H-B}" stroke="#8d4b83" stroke-dasharray="6 6"/><text x="${x(state.conversionYear)-7}" y="${T+16}" text-anchor="end" font-size="16" fill="#733366">${state.conversionYear}년 전환</text></svg>`;$('chart').innerHTML=out;}
const estimated=v=>v===null||!Number.isFinite(v)?'산출 제외':'약 '+won(Math.round(v/10000)*10000);
const pct=v=>v===null||!Number.isFinite(v)?'—':n(v,1)+'%';
function comparison(){
 $('comparisons').innerHTML=[7,8,9,10].map(year=>{
  try{
   const result=M.describe({...state,conversionYear:year,postSum:postTouched?Number($('post-sum').value)*10000:undefined});
   const row=result.rows.find(r=>r.year===year+10);
   return `<article class="conversion-compare ${year===state.conversionYear?'selected':''}"><h3>${year}년 후 전환</h3><span>전환 직전 적립금</span><strong>${estimated(result.conversionReserve)}</strong><span>전환 후 가입금액</span><b>${estimated(result.postSum)}</b><span>전환 10년 뒤 환급금</span><strong class="green">${result.eligible?estimated(row?.surrender??null):'전환 산출 제외'}</strong><span>환급률 ${result.eligible?pct(row?.refundRate??null):'—'}</span><p>${result.conversionConstraints||(!row?'90세 예시 범위 밖':row.status==='funding-needed'?'비용 재원 부족으로 산출 제외':'초회 납입 후 정기납입 0원')}</p></article>`;
  }catch(e){return `<article class="conversion-compare"><h3>${year}년 후 전환</h3><p>${e.message}</p></article>`;}
 }).join('');
}
function render(){
 $('before-label').textContent=Number.isFinite(state.beforeReturn)?n(state.beforeReturn,2)+'%':'입력 확인';
 $('after-label').textContent=Number.isFinite(state.afterReturn)?n(state.afterReturn,2)+'%':'입력 확인';
 try{
  const result=M.describe({...state,postSum:postTouched?Number($('post-sum').value)*10000:undefined});
  $('age').textContent='연나이 예시 '+result.age+'세';$('conversion').max=Math.min(80-result.age,89-result.age);
  $('price-note').textContent='1억원당 월 '+won(Math.round(result.rate))+' · '+(result.exactRate?'리플렛 예시요율':'예시 연령 사이 보간·범위 밖 외삽')+' · 보험사 견적과 차이가 있습니다.';
  if(state.driver==='premium'){state.sum=result.sum;$('sum').value=result.sum/10000;}
  else{state.premium=result.premium;$('premium').value=result.premium/10000;$('premium-range').value=result.premium/10000;}
  $('premium-label').textContent=won(result.premium);$('sum-label').textContent=won(result.sum);$('sum-result').textContent=estimated(result.sum);
  $('total').textContent=won(result.totalMonthly);$('entry').textContent=won(result.entryPremium);$('paid-result').textContent=won(result.paidBefore);$('min-sum').textContent=estimated(result.conversionReserve);
  if(!postTouched)$('post-sum').value=result.minConvertedSum/10000;
  $('post-sum').min=result.minConvertedSum/10000;$('post-sum').max=result.sum/10000;
  $('post-bounds').textContent='100만원 단위 · '+won(result.minConvertedSum)+' 이상 / '+won(result.sum)+' 이하';
  $('status').textContent='상담 예시용 추정치입니다. 실제 금액은 가입설계로 확인해 주세요.'+(state.type==='simple'?' 간편형 비용은 임시 추정이며 전용 설계서 보정 전입니다.':result.age!==40?' 선택 나이는 40세 설계서에서 확장한 추정입니다.':'')+(state.beforeReturn>3.75||state.afterReturn>3.75?' 3.75% 초과 수익률은 보정 범위 밖의 가정입니다.':'');
  const targetYear=state.conversionYear+10,row=result.rows.find(r=>r.year===targetYear);
  const shortage=result.shortfallMonth===null?'':` 전환 약 ${n(result.shortfallMonth/12,1)}년 뒤 비용 재원 부족이 예상되어 이후 산출을 중단합니다.`;
  $('converted').textContent=result.conversionConstraints||`${state.conversionYear}년 후 전환 가정 · 초회 ${won(result.entryPremium)} 납입 후 정기납입 0원. 전환 기준 ${estimated(result.conversionThreshold)} / 추정 적립금 ${estimated(result.conversionReserve)}.${shortage}`;
  $('post-cards').innerHTML=[['전환 10년 뒤 사망보험금',result.eligible?estimated(row?.death??null):'산출 제외'],['전환 10년 뒤 해약환급금',result.eligible?estimated(row?.surrender??null):'산출 제외'],['전환 10년 뒤 환급률',result.eligible?pct(row?.refundRate??null):'—']].map(([label,value])=>`<article><span>${label}</span><strong>${value}</strong></article>`).join('');
  chart(result);
  $('rows').innerHTML=result.rows.map(r=>`<tr><td>${r.year}년${r.year===state.conversionYear?' · 전환':''}</td><td>${r.age}세</td><td>${won(r.paid)}</td><td>${estimated(r.death)}</td><td>${estimated(r.surrender)}</td><td>${pct(r.refundRate)}</td></tr>`).join('');
  comparison();
 }catch(e){
  $('age').textContent='나이·조건 확인 필요';$('status').textContent=e.message;
  for(const id of['sum-result','total','entry','paid-result','min-sum','premium-label','sum-label'])$(id).textContent='입력 확인 필요';
  $('price-note').textContent='입력 조건을 확인해 주세요.';$('post-bounds').textContent='입력 확인 후 한도를 계산합니다.';$('chart').innerHTML='';$('rows').innerHTML='';$('post-cards').innerHTML='';$('comparisons').innerHTML='';$('converted').textContent='조건을 확인해 주세요.';
 }
}
root.addEventListener('input',event=>{const id=event.target.id,raw=event.target.value;
if(id==='c-post-sum'){postTouched=true;render();return;}
const fields={'c-birth':'birthYear','c-conversion':'conversionYear','c-extra':'extra','c-gender':'gender','c-type':'type'};
if(fields[id])state[fields[id]]=id==='c-gender'||id==='c-type'?raw:raw===''?NaN:Number(raw);
if(id==='c-premium'||id==='c-premium-range'){state.premium=raw===''?NaN:Number(raw)*10000;state.driver='premium';$(id==='c-premium'?'premium-range':'premium').value=raw;}
if(id==='c-sum'){state.sum=raw===''?NaN:Number(raw)*10000;state.driver='sum';}
for(const key of ['before','after'])if(id==='c-'+key||id==='c-'+key+'-range'){state[key+'Return']=raw===''?NaN:Number(raw);$(id.endsWith('-range')?key:key+'-range').value=raw;}
if(id!=='c-post-sum'&&id!=='c-after'&&id!=='c-after-range')postTouched=false;render();
});$('zoom').addEventListener('click',()=>{zoom=!zoom;$('zoom').textContent=zoom?'전체 기간 보기':'전환 전후 확대';render();});window.addEventListener('resize',render);render();
})();

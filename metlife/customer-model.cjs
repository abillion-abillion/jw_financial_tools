(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./calibration.json'):root.MetlifeCalibration);if(typeof module==='object'&&module.exports)module.exports=api;else root.MetlifeCustomer=api;})(typeof globalThis==='object'?globalThis:this,function(calibration){
'use strict';
// All forecast amounts are illustrative estimates, never insurer quotations.
// Premium anchors: launch leaflet PDF p5, 90세만기·전기납·가입금액 1억원.
const tariffs={general:{male:{20:71000,30:88400,40:113600,50:153000,60:219300,70:348400},female:{20:49400,30:61000,40:77500,50:102600,60:144800,70:229400}},simple:{male:{30:105600,40:135500,50:181700,60:256700,70:386900},female:{30:75300,40:95400,50:125300,60:173000,70:262300}}};
function logInterpolate(age,ages,values){
 let i=0;while(i<ages.length-2&&age>ages[i+1])i++;
 return Math.exp(Math.log(values[i])+(age-ages[i])/(ages[i+1]-ages[i])*Math.log(values[i+1]/values[i]));
}
function tariff(type,gender,age){const table=tariffs[type][gender],ages=Object.keys(table).map(Number);return logInterpolate(age,ages,ages.map(a=>table[a]));}
function charge(gender,kind,age){const p=calibration[gender][kind];return logInterpolate(age,p.ages,p.annualChargePerBillionWon);}
// Simple underwriting has its own premium anchors. Its COST multiplier is only a proxy;
// no simple-underwriting surrender-value illustration has yet been calibrated.
function typeMultiplier(type,gender,age){return type==='simple'?tariff('simple',gender,age)/tariff('general',gender,age):1;}
function baseProjection({gender,type,age,premium,sum,extra,rate,years}){
 const p=calibration[gender].base,g=Math.pow(1+rate/100,1/12),rows=[];
 let basic=0,additional=0;
 const multiplier=typeMultiplier(type,gender,age);
 for(let m=0;m<years*12;m++){
  const load=p.loadings[m<84?0:m<120?1:2];
  basic+=premium*(1-load);
  // Month 2 catches up the first month's additional premium.
  additional+=premium*extra*(m===0?0:m===1?2:1)*(1-p.extraLoading);
  const reserve=basic+additional;
  const risk=Math.max(sum+premium*extra*(m+1)-reserve,0);
  const cost=charge(gender,'base',age+m/12)*multiplier*risk/1e9/12+sum*.00011/12+Math.max(reserve,0)*p.balanceRate/12;
  basic=(basic-cost)*g;additional*=g;
  const penalty=premium*12*p.penaltyAnnualPremiums*Math.max(1-(m+1)/84,0);
  const surrender=m<84?Math.max(basic-penalty,0)+additional:Math.max(basic+additional,0);
  if((m+1)%12===0){
   const year=(m+1)/12,paid=premium*(1+extra)*(m+1),A=Math.max(basic+additional,0);
   const basicBenefit=sum*(type==='simple'&&m+1<24?.5:1)+premium*extra*(m+1);
   rows.push({year,age:age+year,paid,reserve:A,surrender,death:Math.max(basicBenefit,A*1.05,paid),refundRate:surrender/paid*100,deathKind:'보장형 추정',status:'estimated'});
  }
 }
 return rows;
}
function projectSavings({gender,type,issueAge,conversionAge,reserve,paidBefore,entryPremium,sum,rate,years,entryInvested=entryPremium}){
 const p=calibration[gender].savings,g=Math.pow(1+rate/100,1/12),paid=paidBefore+entryPremium,rows=[];
 let A=reserve+entryInvested,shortfallMonth=null;
 const multiplier=typeMultiplier(type,gender,issueAge);
 // The source's 0년납 projection excludes entry premium from its displayed paid total.
 // Production scenarios explicitly add the mandatory first payment; no further payments.
 rows.push({year:0,paid,reserve:A,surrender:A,death:Math.max(sum+A,paid),refundRate:A/paid*100,status:'estimated',deathKind:'적립형 추정'});
 for(let m=0;m<years*12;m++){
  if(shortfallMonth===null){
   const risk=Math.max(sum,paid-A,0);
   const cost=charge(gender,'savings',conversionAge+m/12)*multiplier*risk/1e9/12+A*(.0015+p.balanceRate)/12;
   if(A<=cost){shortfallMonth=m+1;A=0;}else A=(A-cost)*g;
  }
  if((m+1)%12===0)rows.push({year:(m+1)/12,paid,reserve:shortfallMonth===null?A:null,surrender:shortfallMonth===null?A:null,death:shortfallMonth===null?Math.max(sum+A,paid):null,refundRate:shortfallMonth===null?A/paid*100:null,status:shortfallMonth===null?'estimated':'funding-needed',deathKind:'적립형 추정'});
 }
 return {rows,shortfallMonth};
}
function describe(input){
 const age=2026-input.birthYear;
 if(!Number.isInteger(input.birthYear))throw new RangeError('출생연도를 정수로 입력해 주세요.');
 if(!['male','female'].includes(input.gender)||!['general','simple'].includes(input.type))throw new RangeError('가입형과 성별을 선택해 주세요.');
 if(age<(input.type==='general'?15:30)||age>(input.type==='general'?70:75))throw new RangeError('90세 만기의 예시 가입나이 범위는 일반 15~70세, 간편 30~75세입니다.');
 if(![0,.5,1].includes(input.extra))throw new RangeError('추가납입 비율을 확인해 주세요.');
 if(!Number.isInteger(input.conversionYear)||input.conversionYear<7||input.conversionYear>Math.min(80-age,89-age))throw new RangeError('전환시점은 7년 이후·전환나이 80세 이하·기본만기 전이어야 합니다.');
 for(const r of [input.beforeReturn,input.afterReturn])if(!Number.isFinite(r)||r< -1||r>20)throw new RangeError('수익률은 -1~20% 범위입니다.');
 if(input.driver!=='sum'&&(!Number.isFinite(input.premium)||input.premium<80000))throw new RangeError('주계약 단독 화면의 월 기본보험료는 8만원 이상으로 입력해 주세요.');
 const rate=tariff(input.type,input.gender,age),exactRate=Object.hasOwn(tariffs[input.type][input.gender],age);
 let sum=input.driver==='premium'?Math.floor((input.premium/rate*1e8+1e-5)/1e6)*1e6:input.sum;
 let premium=input.driver==='premium'?input.premium:Math.round(sum/1e8*rate);
 if(!Number.isFinite(sum)||sum<1e7||sum>(input.type==='general'?5e9:2e9))throw new RangeError('가입금액 범위는 일반 1천만~50억원, 간편 1천만~20억원입니다.');
 if(premium<80000)throw new RangeError('환산 기본보험료가 8만원 미만입니다. 가입금액을 높여 주세요.');
 const totalMonthly=premium*(1+input.extra),paidBefore=totalMonthly*input.conversionYear*12;
 const entryPremium=Math.ceil(Math.max(100000,paidBefore*.005)/10000)*10000;
 const minConvertedSum=Math.ceil(entryPremium*50/1e6)*1e6;
 const postSum=input.postSum??minConvertedSum;
 const boundsError=!Number.isFinite(postSum)||postSum<minConvertedSum||postSum>sum||postSum%1e6!==0;
 const before=baseProjection({gender:input.gender,type:input.type,age,premium,sum,extra:input.extra,rate:input.beforeReturn,years:input.conversionYear});
 const conversionReserve=before.at(-1).reserve,threshold=Math.max(paidBefore*.7,1e6);
 let conversionConstraints=entryPremium>sum*.02||minConvertedSum>sum?'전환 초회보험료와 가입금액 한도를 동시에 충족하지 못합니다.':null;
 if(!conversionConstraints&&conversionReserve<threshold)conversionConstraints='추정 적립금이 전환 기준(납입액 70%·100만원 중 큰 금액)에 미달합니다.';
 if(!conversionConstraints&&boundsError)conversionConstraints='전환 후 가입금액을 최저·최고 한도 안에서 100만원 단위로 입력해 주세요.';
 const eligible=!conversionConstraints;
 const horizon=90-age-input.conversionYear;
 const post=eligible?projectSavings({gender:input.gender,type:input.type,issueAge:age,conversionAge:age+input.conversionYear,reserve:conversionReserve,paidBefore,entryPremium,sum:postSum,rate:input.afterReturn,years:horizon}):null;
 const rows=before.slice(0,-1);
 for(let y=input.conversionYear;y<=90-age;y++){
  const r=post?.rows[y-input.conversionYear];
  rows.push(r?{...r,year:y,age:age+y}:{year:y,age:age+y,paid:paidBefore,surrender:null,reserve:null,death:null,refundRate:null,status:'conversion-unavailable',deathKind:'전환 미성립'});
 }
 return {age,ageBasis:'연나이 예시(생월일 미반영)',rate,exactRate,sum,premium,totalMonthly,paidBefore,entryPremium,minConvertedSum,postSum,conversionReserve,conversionThreshold:threshold,conversionConstraints,eligible,rows,before,shortfallMonth:post?.shortfallMonth??null,needsRates:false,hasOfficialValues:false,projectionLimitAge:90,calibrated:input.type==='general'&&age===40};
}
return Object.freeze({describe,tariffs,tariff,logInterpolate,baseProjection,projectSavings,calibration});
});

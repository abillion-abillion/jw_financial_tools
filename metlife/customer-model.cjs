(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MetlifeCustomer=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
// Attachment: 신상품 리플렛, PDF p5, 90세만기·가입금액1억. Sparse illustrative rates only.
const tariffs={general:{male:{20:71000,30:88400,40:113600,50:153000,60:219300,70:348400},female:{20:49400,30:61000,40:77500,50:102600,60:144800,70:229400}},simple:{male:{30:105600,40:135500,50:181700,60:256700,70:386900},female:{30:75300,40:95400,50:125300,60:173000,70:262300}}};
function describe(input,data){
 const year=2026;const age=year-input.birthYear;
 if(!Number.isInteger(input.birthYear))throw new RangeError('출생연도를 정수로 입력해 주세요.');
 if(!['male','female'].includes(input.gender)||!['general','simple'].includes(input.type))throw new RangeError('가입형과 성별을 선택해 주세요.');
 if(age<(input.type==='general'?15:30)||age>(input.type==='general'?70:75))throw new RangeError('90세 만기의 예시 가입나이 범위를 벗어났습니다. 생월일에 따른 실제 보험나이는 별도 확인해야 합니다.');
 if(![0,.5,1].includes(input.extra))throw new RangeError('추가납입 비율을 확인해 주세요.');
 if(!Number.isInteger(input.conversionYear)||input.conversionYear<7||input.conversionYear>Math.min(80-age,90-age-1))throw new RangeError('전환시점은 7년 이후이며 전환나이 80세 이하·기본만기 전이어야 합니다.');
 for(const r of [input.beforeReturn,input.afterReturn])if(!Number.isFinite(r)||r< -1||r>20)throw new RangeError('수익률은 -1~20% 범위입니다.');
 if(!Number.isFinite(input.premium)||input.premium<80000)throw new RangeError('주계약 단독 화면의 월 기본보험료는 8만원 이상으로 입력해 주세요.');
 const rate=tariffs[input.type][input.gender][age]??null;
 let sum=input.sum;
 let premium=input.premium;
 if(input.driver==='premium')sum=rate?Math.floor(premium/rate*100000000/1000000)*1000000:null;
 else if(rate)premium=Math.round(sum/100000000*rate);
 if(sum!==null&&(!Number.isFinite(sum)||sum<10000000||sum>(input.type==='general'?5000000000:2000000000)))throw new RangeError('가입금액 범위는 일반 1천만~50억원, 간편 1천만~20억원입니다.');
 if(premium<80000)throw new RangeError('환산 기본보험료가 8만원 미만입니다. 가입금액을 높여 주세요.');
 if(!rate)return {age,ageBasis:'연나이 예시(생월일 미반영)',rate:null,sum:input.driver==='sum'?input.sum:null,premium:input.driver==='premium'?input.premium:null,totalMonthly:null,paidBefore:null,entryPremium:null,minConvertedSum:null,conversionConstraints:'해당 나이의 요율표 필요',rows:[],needsRates:true,hasOfficialValues:false};
 // Cashflow is an illustrative budget, not an insurer premium quote.
 const totalMonthly=premium*(1+input.extra);
 const paidBefore=totalMonthly*input.conversionYear*12;
 const entryPremium=Math.ceil(Math.max(100000,paidBefore/200)/10000)*10000;
 const minConvertedSum=Math.ceil(entryPremium*50/1000000)*1000000;
 const conversionConstraints=sum===null?'전환 전 가입금액 확인 필요':entryPremium>sum*.02||minConvertedSum>sum?'전환 최저 기본보험료와 가입금액 한도를 동시에 충족하지 못합니다.':null;
 let profile=null;
 if(age===40&&input.type==='general'&&sum===1000000000&&premium===data.profiles[input.gender].monthlyBasePremiumWon){const plan=input.extra===0?'base':input.extra===1?'extra100':null;if(plan&&data.profiles[input.gender][plan])profile=data.profiles[input.gender][plan];}
 const officialRate=data.rates.includes(String(input.beforeReturn))?String(input.beforeReturn):null;
 const rows=[];
 for(let y=1;y<=90-age;y++){
   const paid=totalMonthly*Math.min(y,input.conversionYear)*12+(y>=input.conversionYear?entryPremium:0);
   const source=profile&&officialRate&&y<input.conversionYear?profile.find(r=>r.month===y*12):null;
   const floor = sum!==null&&y<input.conversionYear?Math.max(sum*(input.type==='simple'&&y<2?.5:1)+premium*input.extra*y*12,totalMonthly*y*12):null;
   rows.push({year:y,age:age+y,paid,surrender:source?source.scenarios[officialRate].surrenderDisplayWon:null,death:source?.scenarios[officialRate].deathDisplayWon??floor,deathKind:source?.scenarios[officialRate].deathDisplayWon!=null?'공식 예시':'최저보장 산식(가입·정상납입 가정)'});
 }
 const conversionReferenceSurrender=profile&&officialRate?profile.find(r=>r.month===input.conversionYear*12)?.scenarios[officialRate].surrenderDisplayWon??null:null;
 return{conversionReferenceSurrender,age,ageBasis:'연나이 예시(생월일 미반영)',rate,sum,premium,totalMonthly,paidBefore,entryPremium,minConvertedSum,conversionConstraints,rows,needsRates:!rate,hasOfficialValues:rows.some(r=>r.surrender!==null)};
}
return Object.freeze({describe,tariffs});
});

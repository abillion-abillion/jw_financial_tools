// Independent forward checks against source observations, not optimizer residuals.
const fs=require('node:fs'),path=require('node:path');
const M=require('../metlife/customer-model.cjs'),data=require('../metlife/fixtures.json'),examples=require('../metlife/calibration-examples.json');
function metrics(rows){return {count:rows.length,maxAbsoluteWon:Math.round(Math.max(...rows.map(x=>Math.abs(x.predicted-x.observed)))),meanAbsoluteRelativePercent:rows.reduce((a,x)=>a+Math.abs(x.predicted/x.observed-1)*100,0)/rows.length,maxAbsoluteRelativePercent:Math.max(...rows.map(x=>Math.abs(x.predicted/x.observed-1)*100)),maxRefundRateDifferencePercentagePoints:Math.max(...rows.map(x=>Math.abs(x.predicted-x.observed)/x.paid*100))};}
const heldout=[],nearConversion=[],savings=[];
for(const gender of['male','female'])for(const extra of gender==='male'?[0,1]:[0]){
 const profile=data.profiles[gender],P=profile.monthlyBasePremiumWon;
 const pred=M.baseProjection({gender,type:'general',age:40,premium:P,sum:1e9,extra,rate:2.5,years:49});
 for(const row of profile[extra?'extra100':'base'])if(row.month%12===0&&row.scenarios['2.5'].surrenderDisplayWon>0){
  const y=row.month/12,check={gender,extra,year:y,observed:row.scenarios['2.5'].surrenderDisplayWon,predicted:pred[y-1].surrender,paid:P*(1+extra)*row.month};heldout.push(check);if(y>=7&&y<=10)nearConversion.push(check);
 }
}
for(const gender of['male','female'])for(const [rate,obs]of Object.entries(examples.profiles[gender].observed)){
 const paid=gender==='male'?190848000:65100000;
 const pred=M.projectSavings({gender,type:'general',issueAge:40,conversionAge:47,reserve:examples.profiles[gender].initial[rate]*1e6,paidBefore:paid,entryPremium:0,sum:1e9,rate:Number(rate),years:36});
 obs.forEach((amount,i)=>{if(amount>0)savings.push({gender,rate,postYear:examples.postYears[i],observed:amount*1e6,predicted:pred.rows[examples.postYears[i]].surrender,paid});});
}
const report={version:'0.4',scope:'Example-only; not actuarial certification or an accuracy guarantee outside these source cases.',baseTrainingReturns:[-1,3.75],withheldBaseReturn:2.5,heldoutBaseAnnual:metrics(heldout),heldoutBaseYears7to10:metrics(nearConversion),savingsInSampleOnly:metrics(savings),premiumIndependentAge41:{observedWon:116800,predictedWon:M.tariff('general','male',41),relativeErrorPercent:(M.tariff('general','male',41)/116800-1)*100},unvalidated:['Other issue ages and amounts','Simple underwriting surrender values','50% additional payments','Conversions other than 7 years','Post-conversion sums other than 1 billion KRW','20% returns','Mandatory entry-payment charges and timing','True actuarial account values before 7 years'],nearConversionChecks:nearConversion};
if(process.argv.includes('--write'))fs.writeFileSync(path.join(__dirname,'../metlife/calibration-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

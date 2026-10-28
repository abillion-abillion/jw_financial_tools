const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const data = require('../metlife/fixtures.json');
const model = require('../metlife/model.cjs');
const baseline = {gender: 'male', plan: 'base', rate: '3.75', month: 120};
const at = changes => model.snapshot(data, {...baseline, ...changes});

test('independently checked male/female ten-year official values', () => {
  assert.equal(at({}).paid, 136320000);
  assert.equal(at({}).surrender, 113330000);
  assert.equal(at({}).refundRate, 83.14);
  assert.equal(at({gender: 'female'}).paid, 93000000);
  assert.equal(at({gender: 'female'}).surrender, 75980000);
  assert.equal(at({gender: 'female'}).refundRate, 81.70);
});
test('downside illustration preserves losses, zero surrender is not zero death benefit', () => {
  assert.equal(at({rate: '-1'}).surrender, 88720000);
  assert.equal(at({rate: '-1', month: 588}).surrender, 0);
  assert.equal(at({rate: '-1', month: 588}).death, 1000000000);
  assert.equal(at({month: 12}).surrender, 0);
  assert.equal(at({month: 12}).death, 1000000000);
});
test('2.5% official scenario is distinct from upside and downside', () => {
  assert.equal(at({rate: '2.5'}).surrender, 106190000);
  assert.equal(at({rate: '2.5', gender: 'female'}).surrender, 71200000);
});
test('additional premium doubles outflow and uses official amount, not extra growth formula', () => {
  const p = at({plan: 'extra100'});
  assert.equal(p.paid, 272640000);
  assert.equal(p.surrender, 278470000);
  assert.equal(p.refundRate, 102.14);
  assert.equal(p.minimumDeath, 1136320000);
  assert.equal(p.death, null, 'no exact additional death table was supplied');
  assert.equal(at({plan: 'extra100', month: 84}).refundRate, 96.71);
});
test('late baseline death benefit follows source: reserve-linked death can exceed initial sum', () => {
  assert.equal(at({month: 588}).death, 1081260000);
  assert.equal(at({month: 588}).minimumDeath, 1000000000);
  assert.equal(at({month: 588, gender: 'female'}).death, 1000000000);
});
test('actual cash paid is distinct from source truncation', () => {
  assert.equal(at({month: 3}).paid, 3408000);
  assert.equal(at({month: 3}).paidDisplay, 3400000);
  assert.equal(at({month: 3, plan: 'extra100'}).paid, 6816000);
  assert.equal(at({month: 588, plan: 'extra100'}).paidDisplay, 1335930000);
  assert.equal(at({month: 588, plan: 'extra100'}).paid, 1335936000);
});
test('all 261 rate observations retain source precision and exact payment schedule', () => {
  let count = 0;
  for (const gender of ['male', 'female']) for (const plan of ['base', ...(gender === 'male' ? ['extra100'] : [])]) for (const rate of data.rates) {
    const points = model.series(data, {...baseline, gender, plan, rate});
    assert.equal(points.length, 29);
    for (const p of points) {
      assert.equal(p.surrender % 10000, 0);
      assert.ok(p.paidDisplay <= p.paid && p.paid - p.paidDisplay < 10000);
      // Source ratio uses untruncated actuarial amount; do not recompute from truncated amount.
      const impliedLow = p.surrender / p.paid * 100;
      const impliedHigh = (p.surrender + 10000) / p.paid * 100;
      assert.ok(p.refundRate + 0.01 >= impliedLow && p.refundRate - 0.01 <= impliedHigh,
        gender + '/' + plan + '/' + rate + '/' + p.month);
      if (p.death !== null) assert.ok(p.death + 10000 > p.minimumDeath);
      count++;
    }
  }
  assert.equal(count, 261);
});
test('unsupported rate including zero is explicitly rejected instead of silently defaulted', () => {
  for (const rate of ['0', 0, '8', '', null]) assert.throws(() => at({rate}), RangeError);
});
test('no interpolation, extrapolation, arbitrary plan, invalid gender or fabricated female extra', () => {
  for (const month of [0, 1, 119, 121, 599, 600, NaN]) assert.throws(() => at({month}), RangeError);
  assert.throws(() => at({gender: 'female', plan: 'extra100'}), RangeError);
  assert.throws(() => at({gender: '__proto__'}), RangeError);
  assert.throws(() => at({plan: 'extra50'}), RangeError);
});
test('first recovery describes first observed point, not interpolation or guarantee', () => {
  assert.equal(model.firstObservedRecovery(data, baseline).month, 300);
  assert.equal(model.firstObservedRecovery(data, {...baseline, plan: 'extra100'}).month, 108);
  assert.equal(model.firstObservedRecovery(data, {...baseline, rate: '-1'}), null);
});
test('conversion does not substitute surrender value for unknown reserve', () => {
  const r = model.conversionCheck(data, {...baseline, month: 84}, null, true);
  assert.equal(r.status, 'incomplete');
  assert.equal(r.threshold, 66796800);
  assert.equal(r.checks.reserve, null);
});
test('conversion threshold uses exact contractual paid amount for unaltered example', () => {
  const s = {...baseline, month: 84, plan: 'extra100'};
  const threshold = 133593600;
  assert.equal(model.conversionCheck(data, s, threshold - 1, true).status, 'unmet');
  assert.equal(model.conversionCheck(data, s, threshold, true).status, 'conditional');
  assert.equal(model.conversionCheck(data, s, threshold, false).status, 'incomplete');
  assert.equal(model.conversionCheck(data, s, NaN, true).status, 'incomplete');
});
test('conversion requires time and attained age even when reserve is ample', () => {
  assert.equal(model.conversionCheck(data, {...baseline, month: 72}, 1e9, true).status, 'unmet');
  assert.equal(model.conversionCheck(data, {...baseline, month: 540}, 1e9, true).status, 'unmet');
  assert.equal(model.conversionCheck(data, {...baseline, month: 480}, 1e9, true).status, 'conditional');
});
test('monetary input distinguishes zero, missing, invalid and unsafe values', () => {
  assert.equal(model.parseMoneyInManwon(''), null);
  assert.equal(model.parseMoneyInManwon('0'), 0);
  assert.equal(model.parseMoneyInManwon('100.0001'), 1000001);
  for (const value of ['-1', 'Infinity', '1e7', 'text', '999999999999999999999']) assert.throws(() => model.parseMoneyInManwon(value), RangeError);
});
test('CSV preserves Korean, provenance, exact payment and unknown death benefit', () => {
  const csv = model.csv(data, {...baseline, plan: 'extra100'});
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('공식 설계 예시 조회; 계리 추정 아님'));
  assert.ok(csv.includes('"10년","50","272640000","272640000","278470000","102.14","","1136320000"'));
  assert.ok(csv.includes('40세 남자.pdf'));
  assert.equal(csv.split('\r\n').length, 39);
});
test('generated HTML embeds exact model/data/app sources without remote assets', () => {
  const read = name => readFileSync(resolve(__dirname, '..', name), 'utf8');
  const html = read('metlife-variable-term.html');
  assert.ok(html.includes(read('metlife/model.cjs')));
  assert.ok(html.includes(read('metlife/app.js')));
  assert.deepEqual(JSON.parse(html.match(/<script id="metlife-fixtures" type="application\/json">([^]*?)<\/script>/)[1]), data);
  assert.doesNotMatch(html, /<script[^>]*src=|<link[^>]*href=|@import|__FIXTURES__|__MODEL__|__APP__|__STYLES__/);
});

const projection = {reserve:200000000, paidBefore:100000000, sumAssured:1000000000, entryPremium:500000, returnPercent:0, years:10, riskPer100m:1000, monthlyAdmin:2000, entryFeePercent:0, surrenderDeduction:0, confirmed:true};
test('conversion projection stops cash payments after required entry premium', () => {
  const p=model.projectConvertedContract(projection);
  assert.equal(p.paid,100500000);assert.equal(p.status,'projected');
  assert.ok(p.reserve < 200500000);assert.equal(p.death,projection.sumAssured+p.reserve);
  assert.equal(p.refundRate,p.surrender/p.paid*100);
});
test('custom return -1 to 20 supports zero and responds monotonically to return',()=>{
  const low=model.projectConvertedContract({...projection,returnPercent:-1});
  const high=model.projectConvertedContract({...projection,returnPercent:20});
  assert.ok(high.surrender>low.surrender);
  assert.ok(model.projectConvertedContract(projection).surrender>low.surrender);
  for(const r of [-1.01,20.01]) assert.throws(()=>model.projectConvertedContract({...projection,returnPercent:r}),RangeError);
});
test('conversion amount and premium limits follow product constraints',()=>{
  for(const overrides of [{sumAssured:24000000},{sumAssured:1000000001},{entryPremium:490000},{entryPremium:500001},{reserve:69999999}]) assert.throws(()=>model.projectConvertedContract({...projection,...overrides}),RangeError);
  assert.equal(model.projectConvertedContract({...projection,sumAssured:25000000}).status,'projected');
});
test('projection must not silently assume missing expenses are zero',()=>{
  assert.throws(()=>model.projectConvertedContract({...projection,riskPer100m:null}),RangeError);
  assert.throws(()=>model.projectConvertedContract({...projection,confirmed:false}),RangeError);
});
test('higher benefit incurs higher assumed risk cost and depleted funds do not promise death benefit',()=>{
  const low=model.projectConvertedContract({...projection,sumAssured:100000000});
  const high=model.projectConvertedContract(projection); assert.ok(low.surrender>high.surrender);
  const depleted=model.projectConvertedContract({...projection,riskPer100m:100000000});
  assert.equal(depleted.status,'funding-needed');assert.equal(depleted.insufficientMonth,1);
  assert.equal(depleted.death,undefined);assert.equal(depleted.refundRate,undefined);
});
test('entry charge and explicit surrender deduction are accounted separately',()=>{
  const a=model.projectConvertedContract(projection);
  const b=model.projectConvertedContract({...projection,entryFeePercent:10,surrenderDeduction:1000000});
  assert.ok(a.surrender>b.surrender);assert.equal(Math.round(b.reserve-b.surrender),1000000);
});

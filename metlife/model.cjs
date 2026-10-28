/* Source-backed illustration lookup, NOT a general actuarial projection engine. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MetlifeModel = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function validate(data, state) {
    if (!data.profiles[state.gender]) throw new RangeError('지원하지 않는 성별입니다.');
    if (!data.rates.includes(String(state.rate))) throw new RangeError('공식 예시에 없는 수익률입니다.');
    if (!['base', 'extra100'].includes(state.plan)) throw new RangeError('지원하지 않는 납입방식입니다.');
    const profile = data.profiles[state.gender];
    if (!profile[state.plan]) throw new RangeError('해당 성별의 추가납입 예시가 없습니다.');
    if (!Number.isInteger(state.month) || !profile[state.plan].some(r => r.month === state.month)) {
      throw new RangeError('공식 예시에 수록된 시점만 조회할 수 있습니다.');
    }
    return profile;
  }
  function series(data, state) {
    const profile = validate(data, state);
    const extra = state.plan === 'extra100';
    return profile[state.plan].map(row => {
      const basePaid = profile.monthlyBasePremiumWon * row.month;
      // All supported observations are >= month 3: month-2 catch-up is complete.
      const extraPaid = extra ? basePaid : 0;
      const paid = basePaid + extraPaid;
      const value = row.scenarios[String(state.rate)];
      const minimumDeath = Math.max(data.sumAssuredWon + extraPaid, paid);
      return Object.freeze({
        month: row.month, label: row.label, age: row.age,
        monthlyBase: profile.monthlyBasePremiumWon,
        monthlyExtra: extra ? profile.monthlyBasePremiumWon : 0,
        paid, basePaid, extraPaid, paidDisplay: row.paidDisplayWon,
        surrender: value.surrenderDisplayWon, refundRate: value.refundRatePercent,
        death: extra ? null : value.deathDisplayWon,
        minimumDeath, sourcePage: profile.sourcePages[state.plan],
        sourceTitle: profile.sourceTitle, surrenderPrecision: data.amountPrecisionWon,
        differenceDisplay: value.surrenderDisplayWon - paid
      });
    });
  }
  function snapshot(data, state) {
    return series(data, state).find(r => r.month === state.month);
  }
  function firstObservedRecovery(data, state) {
    // Describes a table observation, not an interpolated or guaranteed breakeven date.
    return series(data, state).find(r => r.refundRate >= 100) || null;
  }
  function parseMoneyInManwon(value) {
    if (value === '' || value === null || value === undefined) return null;
    if (!/^\d+(?:\.\d{1,4})?$/.test(String(value))) throw new RangeError('0 이상의 금액을 입력해 주세요.');
    const result = Number(value) * 10000;
    if (!Number.isFinite(result) || result > Number.MAX_SAFE_INTEGER) throw new RangeError('금액이 너무 큽니다.');
    return Math.round(result);
  }
  function conversionCheck(data, state, reserveWon, noWaiverConfirmed) {
    const point = snapshot(data, state);
    // Preset contract has no withdrawals, reductions, loans, waiver or prior conversion.
    // Thus its contractual paid premium equals actual paid premium at this observation.
    const threshold = Math.max(Math.ceil(point.paid * 7 / 10), 1000000);
    const amountKnown = typeof reserveWon === 'number' && Number.isFinite(reserveWon) && reserveWon >= 0;
    const checks = {
      time: point.month >= 84, age: point.age >= 15 && point.age <= 80,
      waiver: noWaiverConfirmed === true,
      reserve: amountKnown ? reserveWon >= threshold : null
    };
    const knownFailure = !checks.time || !checks.age || checks.reserve === false;
    return {threshold, checks, shortfall: amountKnown ? Math.max(0, threshold - reserveWon) : null,
      status: knownFailure ? 'unmet' : !amountKnown || !checks.waiver ? 'incomplete' : 'conditional'};
  }
  function csv(data, state) {
    validate(data, state);
    const quote = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const rows = [
      ['상품', data.product], ['자료 기준일', data.illustrationDate],
      ['계산방식', '공식 설계 예시 조회; 계리 추정 아님'],
      ['조건', (state.gender === 'male' ? '남성' : '여성') + ' / 40세 / 10억원 / 90세만기 / 일반가입형 / 전기납 / 특약없음'],
      ['납입방식', state.plan === 'base' ? '기본납입' : '기본+추가납입100%'],
      ['펀드', data.funds], ['가정 수익률(%)', state.rate],
      ['환급금·사망보험금 표시정밀도', '만원 미만 절사; 환급률은 원자료의 표시값'],
      ['추가납입 가정', '남성100%예시: 2개월차에 첫달분 포함 납입, 이후 매월; 인출·전환 없음'],
      ['경과기간', '보험나이', '실제납입누계(원)', '원자료납입누계표시(원·만원미만절사)',
        '해약환급금표시(원·만원미만절사)', '원자료환급률(%)', '사망보험금표시(원·만원미만절사)',
        '최저사망보험금(원·산식)', '출처', 'PDF쪽']
    ];
    for (const p of series(data, state)) rows.push([p.label, p.age, p.paid, p.paidDisplay,
      p.surrender, p.refundRate.toFixed(2), p.death, p.minimumDeath, p.sourceTitle, p.sourcePage]);
    return '\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n');
  }
  function projectConvertedContract(input) {
    const required = ['reserve', 'paidBefore', 'sumAssured', 'entryPremium', 'returnPercent', 'years', 'riskPer100m', 'monthlyAdmin', 'entryFeePercent', 'surrenderDeduction'];
    for (const key of required) if (typeof input[key] !== 'number' || !Number.isFinite(input[key])) throw new RangeError('적립액과 모든 비용 가정을 입력해 주세요.');
    if (!input.confirmed) throw new RangeError('가정 계산의 비용 조건을 확인해 주세요.');
    if (input.returnPercent < -1 || input.returnPercent > 20) throw new RangeError('투자수익률은 -1%부터 20%까지 입력해 주세요.');
    if (!Number.isInteger(input.years) || input.years < 1 || input.years > 50) throw new RangeError('전환 후 기간은 1~50년의 정수입니다.');
    for (const key of ['reserve','paidBefore','riskPer100m','monthlyAdmin','entryPremium','surrenderDeduction']) if (input[key] < 0) throw new RangeError('금액은 0 이상이어야 합니다.');
    if (input.entryFeePercent < 0 || input.entryFeePercent > 100) throw new RangeError('초회 공제율은 0~100%입니다.');
    const minimumPremium = Math.ceil(Math.max(100000, input.paidBefore / 200) / 10000) * 10000;
    const minimumSum = Math.ceil(input.entryPremium * 50 / 1000000) * 1000000;
    if (input.entryPremium < minimumPremium || input.entryPremium % 10000 !== 0 || input.entryPremium > 20000000) throw new RangeError('초회 기본보험료는 최소 ' + minimumPremium.toLocaleString('ko-KR') + '원 이상, 1만원 단위·전환 전 가입금액의 2% 이하여야 합니다.');
    if (input.sumAssured < minimumSum || input.sumAssured > 1000000000 || input.sumAssured % 1000000 !== 0) throw new RangeError('가입금액은 최소 ' + minimumSum.toLocaleString('ko-KR') + '원 이상·10억원 이하, 100만원 단위여야 합니다.');
    if (input.reserve < Math.max(input.paidBefore * 7 / 10, 1000000)) throw new RangeError('전환 전 적립액이 기납입보험료의 70% 또는 100만원 기준에 미달합니다.');
    let reserve = input.reserve + input.entryPremium * (1 - input.entryFeePercent / 100);
    const paid = input.paidBefore + input.entryPremium;
    const monthlyReturn = Math.pow(1 + input.returnPercent / 100, 1 / 12) - 1;
    const fixedMonthlyCost = input.riskPer100m * input.sumAssured / 100000000 + input.monthlyAdmin;
    let costTotal = input.entryPremium * input.entryFeePercent / 100;
    let insufficientMonth = null;
    const rows = [];
    for (let month = 1; month <= input.years * 12; month++) {
      const cost = fixedMonthlyCost + reserve * 0.0015 / 12;
      if (reserve - input.surrenderDeduction < cost || reserve <= 0) { insufficientMonth = month; break; }
      reserve = (reserve - cost) * (1 + monthlyReturn);
      costTotal += cost;
      if (month % 12 === 0) rows.push({year: month / 12, reserve, surrender: Math.max(0, reserve - input.surrenderDeduction), death: Math.max(input.sumAssured + reserve, paid)});
    }
    if (insufficientMonth !== null) return {status: 'funding-needed', insufficientMonth, rows, paid, costTotal};
    const surrender = Math.max(0, reserve - input.surrenderDeduction);
    return {status: 'projected', reserve, surrender, paid, death: Math.max(input.sumAssured + reserve, paid), refundRate: surrender / paid * 100, rows, costTotal};
  }
  return Object.freeze({validate, series, snapshot, firstObservedRecovery, parseMoneyInManwon, conversionCheck, csv, projectConvertedContract});
});

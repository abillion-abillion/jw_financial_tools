(function () {
  'use strict';
  const data = JSON.parse(document.getElementById('metlife-fixtures').textContent);
  const model = globalThis.MetlifeModel;
  const $ = id => document.getElementById(id);
  const number = (n, digits = 0) => n.toLocaleString('ko-KR', {maximumFractionDigits: digits, minimumFractionDigits: digits});
  const money = n => n >= 1e8 ? number(n / 1e8, 2) + '억 원' : number(n / 10000, n % 10000 ? 1 : 0) + '만 원';
  const exactMoney = n => number(n) + '원';
  const percent = n => number(n, 2) + '%';
  const rateLabel = r => r === '-1' ? '-1.0' : r;
  const state = {gender: 'male', plan: 'base', rate: '3.75', month: 120};
  // URL fragments contain only validated enum values, never client names or financial input.
  function readHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    const proposed = {...state};
    for (const key of ['gender', 'plan', 'rate']) if (q.has(key)) proposed[key] = q.get(key);
    if (q.has('month')) proposed.month = Number(q.get('month'));
    try { model.validate(data, proposed); Object.assign(state, proposed); }
    catch { toast('지원하지 않는 조건 링크입니다. 기본 예시로 표시합니다.'); }
  }
  let toastTimer;
  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4000);
  }
  function synchronizeInputs() {
    for (const key of ['gender', 'plan', 'rate']) {
      for (const input of document.querySelectorAll('input[name="' + key + '"]')) input.checked = input.value === state[key];
    }
    const extraInput = document.querySelector('input[name="plan"][value="extra100"]');
    extraInput.disabled = state.gender === 'female';
    extraInput.setAttribute('aria-describedby', 'plan-help');
    $('plan-help').textContent = state.gender === 'female'
      ? '여성 추가납입 예시는 자료 확보 후 제공합니다.'
      : '추가납입 시 월 총지출도 2배가 됩니다.';
    $('period').value = String(state.month);
    $('period-range').value = String(data.profiles[state.gender].base.findIndex(row => row.month === state.month));
    const p = model.snapshot(data, state);
    $('period-range').setAttribute('aria-valuetext', p.label + ' 경과, 보험나이 ' + p.age + '세');
    $('selected-age').textContent = p.age + '세';
    document.querySelectorAll('.milestones button').forEach(button => {
      const selected = Number(button.dataset.month) === state.month;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  function updateState(change) {
    const proposed = {...state, ...change};
    if (proposed.gender === 'female' && proposed.plan === 'extra100') {
      proposed.plan = 'base';
      toast('여성은 기본납입 예시로 변경했습니다.');
    }
    try { model.validate(data, proposed); }
    catch (error) { toast(error.message); synchronizeInputs(); return; }
    const changed = Object.keys(proposed).some(key => proposed[key] !== state[key]);
    Object.assign(state, proposed);
    if (changed) { $('reserve').value = ''; $('no-waiver').checked = false; }
    render();
    // Avoid history spam while moving the slider. Offline file:// may reject history APIs.
    const fragment = new URLSearchParams(Object.entries(state)).toString();
    try { history.replaceState(null, '', '#' + fragment); } catch { /* optional sharing state */ }
  }
  function renderMetrics(p) {
    $('selected-context').textContent = '40세 ' + (state.gender === 'male' ? '남성' : '여성') + ' · 10억 원 · 90세 만기 · ' + (state.plan === 'base' ? '기본납입' : '추가납입 100%');
    $('monthly-total').textContent = exactMoney(p.monthlyBase + p.monthlyExtra);
    $('monthly-detail').textContent = '기본 ' + exactMoney(p.monthlyBase) + (p.monthlyExtra ? ' + 추가 ' + exactMoney(p.monthlyExtra) : ' · 추가납입 없음');
    $('paid').textContent = money(p.paid);
    $('paid-detail').textContent = p.label + ' 동안 ' + exactMoney(p.paid);
    $('surrender').textContent = money(p.surrender);
    $('surrender-detail').textContent = exactMoney(p.surrender) + ' · 만 원 미만 절사';
    $('refund-rate').textContent = percent(p.refundRate);
    $('chart-scenario').textContent = p.label + ' 경과 · 연 ' + rateLabel(state.rate) + '% 가정';
    const first = model.firstObservedRecovery(data, state);
    $('recovery').textContent = first ? '수록 시점 중 첫 환급률 100% 이상: ' + first.label : '수록 구간에서 환급률 100% 이상 시점 없음';
    const isExtra = state.plan === 'extra100';
    $('death-label').textContent = isExtra ? '최저사망보험금 · 약관 산식' : '사망보험금 · 공식 예시';
    $('death').textContent = money(isExtra ? p.minimumDeath : p.death);
    $('death-help').textContent = isExtra
      ? exactMoney(p.minimumDeath) + '. 가입금액에 누적 추가납입액을 더한 기본보험금액과 기납입보험료 중 큰 금액입니다. 실제 사망보험금은 적립액에 따라 더 클 수 있습니다.'
      : exactMoney(p.death) + ' (만 원 미만 절사). 선택한 시점·가정 수익률의 공식 설계값입니다. 사망보험금은 해약환급금과 다른 지급금입니다.';
  }
  function renderComparison() {
    if (state.gender === 'female') {
      $('comparison').innerHTML = '<p class="unavailable">현재 확보한 여성 설계서는 기본납입 예시입니다.<br>남성 탭에서 추가납입 비교를 살펴보실 수 있습니다.</p>';
      $('comparison-help').textContent = '성별이 다른 예시의 환급률을 그대로 적용하지 않습니다.';
      return;
    }
    $('comparison').innerHTML = ['base', 'extra100'].map(plan => {
      const p = model.snapshot(data, {...state, plan});
      return '<div class="compare-row ' + (state.plan === plan ? 'is-selected' : '') + '"><span>' + (plan === 'base' ? '기본납입' : '추가납입 100%') + '</span><strong>' + percent(p.refundRate) + '</strong><small>월 ' + exactMoney(p.monthlyBase + p.monthlyExtra) + '</small><small>환급금 ' + money(p.surrender) + '</small></div>';
    }).join('');
    $('comparison-help').textContent = '동일한 가입금액 기준 비교입니다. 추가납입 시 월 총지출과 누적납입액도 늘어납니다. 2개월차에 첫 달분을 포함해 추가납입한 예시입니다.';
  }
  function renderChart(points) {
    const W = 800, H = 270, left = 49, right = 14, top = 18, bottom = 34;
    const maxMonths = 588;
    const maxValue = Math.max(...points.map(p => Math.max(p.paid, p.surrender)), 1);
    const maxY = Math.ceil(maxValue / 4e7) * 4e7;
    const x = month => left + month / maxMonths * (W - left - right);
    const y = value => H - bottom - value / maxY * (H - top - bottom);
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-labelledby="chart-svg-title chart-svg-desc"><title id="chart-svg-title">납입누계와 해약환급금, ' + (state.gender === 'male' ? '남성' : '여성') + ' 연 ' + rateLabel(state.rate) + '% 가정</title><desc id="chart-svg-desc">해약환급금은 공식 표의 수록 시점을 점으로 표시합니다. 점은 마우스 또는 키보드 Enter로 선택할 수 있습니다. 같은 데이터는 아래 표에서도 확인할 수 있습니다.</desc>';
    for (let i = 0; i <= 4; i++) {
      const value = maxY * i / 4;
      svg += '<line x1="' + left + '" y1="' + y(value) + '" x2="' + (W - right) + '" y2="' + y(value) + '" stroke="#e9efee"/><text x="' + (left - 12) + '" y="' + (y(value) + 4) + '" text-anchor="end" fill="#738590" font-size="14">' + (value / 1e8).toFixed(1) + '</text>';
    }
    for (const year of [0, 10, 20, 30, 40, 49]) svg += '<text x="' + x(year * 12) + '" y="' + (H - 10) + '" fill="#738590" font-size="14" text-anchor="middle">' + year + '년</text>';
    // Actual premiums follow an exact payment schedule at the supported observations.
    const paidPath = 'M' + x(0) + ',' + y(0) + points.map(p => 'L' + x(p.month) + ',' + y(p.paid)).join('');
    svg += '<path d="' + paidPath + '" fill="none" stroke="#a3afb9" stroke-width="1.7" stroke-dasharray="5 5"/>';
    svg += '<line x1="' + x(state.month) + '" y1="' + top + '" x2="' + x(state.month) + '" y2="' + (H - bottom) + '" stroke="#a6d1bf" stroke-dasharray="3 5"/>';
    for (const p of points) {
      const selected = p.month === state.month;
      if (selected) svg += '<circle cx="' + x(p.month) + '" cy="' + y(p.surrender) + '" r="11" fill="#087f781a"/>';
      const label = p.label + ' 해약환급금 ' + exactMoney(p.surrender) + ', 환급률 ' + percent(p.refundRate);
      svg += '<circle class="point" role="button" tabindex="0" aria-label="' + label + '" aria-pressed="' + selected + '" data-month="' + p.month + '" cx="' + x(p.month) + '" cy="' + y(p.surrender) + '" r="' + (selected ? 6 : 4) + '" fill="' + (selected ? '#075e58' : '#188f80') + '"><title>' + label + '</title></circle>';
    }
    $('chart').innerHTML = svg + '</svg>';
  }
  function renderTable() {
    const all = data.rates.map(rate => model.series(data, {...state, rate}));
    $('table-description').textContent = (state.plan === 'base' ? '기본납입' : '기본 + 추가납입 100%') + ' · ' + (state.gender === 'male' ? '남성 설계서 ' : '여성 설계서 ') + (state.plan === 'base' ? '13쪽' : '15쪽') + ' · 금액 단위: 만원';
    $('table-body').innerHTML = all[0].map((point, i) => '<tr class="' + (point.month === state.month ? 'is-active' : '') + '"><td><button class="table-body-button" data-month="' + point.month + '"' + (point.month === state.month ? ' aria-current="true"' : '') + '>' + point.label + '</button></td><td>' + point.age + '세</td><td>' + number(point.paid / 10000, point.paid % 10000 ? 1 : 0) + '</td>' + data.rates.map((rate, j) => '<td class="' + (rate === state.rate ? 'selected-rate' : '') + '">' + number(all[j][i].surrender / 10000) + '<small>' + percent(all[j][i].refundRate) + '</small></td>').join('') + '</tr>').join('');
    document.querySelectorAll('th[data-rate]').forEach(th => th.classList.toggle('selected-rate', th.dataset.rate === state.rate));
  }
  function renderConversion() {
    let amount;
    try { amount = model.parseMoneyInManwon($('reserve').value); }
    catch (error) { $('conversion-output').textContent = error.message; return; }
    const result = model.conversionCheck(data, state, amount, $('no-waiver').checked);
    const p = model.snapshot(data, state);
    const row = (label, status, detail) => '<div class="check-row"><span>' + label + '</span><span class="check-' + (status === null ? 'unknown' : status ? 'pass' : 'fail') + '">' + detail + '</span></div>';
    const headings = {incomplete: '적립액과 납입면제 여부를 확인해 주세요.', unmet: '충족하지 않은 조건이 있습니다.', conditional: '입력조건상 주요 요건을 충족합니다.'};
    $('conversion-output').innerHTML = '<p class="conversion-status status-' + result.status + '">' + headings[result.status] + '</p>'
      + row('계약일부터 7년 경과', result.checks.time, result.checks.time ? '충족 · ' + p.label : '미충족 · ' + p.label)
      + row('전환 나이', result.checks.age, p.age + '세' + (result.checks.age ? ' · 범위 내' : ' · 범위 초과'))
      + row('납입면제 미적용', result.checks.waiver ? true : null, result.checks.waiver ? '확인' : '확인 필요')
      + row('필요 계약자적립액', result.checks.reserve, exactMoney(result.threshold) + ' 이상')
      + (result.shortfall > 0 ? '<p class="tiny">입력한 적립액 기준 부족액: ' + exactMoney(result.shortfall) + '</p>' : '<p class="tiny">기준: 기납입보험료의 70%와 100만 원 중 큰 금액. 실제 전환 승낙·효력발생일은 보험사에서 확인합니다.</p>');
  }
  function render() {
    synchronizeInputs();
    const points = model.series(data, state);
    renderMetrics(points.find(p => p.month === state.month));
    renderComparison(); renderChart(points); renderTable(); renderConversion(); renderProjection();
  }
  let projectionProfile = '';
  const projectionNumber = id => {
    const raw = $(id).value.trim();
    return raw === '' ? null : Number(raw);
  };
  function renderProjection() {
    const signature = state.gender + '/' + state.plan;
    if (projectionProfile !== signature) {
      projectionProfile = signature;
      $('scenario-reserves').innerHTML = [7,8,9,10].map(year => {
        const point = model.snapshot(data, {...state, month: year * 12});
        const minimumPremium = Math.ceil(Math.max(100000, point.paid / 200) / 10000) * 10000;
        return '<div class="reserve-case"><h3>' + year + '년 후 전환 · ' + (40 + year) + '세</h3><p id="reference-' + year + '" class="field-help"></p><label for="opening-' + year + '">전환 전 계약자적립액 (만원)</label><input id="opening-' + year + '" type="number" min="0" step="0.0001" placeholder="계약자적립액 직접 입력"><label for="entry-' + year + '">전환 당일 초회 기본보험료 (만원)</label><input id="entry-' + year + '" type="number" min="' + minimumPremium / 10000 + '" step="1" value="' + minimumPremium / 10000 + '"><label for="deduction-' + year + '">전환 후 해약공제 가정 (만원)</label><input id="deduction-' + year + '" type="number" min="0" step="0.0001" placeholder="없다고 가정하면 0 입력"></div>';
      }).join('');
    }
    const cards = [7,8,9,10].map(year => {
      const p = model.snapshot(data, {...state, month:year * 12});
      $('reference-' + year).textContent = '참고: 전환 전 공식 환급금 ' + exactMoney(p.surrender) + ' (연 ' + rateLabel(state.rate) + '%). 계약자적립액과 다르므로 자동 대입하지 않습니다.';
      const reserve = projectionNumber('opening-' + year);
      const deduction = projectionNumber('deduction-' + year);
      const risk = projectionNumber('projection-risk');
      const admin = projectionNumber('projection-admin');
      const fee = projectionNumber('projection-entry-fee');
      if ([reserve,deduction,risk,admin,fee].some(value => value === null)) return '<article class="projection-card"><h3>' + year + '년 후 전환</h3><p>계약자적립액·해약공제·공제비용 가정을 입력하면 결과가 표시됩니다.</p></article>';
      try {
        const years = projectionNumber('projection-horizon');
        const result = model.projectConvertedContract({reserve:reserve * 10000, paidBefore:p.paid, sumAssured:projectionNumber('projection-sum') * 10000, entryPremium:projectionNumber('entry-' + year) * 10000, returnPercent:projectionNumber('projection-return'), years, riskPer100m:risk, monthlyAdmin:admin, entryFeePercent:fee, surrenderDeduction:deduction * 10000, confirmed:$('projection-confirm').checked});
        if (result.status !== 'projected') return '<article class="projection-card"><h3>' + year + '년 후 전환</h3><p class="projection-warn">전환 후 ' + result.insufficientMonth + '개월차 비용 충당 부족</p><p>추가 납입·보험사 유지요건 확인이 필요합니다. 이후 시점의 보장금액과 환급률은 표시하지 않습니다.</p></article>';
        return '<article class="projection-card"><h3>' + year + '년 후 전환 → ' + years + '년 경과</h3><p>최초 가입 후 ' + (year + years) + '년 · ' + (40 + year + years) + '세 · 가정 계산</p><dl><dt>예상 사망보험금</dt><dd>' + exactMoney(Math.round(result.death)) + '</dd><dt>예상 해약환급금</dt><dd>' + exactMoney(Math.round(result.surrender)) + '</dd><dt>예상 해약환급률</dt><dd>' + percent(result.refundRate) + '</dd></dl><p>실제 총 납입액 ' + exactMoney(result.paid) + ' (전환 당일 초회보험료 포함). 이후 추가 납입 0원.</p><p>공제비용 가정 합계 ' + exactMoney(Math.round(result.costTotal)) + '</p></article>';
      } catch(error) { const safe = document.createElement('p'); safe.textContent = error.message; return '<article class="projection-card"><h3>' + year + '년 후 전환</h3><div class="projection-error">' + safe.innerHTML + '</div></article>'; }
    });
    $('projection-output').innerHTML = '<div class="projection-cards">' + cards.join('') + '</div>';
  }
  $('conversion-scenario').addEventListener('input', event => {
    if (event.target.id === 'projection-return' || event.target.id === 'projection-return-slider') {
      const other = event.target.id === 'projection-return' ? 'projection-return-slider' : 'projection-return';
      $(other).value = event.target.value;
    }
    renderProjection();
  });
  readHash();
  $('period').innerHTML = data.profiles.male.base.map(p => '<option value="' + p.month + '">' + p.label + ' 경과</option>').join('');
  $('milestones').innerHTML = [3, 60, 84, 120, 240, 360, 480, 588].map(month => '<button type="button" data-month="' + month + '">' + (month === 3 ? '3개월' : month / 12 + '년') + '</button>').join('');
  for (const key of ['gender', 'plan', 'rate']) document.querySelectorAll('input[name="' + key + '"]').forEach(input => input.addEventListener('change', () => updateState({[key]: input.value})));
  $('period').addEventListener('change', event => updateState({month: Number(event.target.value)}));
  $('period-range').addEventListener('input', event => updateState({month: data.profiles[state.gender].base[Number(event.target.value)].month}));
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-month]');
    if (target) {
      const restoreChartFocus = target.classList.contains('point');
      updateState({month: Number(target.dataset.month)});
      if (restoreChartFocus) $('chart').querySelector('[data-month="' + state.month + '"]').focus({preventScroll: true});
    }
  });
  $('chart').addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.point')) { event.preventDefault(); event.target.dispatchEvent(new MouseEvent('click', {bubbles: true})); }
  });
  $('check-conversion').addEventListener('click', renderConversion);
  $('reserve').addEventListener('input', renderConversion);
  $('no-waiver').addEventListener('change', renderConversion);
  let sourceWasOpen = null;
  window.addEventListener('beforeprint', () => {
    const source = document.querySelector('details.sources');
    if (sourceWasOpen === null) sourceWasOpen = source.open;
    source.open = true;
  });
  window.addEventListener('afterprint', () => {
    if (sourceWasOpen !== null) document.querySelector('details.sources').open = sourceWasOpen;
    sourceWasOpen = null;
  });
  $('print').addEventListener('click', () => window.print());
  $('export').addEventListener('click', () => {
    const blob = new Blob([model.csv(data, state)], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '메트라이프_공식예시_' + (state.gender === 'male' ? '남성' : '여성') + '_' + state.plan + '_' + state.rate + 'pct.csv';
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('선택한 수익률의 전체 시점 표를 저장했습니다.');
  });
  render();
})();

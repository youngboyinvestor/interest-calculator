/* ============================================================
   STATE
   ============================================================ */
function cloneDefaults() {
  return {
    lang: 'th', tab: 'home',
    home: Object.assign({}, DEFAULTS.home, { steps: DEFAULTS.home.steps.slice() }),
    auto: Object.assign({}, DEFAULTS.auto),
    comp: Object.assign({}, DEFAULTS.comp),
    refi: Object.assign({}, DEFAULTS.refi),
    afford: Object.assign({}, DEFAULTS.afford),
    extra: Object.assign({}, DEFAULTS.extra),
    raw: {}, amortView: 'year', showTests: false, shared: false
  };
}
const state = cloneDefaults();

function setField(group, key, v) { state[group][key] = v; scheduleRender(); }
function patchState(obj) { Object.assign(state, obj); scheduleRender(); }

/* ============================================================
   FORMATTING (bound to state.lang)
   ============================================================ */
function L() { return DICT[state.lang]; }
function n(v, d) { return (v === null || v === undefined || !isFinite(v)) ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
function b(v, d) { return '฿' + n(v, d); }
function short(v) {
  const th = state.lang === 'th';
  if (Math.abs(v) >= 1e6) return n(v / 1e6, 2) + (th ? ' ล้าน' : 'M');
  if (Math.abs(v) >= 1e3) return n(v / 1e3, 0) + (th ? 'K' : 'K');
  return n(v, 0);
}
function bshort(v) { return '฿' + short(v); }
function dur(m) {
  const y = Math.floor(m / 12), mm = m % 12;
  const Lx = L();
  if (!isFinite(m)) return '—';
  if (y === 0) return mm + ' ' + Lx.month;
  return y + ' ' + Lx.years + (mm ? ' ' + mm + ' ' + Lx.month : '');
}

/* ============================================================
   TINY DOM HELPER (hyperscript-style, no vdom/diffing)
   ============================================================ */
function h(tag, attrs) {
  const node = document.createElement(tag);
  attrs = attrs || {};
  for (const k in attrs) {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'value') node.value = v;
    else if (k === 'checked') node.checked = !!v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  const children = Array.prototype.slice.call(arguments, 2);
  (function walk(arr) {
    for (let i = 0; i < arr.length; i++) {
      const c = arr[i];
      if (Array.isArray(c)) { walk(c); continue; }
      if (c === null || c === undefined || c === false) continue;
      node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  })(children);
  return node;
}
function svgEl(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}

/* ============================================================
   FIELD DESCRIPTORS — pure data, built during buildViewModel().
   Rendered into real inputs by buildField() at render time.
   ============================================================ */
function fieldId(group, key) { return 'f-' + group + '-' + key; }

function makeNumField(group, key, opts) {
  opts = opts || {};
  const val = state[group][key];
  const rk = group + '.' + key;
  const raw = state.raw[rk];
  return {
    kind: 'number', group, key,
    label: opts.label, unit: opts.unit || '',
    hint: opts.hint || '', error: opts.error || '',
    display: raw !== undefined ? raw : (opts.plain ? String(val) : n(val, opts.dec || 0))
  };
}
function segOpt(label, active, onClick) { return { label, active, onClick }; }
function makeSeg(label, options) { return { kind: 'seg', label, unit: '', options }; }
function makeSelect(id, label, value, options, onChange) {
  return { kind: 'select', id, label, unit: '', value: String(value), options, onChange };
}

/* ============================================================
   CHART HELPERS
   ============================================================ */
function curveFrom(points) {
  if (!points.length) return { d: '', poly: '', max: 0 };
  const max = Math.max.apply(null, points) || 1;
  const W = 620, H = 164;
  const xs = points.map((v, i) => (points.length === 1 ? 0 : i / (points.length - 1) * W));
  const ys = points.map(v => H - (v / max) * (H - 8));
  const poly = xs.map((x, i) => x.toFixed(1) + ',' + ys[i].toFixed(1)).join(' ');
  const d = 'M0,' + H.toFixed(1) + ' L' + poly.split(' ').join(' L') + ' L' + W + ',' + H.toFixed(1) + ' Z';
  return { d, poly, max };
}
function computeBars(rows, keyA, keyB) {
  const per = [];
  rows.forEach(r => {
    const y = Math.ceil(r.m / 12) - 1;
    if (!per[y]) per[y] = { a: 0, b: 0 };
    per[y].a += r[keyA]; per[y].b += r[keyB];
  });
  const max = Math.max.apply(null, per.map(p => p.a + p.b)) || 1;
  return per.map((p, i) => ({
    aH: (p.a / max * 100).toFixed(2), bH: (p.b / max * 100).toFixed(2),
    title: (state.lang === 'th' ? 'ปีที่ ' : 'Year ') + (i + 1) + ' · ' + bshort(p.a) + ' / ' + bshort(p.b)
  }));
}

/* ============================================================
   PER-TAB MODELS — pure functions of state, ported from the
   prototype unchanged.
   ============================================================ */
function homeModel() {
  const h_ = state.home, x = state.extra;
  const down = h_.price * (h_.downPct / 100);
  const loan = Math.max(0, h_.price - down);
  const months = Math.round(h_.years * 12);
  const sched = h_.stepup
    ? [{ months: 12, annual: h_.steps[0] }, { months: 12, annual: h_.steps[1] }, { months: 12, annual: h_.steps[2] }, { months: Math.max(1, months - 36), annual: h_.steps[3] }]
    : [{ months, annual: h_.rate }];
  const base = ENGINE.amortize({ principal: loan, months, sched });
  const withExtra = ENGINE.amortize({
    principal: loan, months, sched,
    extraMonthly: x.mode === 'monthly' ? x.amount : 0,
    extraAnnual: x.mode === 'annual' ? x.amount : 0,
    lump: x.mode === 'lump' ? x.amount : 0, lumpMonth: x.lumpMonth
  });
  return { down, loan, months, sched, base, active: x.mode === 'none' ? base : withExtra, fees: h_.fees + h_.insurance };
}
function autoModel() {
  const a = state.auto;
  const down = a.price * (a.downPct / 100);
  const loan = Math.max(0, a.price - down);
  const months = Math.round(a.years * 12);
  const f = ENGINE.flat(loan, a.rate, months, a.balloon);
  const red = ENGINE.amortize({ principal: loan, months, sched: [{ months, annual: a.rate }] });
  return { down, loan, months, flat: f, red, fees: a.fees };
}
function refiModel() {
  const r = state.refi;
  return ENGINE.refinance({
    balance: r.balance, oldRate: r.oldRate, monthsLeft: Math.round(r.monthsLeft),
    newRate: r.newRate, newMonths: Math.round(r.newYears * 12), fees: r.fees, rollFees: !!r.rollFees
  });
}
function compModel() {
  const c = state.comp;
  const res = ENGINE.compound({ pv: c.pv, monthly: c.monthly, annualPct: c.rate, years: c.years, perYear: c.perYear });
  const need = c.goal > 0 ? ENGINE.requiredSaving(c.goal, c.pv, c.rate, c.years, c.perYear) : 0;
  return { res, need };
}
function affordModel() { return ENGINE.affordability(state.afford); }

/* ============================================================
   VALIDATION
   ============================================================ */
function validate() {
  const th = state.lang === 'th', s = state, errs = [];
  const E = (t, e) => errs.push(th ? t : e);
  const pos = (v, t, e) => { if (!(v > 0)) E(t, e); };
  if (s.tab === 'home') {
    pos(s.home.price, 'กรุณากรอกราคาบ้านให้มากกว่า 0', 'Enter a property price above 0');
    if (s.home.downPct >= 100) E('เงินดาวน์ต้องไม่มากกว่าหรือเท่ากับราคาบ้าน', 'The down payment cannot equal or exceed the price');
    if (s.home.downPct < 0) E('เงินดาวน์ต้องไม่ติดลบ', 'The down payment cannot be negative');
    pos(s.home.years, 'ระยะเวลากู้ต้องมากกว่า 0 ปี', 'The term must be more than 0 years');
    if (s.home.rate < 0) E('อัตราดอกเบี้ยต้องไม่ติดลบ', 'The interest rate cannot be negative');
    if (s.home.years > 50) E('ระยะเวลากู้ยาวเกินไป (ไม่เกิน 50 ปี)', 'Term is too long (50 years maximum)');
  }
  if (s.tab === 'auto') {
    pos(s.auto.price, 'กรุณากรอกราคารถให้มากกว่า 0', 'Enter a vehicle price above 0');
    if (s.auto.downPct >= 100) E('เงินดาวน์ต้องไม่มากกว่าหรือเท่ากับราคารถ', 'The down payment cannot equal or exceed the price');
    pos(s.auto.years, 'ระยะเวลาผ่อนต้องมากกว่า 0 ปี', 'The term must be more than 0 years');
    if (s.auto.rate < 0) E('อัตราดอกเบี้ยต้องไม่ติดลบ', 'The flat rate cannot be negative');
    const loan = s.auto.price * (1 - s.auto.downPct / 100);
    if (s.auto.balloon >= loan) E('Balloon payment ต้องน้อยกว่ายอดจัด', 'The balloon payment must be smaller than the financed amount');
  }
  if (s.tab === 'comp') {
    if (s.comp.pv < 0 || s.comp.monthly < 0) E('เงินต้นและเงินฝากต่อเดือนต้องไม่ติดลบ', 'Starting amount and monthly deposit cannot be negative');
    pos(s.comp.years, 'ระยะเวลาต้องมากกว่า 0 ปี', 'The horizon must be more than 0 years');
    if (s.comp.pv === 0 && s.comp.monthly === 0) E('กรุณากรอกเงินต้นหรือเงินฝากต่อเดือนอย่างน้อยหนึ่งช่อง', 'Enter a starting amount or a monthly deposit');
  }
  if (s.tab === 'refi') {
    pos(s.refi.balance, 'กรุณากรอกยอดหนี้คงเหลือ', 'Enter the outstanding balance');
    pos(s.refi.monthsLeft, 'จำนวนงวดที่เหลือต้องมากกว่า 0', 'Remaining periods must be above 0');
    pos(s.refi.newYears, 'ระยะเวลาสัญญาใหม่ต้องมากกว่า 0 ปี', 'The new term must be more than 0 years');
    if (s.refi.oldRate < 0 || s.refi.newRate < 0) E('อัตราดอกเบี้ยต้องไม่ติดลบ', 'Interest rates cannot be negative');
  }
  if (s.tab === 'afford') {
    pos(s.afford.income, 'กรุณากรอกรายได้ต่อเดือน', 'Enter your monthly income');
    pos(s.afford.years, 'ระยะเวลากู้ต้องมากกว่า 0 ปี', 'The term must be more than 0 years');
    if (s.afford.dsr <= 0 || s.afford.dsr > 100) E('สัดส่วนภาระหนี้ต่อรายได้ต้องอยู่ระหว่าง 1–100%', 'Debt-service ratio must be between 1 and 100%');
    const m = ENGINE.affordability(s.afford);
    if (m.maxPay <= 0) E('รายได้หลังหักค่าใช้จ่ายและหนี้เดิมไม่เหลือพอผ่อน', 'Nothing is left to service a loan after expenses and existing debt');
  }
  return errs;
}
/* ============================================================
   VIEW MODEL — mirrors the prototype's renderVals(): one pass
   that computes everything the page needs to show for the
   current state. buildApp() below turns this into real DOM.
   ============================================================ */
function buildViewModel() {
  const s = state, Lx = L(), th = s.lang === 'th';
  const tests = runTests();
  const passed = tests.filter(t => t.pass).length;
  const errors = validate();
  const ok = errors.length === 0;

  const V = {
    t: Lx,
    langOpts: [['th', 'ไทย'], ['en', 'EN']].map(o => segOpt(o[1], s.lang === o[0], () => patchState({ lang: o[0] }))),
    onShare: () => doShare(),
    shareLabel: s.shared ? Lx.shared : Lx.share,
    onPrint: () => window.print(),
    goCalc: () => scrollToEl('calc'),
    goFaq: () => scrollToEl('faq'),
    onReset: () => {
      const d = cloneDefaults();
      Object.assign(state, { home: d.home, auto: d.auto, comp: d.comp, refi: d.refi, afford: d.afford, extra: d.extra, raw: {} });
      scheduleRender();
    },
    onToggleTests: () => patchState({ showTests: !s.showTests }),
    showTests: s.showTests,
    showTestPanel: true,
    testSummary: (th ? 'ผ่าน ' + passed + ' จาก ' + tests.length + ' รายการ · รันสดในเบราว์เซอร์ทุกครั้งที่เปิดหน้า' : passed + ' of ' + tests.length + ' checks pass · run live in your browser on every load'),
    testToggleLabel: s.showTests ? Lx.testsHide : Lx.testsShow,
    testRows: tests.map(x => ({ name: th ? x.th : x.en, detail: x.detail, mark: x.pass ? 'PASS' : 'FAIL', color: x.pass ? '#b5abfc' : '#d98484' })),
    faqs: getFaqs(th), glossary: getGlossary(th),
    errors, hasErrors: errors.length > 0, ok,
    isHome: s.tab === 'home', isAuto: s.tab === 'auto', isComp: s.tab === 'comp', isRefi: s.tab === 'refi', isAfford: s.tab === 'afford',
    amortView: s.amortView,
    amortViewLabel: s.amortView === 'year' ? Lx.byMonth : Lx.byYear,
    onToggleAmortView: () => patchState({ amortView: s.amortView === 'year' ? 'month' : 'year' }),
    stepup: !!s.home.stepup,
    toggleStepup: () => setField('home', 'stepup', !s.home.stepup),
    hasTable2: false, table2Verdict: '', table2Foot: '', hasWhatIf: false, hasExtraCompare: false,
    hasCharts: false, hasBreakdown: false, hasAmort: false, hasExtraPanel: false,
    showExtraAmt: false, showLumpMonth: false, curveTicks: [], curveMarks: [], yearBars: [], fields: []
  };

  const TABS = [
    ['home', th ? 'สินเชื่อบ้าน' : 'Home loan', th ? 'ลดต้นลดดอก' : 'Reducing', th ? 'ค่างวด ดอกเบี้ยรวม ตารางผ่อน และผลของการโปะ' : 'Instalment, total interest, schedule and the effect of paying extra'],
    ['auto', th ? 'สินเชื่อรถ' : 'Auto loan', 'Flat rate', th ? 'ดอกเบี้ยแบบ Flat Rate พร้อมอัตราเทียบเท่าลดต้นลดดอก' : 'Flat-rate financing with its reducing-balance equivalent'],
    ['comp', th ? 'ดอกเบี้ยทบต้น' : 'Compounding', th ? 'เงินฝาก / ลงทุน' : 'Savings', th ? 'เงินต้น เงินฝากรายเดือน และผลตอบแทนทบต้น' : 'Lump sum, monthly deposits and compound growth'],
    ['refi', 'Refinance', th ? 'เปรียบเทียบ' : 'Compare', th ? 'สัญญาเดิมกับสัญญาใหม่ คุ้มหรือไม่ และคืนทุนกี่เดือน' : 'Old vs new contract, net saving and payback period'],
    ['afford', th ? 'กู้ได้เท่าไร' : 'Affordability', 'DSR', th ? 'รายได้เท่านี้ ผ่อนได้เดือนละเท่าไร และกู้ได้ประมาณเท่าไร' : 'What your income can service and roughly what you can borrow']
  ];
  V.cats = TABS.map(c => ({
    tag: c[2], label: c[1], note: c[3], active: s.tab === c[0],
    onClick: () => { patchState({ tab: c[0] }); scrollToEl('calc'); }
  }));

  /* ================= HOME ================= */
  if (s.tab === 'home') {
    const m = homeModel(), hh = s.home, x = s.extra;
    V.panelTitle = th ? 'สินเชื่อบ้าน' : 'Home loan';
    V.panelNote = th ? 'ลดต้นลดดอก — ดอกเบี้ยคิดจากยอดหนี้คงเหลือทุกงวด' : 'Reducing balance — interest is charged on what is still owed';
    V.fields = [
      makeNumField('home', 'price', { label: th ? 'ราคาบ้าน' : 'Property price', unit: '฿' }),
      makeNumField('home', 'downPct', { label: th ? 'เงินดาวน์' : 'Down payment', unit: '%', plain: true, hint: (th ? 'เท่ากับ ' : 'That is ') + b(m.down) + (th ? ' · เงินกู้จริง ' : ' · loan ') + b(m.loan) }),
      makeNumField('home', 'years', { label: th ? 'ระยะเวลากู้' : 'Term', unit: th ? 'ปี' : 'years', plain: true, hint: m.months + ' ' + Lx.months }),
      makeNumField('home', 'fees', { label: th ? 'ค่าธรรมเนียมและค่าประเมิน' : 'Fees and valuation', unit: '฿' })
    ];
    if (!hh.stepup) V.fields.splice(2, 0, makeNumField('home', 'rate', { label: th ? 'อัตราดอกเบี้ยต่อปี' : 'Annual interest rate', unit: '%', plain: true }));
    V.stepFields = [0, 1, 2, 3].map(i => {
      const rk = 'home.steps.' + i;
      const raw = state.raw[rk];
      return {
        label: i < 3 ? (th ? 'ปีที่ ' + (i + 1) : 'Year ' + (i + 1)) : (th ? 'ปีที่ 4 ขึ้นไป' : 'Year 4 onward'),
        display: raw !== undefined ? raw : String(hh.steps[i]),
        onChange: e => {
          const txt = e.target.value;
          const v = parseFloat(txt.replace(/[^0-9.]/g, ''));
          state.raw[rk] = txt;
          const st = hh.steps.slice(); st[i] = isNaN(v) ? 0 : v;
          state.home.steps = st;
          scheduleRender();
        },
        onBlur: () => { if (suppressBlur) return; delete state.raw[rk]; scheduleRender(); }
      };
    });

    V.hasExtraPanel = true;
    const modes = [['none', th ? 'ไม่โปะ' : 'None'], ['monthly', th ? 'ทุกเดือน' : 'Monthly'], ['annual', th ? 'ปีละครั้ง' : 'Yearly'], ['lump', th ? 'ก้อนเดียว' : 'Lump']];
    V.extraModes = modes.map(o => segOpt(o[1], x.mode === o[0], () => setField('extra', 'mode', o[0])));
    V.showExtraAmt = x.mode !== 'none';
    V.showLumpMonth = x.mode === 'lump';
    V.extraAmtLabel = x.mode === 'lump' ? (th ? 'จำนวนเงินโปะ' : 'Lump sum') : (th ? 'โปะเพิ่มต่อครั้ง' : 'Extra per payment');
    V.extraAmtText = b(x.amount);
    V.extraSliderMax = x.mode === 'lump' ? Math.max(100000, Math.round(m.loan / 2)) : 50000;
    V.extraSliderStep = x.mode === 'lump' ? 10000 : 500;
    V.extraSliderVal = x.amount;
    /* 'input' fires continuously while dragging; only patch the live
       number, don't touch the DOM tree or the slider's own node would
       lose the browser's native drag capture mid-drag. Full recompute
       happens on 'change', once the drag is over. */
    V.onExtraSlider = e => { state.extra.amount = parseFloat(e.target.value); livePatchExtra(); };
    V.onExtraSliderCommit = () => scheduleRender();
    const lumpRk = 'extra.lumpMonth';
    const lumpRaw = state.raw[lumpRk];
    V.lumpMonthVal = lumpRaw !== undefined ? lumpRaw : String(x.lumpMonth);
    V.onLumpMonth = e => {
      const txt = e.target.value;
      const v = parseInt(txt.replace(/[^0-9]/g, ''), 10);
      state.raw[lumpRk] = txt;
      state.extra.lumpMonth = isNaN(v) ? 1 : Math.max(1, v);
      scheduleRender();
    };
    V.onLumpMonthBlur = () => { if (suppressBlur) return; delete state.raw[lumpRk]; scheduleRender(); };

    if (ok) {
      const A = m.active, B = m.base;
      const total = A.totalPayment + m.fees;
      V.resultCaption = (th ? 'เงินกู้ ' : 'Loan ') + b(m.loan) + ' · ' + (hh.stepup ? (th ? 'ดอกเบี้ยขั้นบันได' : 'step-up rate') : hh.rate + '%') + ' · ' + dur(A.months);
      V.bigCards = [
        { label: th ? 'เงินกู้ทั้งหมด' : 'Amount borrowed', value: bshort(m.loan), sub: (th ? 'ดาวน์ ' : 'Down ') + b(m.down), color: '#f3f5fe' },
        { label: th ? 'ค่างวดต่อเดือน' : 'Monthly payment', value: b(A.rows[0] ? A.rows[0].payment : 0), sub: hh.stepup ? (th ? 'งวดแรก · เปลี่ยนตามขั้นดอกเบี้ย' : 'first period · changes with each step') : (th ? 'คงที่ทั้งสัญญา' : 'fixed for the term'), color: '#f3f5fe' },
        { label: th ? 'ดอกเบี้ยทั้งหมด' : 'Total interest', value: bshort(A.totalInterest), sub: n(A.totalInterest / m.loan * 100, 0) + (th ? '% ของเงินกู้' : '% of the loan'), color: '#b5abfc' },
        { label: th ? 'จ่ายทั้งหมด' : 'Total paid', value: bshort(total), sub: A.months + ' ' + Lx.months + (m.fees ? (th ? ' + ค่าธรรมเนียม' : ' + fees') : ''), color: '#f3f5fe' }
      ];
      V.narrative = th
        ? 'คุณกู้ ' + bshort(m.loan) + ' ที่ค่างวด ' + b(A.rows[0].payment) + ' ต่อเดือน ตลอด ' + dur(A.months) + ' คุณจะจ่ายเงินจริงประมาณ ' + bshort(total) + ' โดยเป็นดอกเบี้ยประมาณ ' + bshort(A.totalInterest) + ' หรือคิดเป็น ' + n(A.totalInterest / total * 100, 0) + '% ของเงินที่จ่ายออกไปทั้งหมด'
        : 'You borrow ' + bshort(m.loan) + ' at ' + b(A.rows[0].payment) + ' a month. Over ' + dur(A.months) + ' you will pay about ' + bshort(total) + ', of which roughly ' + bshort(A.totalInterest) + ' is interest — ' + n(A.totalInterest / total * 100, 0) + '% of everything you hand over.';

      V.hasBreakdown = true;
      V.breakdownTitle = th ? 'เงินที่จ่ายทั้งหมดแบ่งเป็นอะไร' : 'What your total payment is made of';
      V.pctA = (m.loan / total * 100).toFixed(2);
      V.pctB = (A.totalInterest / total * 100).toFixed(2);
      V.pctC = (m.fees / total * 100).toFixed(2);
      V.pctAText = n(m.loan / total * 100, 0) + '%';
      V.pctBText = n(A.totalInterest / total * 100, 0) + '%';
      V.legend = [
        { color: '#b2b6ca', label: th ? 'เงินต้น' : 'Principal', value: bshort(m.loan) },
        { color: '#9184d9', label: th ? 'ดอกเบี้ย' : 'Interest', value: bshort(A.totalInterest) },
        { color: '#595d6c', label: th ? 'ค่าธรรมเนียม' : 'Fees', value: bshort(m.fees) }
      ];

      V.hasCharts = true;
      const yearEnds = [m.loan].concat(A.rows.filter(r => r.m % 12 === 0).map(r => r.balance));
      const c = curveFrom(yearEnds);
      V.curveTitle = th ? 'ยอดหนี้คงเหลือ' : 'Remaining balance';
      V.curveNote = th ? 'สิ้นปีที่เท่าไร เหลือหนี้เท่าไร' : 'What is left at the end of each year';
      V.curveArea = c.d; V.curvePoints = c.poly;
      const lastY = Math.ceil(A.months / 12);
      V.curveTicks = [0, 1, 2, 3, 4].map(i => (th ? 'ปี ' : 'Y') + Math.round(i * lastY / 4));
      const at = y => { const r = A.rows.filter(r => r.m <= y * 12).pop(); return r ? r.balance : m.loan; };
      V.curveMarks = [1, 5, 10, lastY].filter((y, i, arr) => arr.indexOf(y) === i && y <= lastY)
        .map(y => ({ label: (th ? 'สิ้นปีที่ ' : 'End of year ') + y, value: bshort(at(y)) }));
      V.barsTitle = th ? 'เงินต้นกับดอกเบี้ยในแต่ละปี' : 'Principal vs interest by year';
      V.barsNote = th ? 'แถบสีม่วงคือดอกเบี้ย ช่วงแรกกินค่างวดเกือบทั้งก้อน' : 'Purple is interest — early on it takes nearly the whole instalment';
      V.yearBars = computeBars(A.rows, 'principal', 'interest');
      V.barsFirst = (th ? 'ปีที่ 1' : 'Year 1'); V.barsLast = (th ? 'ปีที่ ' : 'Year ') + lastY;

      V.hasExtraCompare = true;
      const maxTotal = B.totalPayment;
      V.extraRows = [0, 2000, 5000, 10000].map(amt => {
        const r = amt === 0 ? B : ENGINE.amortize({ principal: m.loan, months: m.months, sched: m.sched, extraMonthly: amt });
        const w = r.totalPayment / maxTotal * 100;
        return {
          label: amt === 0 ? (th ? 'จ่ายตามค่างวด' : 'Scheduled only') : (th ? 'โปะเพิ่ม ' : '+') + n(amt) + (th ? ' /เดือน' : '/mo'),
          detail: dur(r.months) + ' · ' + (th ? 'ดอกเบี้ย ' : 'interest ') + bshort(r.totalInterest) + (amt ? ' · ' + (th ? 'ประหยัด ' : 'saves ') + bshort(B.totalInterest - r.totalInterest) : ''),
          pW: (m.loan / maxTotal * 100).toFixed(2), iW: (r.totalInterest / maxTotal * 100).toFixed(2)
        };
      });

      V.hasWhatIf = true;
      V.whatIfNote = (th ? 'ตอนนี้ดาวน์ ' : 'Currently ') + n(hh.downPct, 0) + '% · ' + b(m.down);
      V.downPctVal = hh.downPct;
      V.onDownSlider = e => { state.home.downPct = parseFloat(e.target.value); livePatchWhatIf(); };
      V.onDownSliderCommit = () => scheduleRender();
      const base20 = ENGINE.amortize({ principal: hh.price * (1 - DEFAULTS.home.downPct / 100), months: m.months, sched: m.sched });
      const d = (a, bb) => {
        const diff = a - bb;
        if (Math.abs(diff) < 1) return { txt: th ? 'เท่าเดิม' : 'unchanged', col: '#9397ab' };
        const good = diff < 0;
        return { txt: (diff < 0 ? '−' : '+') + bshort(Math.abs(diff)), col: good ? '#b5abfc' : '#9397ab' };
      };
      const dPay = d(A.rows[0].payment, base20.rows[0].payment);
      const dInt = d(A.totalInterest, base20.totalInterest);
      const dTot = d(A.totalPayment, base20.totalPayment);
      V.whatIfRows = [
        { label: th ? 'เงินกู้' : 'Loan', value: bshort(m.loan), delta: (th ? 'ดาวน์ ' : 'down ') + bshort(m.down), color: '#9397ab' },
        { label: th ? 'ค่างวด' : 'Payment', value: b(A.rows[0].payment), delta: dPay.txt + (th ? ' เทียบดาวน์ 20%' : ' vs 20% down'), color: dPay.col },
        { label: th ? 'ดอกเบี้ยรวม' : 'Total interest', value: bshort(A.totalInterest), delta: dInt.txt, color: dInt.col },
        { label: th ? 'จ่ายทั้งหมด' : 'Total paid', value: bshort(A.totalPayment), delta: dTot.txt, color: dTot.col }
      ];

      V.hasAmort = true;
      V.amortTitle = th ? 'ตารางผ่อนชำระ' : 'Amortization schedule';
      V.amortNote = th ? 'ทุกงวดแยกเงินต้น ดอกเบี้ย และยอดคงเหลือ — ตัวเลขเดียวกับที่ใช้คำนวณสรุปด้านบน' : 'Principal, interest and balance for every period — the same numbers behind the summary above';
      fillAmort(V, A.rows, 'home-loan');
    }
  }

  /* ================= AUTO ================= */
  if (s.tab === 'auto') {
    const m = autoModel(), a = s.auto;
    V.panelTitle = th ? 'สินเชื่อรถยนต์' : 'Auto loan';
    V.panelNote = th ? 'Flat Rate — ดอกเบี้ยคิดจากยอดจัดเต็มจำนวนตลอดสัญญา' : 'Flat rate — interest is charged on the full financed amount throughout';
    V.fields = [
      makeNumField('auto', 'price', { label: th ? 'ราคารถ' : 'Vehicle price', unit: '฿' }),
      makeNumField('auto', 'downPct', { label: th ? 'เงินดาวน์' : 'Down payment', unit: '%', plain: true, hint: (th ? 'เท่ากับ ' : 'That is ') + b(m.down) + (th ? ' · ยอดจัด ' : ' · financed ') + b(m.loan) }),
      makeNumField('auto', 'rate', { label: th ? 'ดอกเบี้ย Flat Rate ต่อปี' : 'Flat rate per year', unit: '%', plain: true }),
      makeNumField('auto', 'years', { label: th ? 'ระยะเวลาผ่อน' : 'Term', unit: th ? 'ปี' : 'years', plain: true, hint: m.months + ' ' + Lx.months }),
      makeNumField('auto', 'balloon', { label: th ? 'Balloon payment (ถ้ามี)' : 'Balloon payment (optional)', unit: '฿', hint: th ? 'ยอดก้อนใหญ่ที่จ่ายงวดสุดท้าย' : 'A large final payment at the end of the term' }),
      makeNumField('auto', 'fees', { label: th ? 'ค่าธรรมเนียมและค่าโอน' : 'Fees and transfer', unit: '฿' })
    ];
    V.flatBoxBody = th
      ? 'Flat Rate คิดดอกเบี้ยจากยอดจัดเต็มจำนวนทุกงวด ไม่ว่าคุณจะผ่อนไปแล้วเท่าไร ส่วนลดต้นลดดอกคิดจากหนี้ที่เหลือจริง ดอกเบี้ย Flat ' + a.rate + '% ที่คุณกรอกไว้ จึงมีต้นทุนจริงใกล้เคียง ' + n(m.flat.effAnnual, 2) + '% แบบลดต้นลดดอก'
      : 'A flat rate charges interest on the full financed amount every period, no matter how much you have repaid; a reducing balance charges only on what is left. The ' + a.rate + '% flat rate you entered really costs about ' + n(m.flat.effAnnual, 2) + '% on a reducing balance.';

    if (ok) {
      const f = m.flat, total = f.totalPayment + m.fees;
      V.resultCaption = (th ? 'ยอดจัด ' : 'Financed ') + b(m.loan) + ' · Flat ' + a.rate + '% · ' + dur(m.months);
      V.bigCards = [
        { label: th ? 'ยอดจัดไฟแนนซ์' : 'Amount financed', value: bshort(m.loan), sub: (th ? 'ดาวน์ ' : 'Down ') + b(m.down), color: '#f3f5fe' },
        { label: th ? 'ค่างวดต่อเดือน' : 'Monthly payment', value: b(f.payment), sub: m.months + ' ' + Lx.months, color: '#f3f5fe' },
        { label: th ? 'ดอกเบี้ยทั้งหมด' : 'Total interest', value: bshort(f.totalInterest), sub: (th ? 'เทียบเท่า ' : 'equals ') + n(f.effAnnual, 2) + (th ? '% ลดต้นลดดอก' : '% reducing'), color: '#b5abfc' },
        { label: th ? 'จ่ายทั้งหมด' : 'Total paid', value: bshort(total), sub: m.fees ? (th ? 'รวมค่าธรรมเนียม' : 'including fees') : (th ? 'ไม่รวมค่าประกัน' : 'excluding insurance'), color: '#f3f5fe' }
      ];
      V.narrative = th
        ? 'ยอดจัด ' + bshort(m.loan) + ' ที่ดอกเบี้ย Flat ' + a.rate + '% เป็นเวลา ' + dur(m.months) + ' ทำให้ค่างวดคงที่ ' + b(f.payment) + ' ต่อเดือน ดอกเบี้ยรวม ' + bshort(f.totalInterest) + ' และจ่ายจริงทั้งหมด ' + bshort(total) + ' ดอกเบี้ย Flat ' + a.rate + '% นี้เทียบเท่าดอกเบี้ยแบบลดต้นลดดอกประมาณ ' + n(f.effAnnual, 2) + '% ซึ่งเป็นตัวเลขที่ควรใช้เทียบกับสินเชื่อประเภทอื่น'
        : 'Financing ' + bshort(m.loan) + ' at a ' + a.rate + '% flat rate for ' + dur(m.months) + ' fixes the instalment at ' + b(f.payment) + ' a month, ' + bshort(f.totalInterest) + ' of interest and ' + bshort(total) + ' paid in total. That flat rate is equivalent to roughly ' + n(f.effAnnual, 2) + '% on a reducing balance — the number to use when comparing with other loans.';

      V.hasBreakdown = true;
      V.breakdownTitle = th ? 'เงินที่จ่ายทั้งหมดแบ่งเป็นอะไร' : 'What your total payment is made of';
      V.pctA = (m.loan / total * 100).toFixed(2);
      V.pctB = (f.totalInterest / total * 100).toFixed(2);
      V.pctC = (m.fees / total * 100).toFixed(2);
      V.pctAText = n(m.loan / total * 100, 0) + '%';
      V.pctBText = n(f.totalInterest / total * 100, 0) + '%';
      V.legend = [
        { color: '#b2b6ca', label: th ? 'เงินต้น' : 'Principal', value: bshort(m.loan) },
        { color: '#9184d9', label: th ? 'ดอกเบี้ย' : 'Interest', value: bshort(f.totalInterest) },
        { color: '#595d6c', label: th ? 'ค่าธรรมเนียม' : 'Fees', value: bshort(m.fees) }
      ];

      V.hasCharts = true;
      const ye = [m.loan].concat(f.rows.filter(r => r.m % 12 === 0).map(r => r.balance));
      const c = curveFrom(ye);
      V.curveTitle = th ? 'ยอดหนี้คงเหลือ' : 'Remaining balance';
      V.curveNote = th ? 'Flat Rate ลดเงินต้นเป็นเส้นตรง เพราะแบ่งเงินต้นเท่ากันทุกงวด' : 'A flat-rate loan retires principal in a straight line — equal principal every period';
      V.curveArea = c.d; V.curvePoints = c.poly;
      const lastY = Math.ceil(m.months / 12);
      V.curveTicks = [0, 1, 2, 3, 4].map(i => (th ? 'ปี ' : 'Y') + Math.round(i * lastY / 4));
      V.curveMarks = f.rows.filter(r => r.m % 12 === 0).map(r => ({ label: (th ? 'สิ้นปีที่ ' : 'End of year ') + (r.m / 12), value: bshort(r.balance) }));
      V.barsTitle = th ? 'เงินต้นกับดอกเบี้ยในแต่ละปี' : 'Principal vs interest by year';
      V.barsNote = th ? 'Flat Rate จ่ายดอกเบี้ยเท่ากันทุกงวดจนงวดสุดท้าย' : 'A flat rate charges the same interest every period, right to the end';
      V.yearBars = computeBars(f.rows, 'principal', 'interest');
      V.barsFirst = (th ? 'ปีที่ 1' : 'Year 1'); V.barsLast = (th ? 'ปีที่ ' : 'Year ') + lastY;

      V.hasTable2 = true;
      V.table2Title = th ? 'Flat Rate เทียบกับลดต้นลดดอกที่อัตราเดียวกัน' : 'The same rate, charged two different ways';
      V.table2Heads = [{ label: th ? 'รายการ' : 'Item', align: 'left' }, { label: 'Flat ' + a.rate + '%', align: 'right' }, { label: (th ? 'ลดต้นลดดอก ' : 'Reducing ') + a.rate + '%', align: 'right' }];
      const pair = (label, x, y) => ({ label, cells: [{ text: x, weight: 500, color: '#e9e9ed' }, { text: y, weight: 400, color: '#9397ab' }] });
      V.table2Rows = [
        pair(th ? 'ค่างวดต่อเดือน' : 'Monthly payment', b(f.payment), b(m.red.rows[0].payment)),
        pair(th ? 'ดอกเบี้ยทั้งหมด' : 'Total interest', b(f.totalInterest), b(m.red.totalInterest)),
        pair(th ? 'จ่ายทั้งหมด' : 'Total paid', b(f.totalPayment), b(m.red.totalPayment)),
        pair(th ? 'อัตราเทียบเท่า (Effective)' : 'Effective rate', n(f.effAnnual, 2) + '%', n(a.rate, 2) + '%')
      ];
      V.table2Foot = th
        ? 'ตัวเลขสองคอลัมน์นี้มาจากสูตรที่แยกกันคนละชุด ไม่ใช่สูตรเดียวกัน สินเชื่อรถในไทยส่วนใหญ่เสนอเป็น Flat Rate ซึ่งตัวเลขดูต่ำกว่าความจริงเมื่อเทียบกับสินเชื่อบ้าน ใช้คอลัมน์อัตราเทียบเท่าในการเปรียบเทียบ'
        : 'The two columns come from two separate formulas, not one. Vehicle finance is usually quoted as a flat rate, which looks lower than it is next to a mortgage — compare using the effective rate.';

      V.hasWhatIf = true;
      V.whatIfNote = (th ? 'ตอนนี้ดาวน์ ' : 'Currently ') + n(a.downPct, 0) + '% · ' + b(m.down);
      V.downPctVal = a.downPct;
      V.onDownSlider = e => { state.auto.downPct = parseFloat(e.target.value); livePatchWhatIf(); };
      V.onDownSliderCommit = () => scheduleRender();
      const b20 = ENGINE.flat(a.price * (1 - DEFAULTS.auto.downPct / 100), a.rate, m.months, a.balloon);
      const dd = (x, y) => { const diff = x - y; return Math.abs(diff) < 1 ? { txt: th ? 'เท่าเดิม' : 'unchanged', col: '#9397ab' } : { txt: (diff < 0 ? '−' : '+') + bshort(Math.abs(diff)), col: diff < 0 ? '#b5abfc' : '#9397ab' }; };
      const p1 = dd(f.payment, b20.payment), i1 = dd(f.totalInterest, b20.totalInterest), t1 = dd(f.totalPayment, b20.totalPayment);
      V.whatIfRows = [
        { label: th ? 'ยอดจัด' : 'Financed', value: bshort(m.loan), delta: (th ? 'ดาวน์ ' : 'down ') + bshort(m.down), color: '#9397ab' },
        { label: th ? 'ค่างวด' : 'Payment', value: b(f.payment), delta: p1.txt + (th ? ' เทียบดาวน์ 20%' : ' vs 20% down'), color: p1.col },
        { label: th ? 'ดอกเบี้ยรวม' : 'Total interest', value: bshort(f.totalInterest), delta: i1.txt, color: i1.col },
        { label: th ? 'จ่ายทั้งหมด' : 'Total paid', value: bshort(f.totalPayment), delta: t1.txt, color: t1.col }
      ];

      V.hasAmort = true;
      V.amortTitle = th ? 'ตารางผ่อนชำระ (Flat Rate)' : 'Payment schedule (flat rate)';
      V.amortNote = th ? 'ดอกเบี้ยเท่ากันทุกงวดเพราะคิดจากยอดจัดเต็มจำนวน' : 'Interest is identical every period because it is charged on the original amount';
      fillAmort(V, f.rows, 'auto-loan');
    }
  }
  /* ================= COMPOUND ================= */
  if (s.tab === 'comp') {
    const c = s.comp;
    V.panelTitle = th ? 'ดอกเบี้ยทบต้น / เงินฝาก' : 'Compound interest';
    V.panelNote = th ? 'ผลตอบแทนที่ได้ถูกทบเข้าเงินต้น แล้วสร้างผลตอบแทนต่อในรอบถัดไป' : 'Each period’s return joins the principal and earns in turn';
    V.fields = [
      makeNumField('comp', 'pv', { label: th ? 'เงินต้นเริ่มต้น' : 'Starting amount', unit: '฿' }),
      makeNumField('comp', 'monthly', { label: th ? 'ฝากเพิ่มต่อเดือน' : 'Monthly deposit', unit: '฿' }),
      makeNumField('comp', 'rate', { label: th ? 'ผลตอบแทนต่อปี' : 'Annual return', unit: '%', plain: true }),
      makeNumField('comp', 'years', { label: th ? 'ระยะเวลา' : 'Horizon', unit: th ? 'ปี' : 'years', plain: true }),
      makeSelect('f-comp-perYear', th ? 'ความถี่ในการทบต้น' : 'Compounding frequency', c.perYear,
        FREQ.map(f => ({ value: String(f[0]), label: th ? f[1] : f[2] })),
        e => setField('comp', 'perYear', parseInt(e.target.value, 10))),
      makeNumField('comp', 'goal', { label: th ? 'เป้าหมายเงิน (ถ้ามี)' : 'Target amount (optional)', unit: '฿', hint: th ? 'ใส่เพื่อดูว่าต้องออมเดือนละเท่าไรจึงถึงเป้า' : 'Enter a target to see the monthly saving it needs' })
    ];

    if (ok) {
      const m = compModel(), R = m.res;
      V.resultCaption = n(c.rate, 2) + (th ? '% ต่อปี · ทบ' : '% a year · compounded ') + (th ? FREQ.find(f => f[0] === c.perYear)[1] : FREQ.find(f => f[0] === c.perYear)[2].toLowerCase()) + ' · ' + dur(R.months);
      V.bigCards = [
        { label: th ? 'เงินที่ใส่ทั้งหมด' : 'Total contributed', value: bshort(R.contrib), sub: (th ? 'เริ่มต้น ' : 'from ') + bshort(c.pv) + (c.monthly ? (th ? ' + ' + n(c.monthly) + '/เดือน' : ' + ' + n(c.monthly) + '/mo') : ''), color: '#f3f5fe' },
        { label: th ? 'ผลตอบแทนทั้งหมด' : 'Total return', value: bshort(R.gain), sub: n(R.gain / Math.max(1, R.contrib) * 100, 0) + (th ? '% ของเงินที่ใส่' : '% of contributions'), color: '#b5abfc' },
        { label: th ? 'มูลค่ารวมปลายทาง' : 'Final value', value: bshort(R.final), sub: dur(R.months), color: '#f3f5fe' },
        m.need > 0
          ? { label: th ? 'ต้องออมเดือนละ' : 'Needed per month', value: b(m.need), sub: (th ? 'เพื่อถึง ' : 'to reach ') + bshort(c.goal), color: '#f3f5fe' }
          : { label: th ? 'สัดส่วนที่มาจากการทบต้น' : 'Share from compounding', value: n(R.gain / Math.max(1, R.final) * 100, 0) + '%', sub: th ? 'ของมูลค่าปลายทาง' : 'of the final value', color: '#f3f5fe' }
      ];
      V.narrative = th
        ? 'ถ้าคุณเริ่มด้วย ' + bshort(c.pv) + (c.monthly ? ' และฝากเพิ่ม ' + b(c.monthly) + ' ทุกเดือน' : '') + ' ที่ผลตอบแทน ' + n(c.rate, 2) + '% ต่อปี เป็นเวลา ' + dur(R.months) + ' คุณจะใส่เงินไปทั้งหมด ' + bshort(R.contrib) + ' และได้ผลตอบแทนอีก ' + bshort(R.gain) + ' รวมเป็น ' + bshort(R.final) + (m.need > 0 ? ' ถ้าต้องการให้ถึงเป้า ' + bshort(c.goal) + ' ต้องออมเดือนละ ' + b(m.need) : '')
        : 'Starting with ' + bshort(c.pv) + (c.monthly ? ' and adding ' + b(c.monthly) + ' every month' : '') + ' at ' + n(c.rate, 2) + '% a year for ' + dur(R.months) + ', you contribute ' + bshort(R.contrib) + ' and earn ' + bshort(R.gain) + ' on top, ending at ' + bshort(R.final) + (m.need > 0 ? '. To reach ' + bshort(c.goal) + ' you would need to save ' + b(m.need) + ' a month.' : '.');

      V.hasBreakdown = true;
      V.breakdownTitle = th ? 'มูลค่าปลายทางแบ่งเป็นอะไร' : 'What the final value is made of';
      V.pctA = (R.contrib / R.final * 100).toFixed(2);
      V.pctB = (R.gain / R.final * 100).toFixed(2);
      V.pctC = '0';
      V.pctAText = n(R.contrib / R.final * 100, 0) + '%';
      V.pctBText = n(R.gain / R.final * 100, 0) + '%';
      V.legend = [
        { color: '#b2b6ca', label: th ? 'เงินที่ใส่' : 'Contributed', value: bshort(R.contrib) },
        { color: '#9184d9', label: th ? 'ผลตอบแทน' : 'Return', value: bshort(R.gain) }
      ];

      V.hasCharts = true;
      const cur = curveFrom(R.series.map(p => p.balance));
      V.curveTitle = th ? 'มูลค่าพอร์ตตามเวลา' : 'Value over time';
      V.curveNote = th ? 'เส้นชันขึ้นเรื่อยๆ คือผลของการทบต้น' : 'The curve steepens — that is compounding at work';
      V.curveArea = cur.d; V.curvePoints = cur.poly;
      const ly = Math.ceil(c.years);
      V.curveTicks = [0, 1, 2, 3, 4].map(i => (th ? 'ปี ' : 'Y') + Math.round(i * ly / 4));
      V.curveMarks = R.series.filter(p => p.month > 0 && (p.month / 12 === ly || [1, 5, 10, 20].indexOf(p.month / 12) >= 0))
        .map(p => ({ label: (th ? 'สิ้นปีที่ ' : 'End of year ') + Math.round(p.month / 12), value: bshort(p.balance) }));
      V.barsTitle = th ? 'เงินที่ใส่กับผลตอบแทนในแต่ละปี' : 'Contributions vs return by year';
      V.barsNote = th ? 'แถบสีม่วงคือผลตอบแทนสะสม ซึ่งค่อยๆ แซงเงินที่ใส่' : 'Purple is cumulative return, gradually overtaking what you put in';
      const maxV = R.series[R.series.length - 1].balance || 1;
      V.yearBars = R.series.filter(p => p.month > 0).map(p => ({
        aH: (p.contrib / maxV * 100).toFixed(2), bH: (p.gain / maxV * 100).toFixed(2),
        title: (th ? 'ปีที่ ' : 'Year ') + Math.round(p.month / 12) + ' · ' + bshort(p.balance)
      }));
      V.barsFirst = (th ? 'ปีที่ 1' : 'Year 1'); V.barsLast = (th ? 'ปีที่ ' : 'Year ') + ly;

      V.hasTable2 = true;
      V.table2Title = th ? 'เงินโตขึ้นปีต่อปี' : 'Year by year';
      V.table2Heads = [
        { label: th ? 'สิ้นปีที่' : 'End of year', align: 'left' },
        { label: th ? 'เงินที่ใส่สะสม' : 'Contributed', align: 'right' },
        { label: th ? 'ผลตอบแทนสะสม' : 'Return', align: 'right' },
        { label: th ? 'มูลค่ารวม' : 'Value', align: 'right' }
      ];
      V.table2Rows = R.series.filter(p => p.month > 0).map(p => ({
        label: String(Math.round(p.month / 12)),
        cells: [
          { text: b(p.contrib), weight: 400, color: '#9397ab' },
          { text: b(p.gain), weight: 400, color: '#b5abfc' },
          { text: b(p.balance), weight: 500, color: '#e9e9ed' }
        ]
      }));
    }
  }

  /* ================= REFINANCE ================= */
  if (s.tab === 'refi') {
    const r = s.refi;
    V.panelTitle = 'Refinance';
    V.panelNote = th ? 'เทียบสัญญาเดิมที่เหลือ กับสัญญาใหม่รวมค่าธรรมเนียมย้าย' : 'Your remaining contract against a new one, fees included';
    V.fields = [
      makeNumField('refi', 'balance', { label: th ? 'ยอดหนี้คงเหลือ' : 'Outstanding balance', unit: '฿' }),
      makeNumField('refi', 'oldRate', { label: th ? 'ดอกเบี้ยปัจจุบัน' : 'Current rate', unit: '%', plain: true }),
      makeNumField('refi', 'monthsLeft', { label: th ? 'จำนวนงวดที่เหลือ' : 'Periods remaining', unit: th ? 'งวด' : 'periods', plain: true, hint: dur(Math.round(r.monthsLeft)) }),
      makeNumField('refi', 'newRate', { label: th ? 'ดอกเบี้ยสัญญาใหม่' : 'New rate', unit: '%', plain: true }),
      makeNumField('refi', 'newYears', { label: th ? 'ระยะเวลาสัญญาใหม่' : 'New term', unit: th ? 'ปี' : 'years', plain: true }),
      makeNumField('refi', 'fees', { label: th ? 'ค่าธรรมเนียมในการย้าย' : 'Cost to refinance', unit: '฿', hint: th ? 'ค่าจดจำนอง ค่าประเมิน ค่าปรับปิดก่อนกำหนด' : 'Registration, valuation, prepayment penalty' }),
      makeSeg(th ? 'ค่าธรรมเนียม' : 'Fees', [
        segOpt(th ? 'จ่ายสด' : 'Pay upfront', !r.rollFees, () => setField('refi', 'rollFees', 0)),
        segOpt(th ? 'รวมในวงเงิน' : 'Roll into loan', !!r.rollFees, () => setField('refi', 'rollFees', 1))
      ])
    ];

    if (ok) {
      const m = refiModel();
      const worth = m.netSaving > 0;
      V.resultCaption = r.oldRate + '% → ' + r.newRate + '% · ' + dur(Math.round(r.monthsLeft)) + ' → ' + dur(Math.round(r.newYears * 12));
      V.bigCards = [
        { label: th ? 'ค่างวดใหม่' : 'New payment', value: b(m.newL.basePayment), sub: (m.monthlySave >= 0 ? (th ? 'ลดลง ' : 'down ') : (th ? 'เพิ่มขึ้น ' : 'up ')) + b(Math.abs(m.monthlySave)), color: '#f3f5fe' },
        { label: th ? 'ดอกเบี้ยที่ประหยัด' : 'Interest saved', value: bshort(m.oldL.totalInterest - m.newL.totalInterest), sub: bshort(m.oldL.totalInterest) + ' → ' + bshort(m.newL.totalInterest), color: '#b5abfc' },
        { label: th ? 'ประหยัดสุทธิหลังค่าธรรมเนียม' : 'Net saving after fees', value: bshort(m.netSaving), sub: (th ? 'ค่าธรรมเนียม ' : 'fees ') + b(r.fees), color: worth ? '#f3f5fe' : '#d98484' },
        { label: th ? 'ระยะเวลาคืนทุน' : 'Payback period', value: isFinite(m.breakeven) ? n(m.breakeven, 1) + ' ' + Lx.month : '—', sub: th ? 'จากค่างวดที่ลดลง' : 'from the lower instalment', color: '#f3f5fe' }
      ];
      V.narrative = th
        ? (worth
          ? 'การย้ายสินเชื่อจาก ' + r.oldRate + '% ไป ' + r.newRate + '% ทำให้ค่างวดเปลี่ยนจาก ' + b(m.oldL.basePayment) + ' เป็น ' + b(m.newL.basePayment) + ' และประหยัดดอกเบี้ยได้ ' + bshort(m.oldL.totalInterest - m.newL.totalInterest) + ' เมื่อหักค่าธรรมเนียม ' + b(r.fees) + ' แล้วยังประหยัดสุทธิ ' + bshort(m.netSaving) + ' และคืนทุนค่าธรรมเนียมภายใน ' + n(m.breakeven, 1) + ' เดือน'
          : 'ที่เงื่อนไขนี้ การย้ายสินเชื่อยังไม่คุ้ม เพราะดอกเบี้ยที่ประหยัดได้น้อยกว่าค่าธรรมเนียมและระยะเวลาที่ยืดออกไป ผลลัพธ์สุทธิคือจ่ายเพิ่มประมาณ ' + bshort(Math.abs(m.netSaving)) + ' ลองลดระยะเวลาสัญญาใหม่ หรือต่อรองค่าธรรมเนียมให้ต่ำลง')
        : (worth
          ? 'Moving from ' + r.oldRate + '% to ' + r.newRate + '% changes the instalment from ' + b(m.oldL.basePayment) + ' to ' + b(m.newL.basePayment) + ' and saves ' + bshort(m.oldL.totalInterest - m.newL.totalInterest) + ' of interest. After ' + b(r.fees) + ' in fees the net saving is ' + bshort(m.netSaving) + ', with the fees paid back in ' + n(m.breakeven, 1) + ' months.'
          : 'On these terms refinancing does not pay off: the interest saved is smaller than the fees and the longer term. You would end up paying about ' + bshort(Math.abs(m.netSaving)) + ' more. Try a shorter new term or negotiate the fees down.');

      V.hasTable2 = true;
      V.table2Title = th ? 'สัญญาเดิมกับสัญญาใหม่' : 'Old contract vs new';
      V.table2Verdict = worth ? (th ? 'คุ้ม — ประหยัดสุทธิ ' : 'Worth it — net saving of ') + bshort(m.netSaving) : (th ? 'ยังไม่คุ้มที่เงื่อนไขนี้' : 'Not worth it on these terms');
      V.table2VerdictColor = worth ? '#b5abfc' : '#d98484';
      V.table2Heads = [{ label: th ? 'รายการ' : 'Item', align: 'left' }, { label: th ? 'สัญญาเดิม' : 'Old', align: 'right' }, { label: th ? 'สัญญาใหม่' : 'New', align: 'right' }];
      const row = (label, a, bb) => ({ label, cells: [{ text: a, weight: 400, color: '#9397ab' }, { text: bb, weight: 500, color: '#e9e9ed' }] });
      V.table2Rows = [
        row(th ? 'ดอกเบี้ย' : 'Rate', r.oldRate + '%', r.newRate + '%'),
        row(th ? 'เงินต้นตั้งต้น' : 'Principal', b(r.balance), b(m.newPrincipal)),
        row(th ? 'ค่างวดต่อเดือน' : 'Monthly payment', b(m.oldL.basePayment), b(m.newL.basePayment)),
        row(th ? 'จำนวนงวด' : 'Periods', Math.round(r.monthsLeft) + '', m.newL.months + ''),
        row(th ? 'ดอกเบี้ยทั้งหมด' : 'Total interest', b(m.oldL.totalInterest), b(m.newL.totalInterest)),
        row(th ? 'จ่ายทั้งหมด (รวมค่าธรรมเนียม)' : 'Total paid (with fees)', b(m.oldTotal), b(m.newTotal))
      ];
      V.table2Foot = th
        ? 'การยืดระยะเวลาออกไปทำให้ค่างวดต่ำลงแต่ดอกเบี้ยรวมอาจสูงขึ้น แม้ดอกเบี้ยต่อปีจะลดลง ลองตั้งระยะเวลาสัญญาใหม่ให้เท่ากับที่เหลืออยู่เดิมเพื่อเทียบกันตรงๆ'
        : 'Stretching the term lowers the instalment but can raise total interest even at a lower rate. Set the new term equal to the periods remaining for a like-for-like comparison.';

      V.hasBreakdown = true;
      V.breakdownTitle = th ? 'สัญญาใหม่: เงินที่จ่ายทั้งหมดแบ่งเป็นอะไร' : 'New contract: what you pay';
      const tot = m.newTotal;
      V.pctA = (r.balance / tot * 100).toFixed(2);
      V.pctB = (m.newL.totalInterest / tot * 100).toFixed(2);
      V.pctC = (r.fees / tot * 100).toFixed(2);
      V.pctAText = n(r.balance / tot * 100, 0) + '%';
      V.pctBText = n(m.newL.totalInterest / tot * 100, 0) + '%';
      V.legend = [
        { color: '#b2b6ca', label: th ? 'เงินต้น' : 'Principal', value: bshort(r.balance) },
        { color: '#9184d9', label: th ? 'ดอกเบี้ย' : 'Interest', value: bshort(m.newL.totalInterest) },
        { color: '#595d6c', label: th ? 'ค่าธรรมเนียม' : 'Fees', value: bshort(r.fees) }
      ];

      V.hasCharts = true;
      const ye = [m.newPrincipal].concat(m.newL.rows.filter(x => x.m % 12 === 0).map(x => x.balance));
      const cur = curveFrom(ye);
      V.curveTitle = th ? 'ยอดหนี้คงเหลือ (สัญญาใหม่)' : 'Remaining balance (new contract)';
      V.curveNote = th ? 'สิ้นปีที่เท่าไร เหลือหนี้เท่าไร' : 'What is left at the end of each year';
      V.curveArea = cur.d; V.curvePoints = cur.poly;
      const ly = Math.ceil(m.newL.months / 12);
      V.curveTicks = [0, 1, 2, 3, 4].map(i => (th ? 'ปี ' : 'Y') + Math.round(i * ly / 4));
      V.curveMarks = [1, 5, 10, ly].filter((y, i, arr) => arr.indexOf(y) === i && y <= ly).map(y => {
        const rr = m.newL.rows.filter(x => x.m <= y * 12).pop();
        return { label: (th ? 'สิ้นปีที่ ' : 'End of year ') + y, value: bshort(rr ? rr.balance : m.newPrincipal) };
      });
      V.barsTitle = th ? 'เงินต้นกับดอกเบี้ยในแต่ละปี' : 'Principal vs interest by year';
      V.barsNote = th ? 'สัญญาใหม่ · แถบสีม่วงคือดอกเบี้ย' : 'New contract · purple is interest';
      V.yearBars = computeBars(m.newL.rows, 'principal', 'interest');
      V.barsFirst = (th ? 'ปีที่ 1' : 'Year 1'); V.barsLast = (th ? 'ปีที่ ' : 'Year ') + ly;

      V.hasAmort = true;
      V.amortTitle = th ? 'ตารางผ่อนชำระ (สัญญาใหม่)' : 'Amortization schedule (new contract)';
      V.amortNote = th ? 'ทุกงวดแยกเงินต้น ดอกเบี้ย และยอดคงเหลือ' : 'Principal, interest and balance for every period';
      fillAmort(V, m.newL.rows, 'refinance');
    }
  }

  /* ================= AFFORDABILITY ================= */
  if (s.tab === 'afford') {
    const a = s.afford;
    V.panelTitle = th ? 'กู้ได้เท่าไร' : 'How much can I borrow';
    V.panelNote = th ? 'ประมาณจากสัดส่วนภาระหนี้ต่อรายได้ ไม่ใช่การอนุมัติจากธนาคาร' : 'Estimated from a debt-service ratio — not a bank approval';
    V.fields = [
      makeNumField('afford', 'income', { label: th ? 'รายได้ต่อเดือน' : 'Monthly income', unit: '฿' }),
      makeNumField('afford', 'expense', { label: th ? 'ค่าใช้จ่ายต่อเดือน' : 'Monthly expenses', unit: '฿' }),
      makeNumField('afford', 'otherDebt', { label: th ? 'ภาระหนี้อื่นต่อเดือน' : 'Other debt payments', unit: '฿' }),
      makeNumField('afford', 'dsr', { label: th ? 'สัดส่วนภาระหนี้ต่อรายได้ (DSR)' : 'Debt-service ratio', unit: '%', plain: true, hint: th ? 'ธนาคารส่วนใหญ่ใช้ 30–50%' : 'Most lenders use 30–50%' }),
      makeNumField('afford', 'down', { label: th ? 'เงินดาวน์ที่มี' : 'Down payment available', unit: '฿' }),
      makeNumField('afford', 'rate', { label: th ? 'อัตราดอกเบี้ยที่คาด' : 'Expected rate', unit: '%', plain: true }),
      makeNumField('afford', 'years', { label: th ? 'ระยะเวลากู้' : 'Term', unit: th ? 'ปี' : 'years', plain: true })
    ];

    if (ok) {
      const m = affordModel();
      const sched = [{ months: Math.round(a.years * 12), annual: a.rate }];
      const loanRun = ENGINE.amortize({ principal: m.maxLoan, months: Math.round(a.years * 12), sched });
      V.resultCaption = 'DSR ' + a.dsr + '% · ' + a.rate + '% · ' + dur(Math.round(a.years * 12));
      V.bigCards = [
        { label: th ? 'ผ่อนได้สูงสุดต่อเดือน' : 'Maximum instalment', value: b(m.maxPay), sub: m.limitedBy === 'dsr' ? (th ? 'ถูกจำกัดด้วย DSR' : 'limited by DSR') : (th ? 'ถูกจำกัดด้วยเงินเหลือ' : 'limited by cash left'), color: '#f3f5fe' },
        { label: th ? 'วงเงินกู้ประมาณ' : 'Estimated loan', value: bshort(m.maxLoan), sub: a.rate + '% · ' + Math.round(a.years) + ' ' + Lx.years, color: '#f3f5fe' },
        { label: th ? 'ราคาสินทรัพย์ที่ไหว' : 'Property price', value: bshort(m.price), sub: (th ? 'รวมเงินดาวน์ ' : 'including ') + bshort(a.down), color: '#f3f5fe' },
        { label: th ? 'ดอกเบี้ยทั้งหมดที่จะจ่าย' : 'Interest over the term', value: bshort(loanRun.totalInterest), sub: th ? 'ถ้ากู้เต็มวงเงินนี้' : 'if you borrow the full amount', color: '#b5abfc' }
      ];
      V.narrative = th
        ? 'จากรายได้ ' + b(a.income) + ' ต่อเดือน หักค่าใช้จ่ายและหนี้เดิมแล้ว คุณผ่อนได้ประมาณ ' + b(m.maxPay) + ' ต่อเดือน ซึ่งที่ดอกเบี้ย ' + a.rate + '% เป็นเวลา ' + Math.round(a.years) + ' ปี คิดเป็นวงเงินกู้ราว ' + bshort(m.maxLoan) + ' และเมื่อรวมเงินดาวน์ที่มี ' + bshort(a.down) + ' จะซื้อสินทรัพย์ได้ราว ' + bshort(m.price) + ' ตัวเลขนี้เป็นการประมาณการ ไม่ใช่การอนุมัติสินเชื่อจากธนาคาร'
        : 'On ' + b(a.income) + ' a month, after expenses and existing debt, you could service about ' + b(m.maxPay) + ' a month. At ' + a.rate + '% over ' + Math.round(a.years) + ' years that is roughly ' + bshort(m.maxLoan) + ' of borrowing, and with your ' + bshort(a.down) + ' down payment, a property of about ' + bshort(m.price) + '. This is an estimate, not a credit approval.';

      V.hasTable2 = true;
      V.table2Title = th ? 'ที่มาของตัวเลข' : 'How the number is reached';
      V.table2Heads = [{ label: th ? 'รายการ' : 'Item', align: 'left' }, { label: th ? 'จำนวน' : 'Amount', align: 'right' }];
      const one = (label, v, muted) => ({ label, cells: [{ text: v, weight: muted ? 400 : 500, color: muted ? '#9397ab' : '#e9e9ed' }] });
      V.table2Rows = [
        one(th ? 'รายได้ต่อเดือน' : 'Monthly income', b(a.income), true),
        one(th ? 'เพดานตาม DSR ' + a.dsr + '% หักหนี้เดิม' : 'Ceiling at ' + a.dsr + '% DSR, less existing debt', b(Math.max(0, m.byDsr)), true),
        one(th ? 'เงินเหลือหลังค่าใช้จ่ายและหนี้เดิม' : 'Cash left after expenses and debt', b(Math.max(0, m.byCash)), true),
        one(th ? 'ผ่อนได้สูงสุด (ค่าที่น้อยกว่า)' : 'Maximum instalment (the lower of the two)', b(m.maxPay)),
        one(th ? 'วงเงินกู้ที่ค่างวดนี้รองรับ' : 'Loan that instalment supports', b(m.maxLoan)),
        one(th ? 'ราคาสินทรัพย์รวมเงินดาวน์' : 'Price including down payment', b(m.price))
      ];
      V.table2Foot = th
        ? 'การอนุมัติจริงยังพิจารณาประวัติเครดิต ความมั่นคงของรายได้ อายุผู้กู้ และมูลค่าประเมินหลักประกัน ตัวเลขนี้ใช้เพื่อวางแผนเบื้องต้นเท่านั้น'
        : 'Real approval also weighs credit history, income stability, the borrower’s age and the appraised value of the collateral. Use this for planning only.';

      if (m.maxLoan > 0) {
        V.hasCharts = true;
        const ye = [m.maxLoan].concat(loanRun.rows.filter(x => x.m % 12 === 0).map(x => x.balance));
        const cur = curveFrom(ye);
        V.curveTitle = th ? 'ถ้ากู้เต็มวงเงิน: ยอดหนี้คงเหลือ' : 'If you borrow it all: remaining balance';
        V.curveNote = th ? 'สิ้นปีที่เท่าไร เหลือหนี้เท่าไร' : 'What is left at the end of each year';
        V.curveArea = cur.d; V.curvePoints = cur.poly;
        const ly = Math.ceil(loanRun.months / 12);
        V.curveTicks = [0, 1, 2, 3, 4].map(i => (th ? 'ปี ' : 'Y') + Math.round(i * ly / 4));
        V.curveMarks = [1, 5, 10, ly].filter((y, i, arr) => arr.indexOf(y) === i && y <= ly).map(y => {
          const rr = loanRun.rows.filter(x => x.m <= y * 12).pop();
          return { label: (th ? 'สิ้นปีที่ ' : 'End of year ') + y, value: bshort(rr ? rr.balance : m.maxLoan) };
        });
        V.barsTitle = th ? 'เงินต้นกับดอกเบี้ยในแต่ละปี' : 'Principal vs interest by year';
        V.barsNote = th ? 'แถบสีม่วงคือดอกเบี้ย' : 'Purple is interest';
        V.yearBars = computeBars(loanRun.rows, 'principal', 'interest');
        V.barsFirst = (th ? 'ปีที่ 1' : 'Year 1'); V.barsLast = (th ? 'ปีที่ ' : 'Year ') + ly;
      }
    }
  }

  if (!ok) { V.bigCards = []; V.narrative = ''; V.resultCaption = ''; }
  return V;
}

/* Shared amortization table model — yearly roll-up or every period. */
function fillAmort(V, rows, csvName) {
  const th = state.lang === 'th', Lx = L();
  V.amortHeads = [
    { label: state.amortView === 'year' ? Lx.thYear : Lx.thPeriod, align: 'left' },
    { label: Lx.thWhen, align: 'left' },
    { label: Lx.thPay, align: 'right' },
    { label: Lx.thPrin, align: 'right' },
    { label: Lx.thInt, align: 'right' },
    { label: Lx.thBal, align: 'right' }
  ];
  V.onCsv = () => exportCsv(rows, csvName);
  if (state.amortView === 'month') {
    V.amortRows = rows.map(r => ({
      n: String(r.m), weight: 400,
      date: (th ? 'ปีที่ ' : 'Y') + Math.ceil(r.m / 12) + ' · ' + (th ? 'เดือน ' : 'M') + (((r.m - 1) % 12) + 1),
      pay: n(r.payment, 0), principal: n(r.principal, 0), interest: n(r.interest, 0), balance: n(r.balance, 0)
    }));
  } else {
    const per = [];
    rows.forEach(r => {
      const y = Math.ceil(r.m / 12);
      if (!per[y]) per[y] = { pay: 0, p: 0, i: 0, bal: 0, from: r.m, to: r.m };
      per[y].pay += r.payment; per[y].p += r.principal; per[y].i += r.interest;
      per[y].bal = r.balance; per[y].to = r.m;
    });
    V.amortRows = per.filter(Boolean).map((p, idx) => ({
      n: String(idx + 1), weight: 500,
      date: (th ? 'งวด ' : 'periods ') + p.from + '–' + p.to,
      pay: n(p.pay, 0), principal: n(p.p, 0), interest: n(p.i, 0), balance: n(p.bal, 0)
    }));
  }
}
/* ============================================================
   DOM BUILDERS — turn the view model into real elements.
   Mirrors the prototype's markup section by section.
   ============================================================ */
function wrapField(label, unit, control, error, hint) {
  const kids = [
    h('div', { class: 'field-head' }, h('label', { class: 'field-label' }, label), h('span', { class: 'field-unit' }, unit)),
    control
  ];
  if (error) kids.push(h('div', { class: 'field-error' }, error));
  if (hint) kids.push(h('div', { class: 'field-hint' }, hint));
  return h('div', { class: 'field' }, kids);
}
function buildField(spec) {
  let control;
  if (spec.kind === 'seg') {
    control = h('div', { class: 'seg-block' }, spec.options.map(o =>
      h('button', { class: 'seg-opt' + (o.active ? ' active' : ''), onclick: o.onClick }, o.label)));
  } else if (spec.kind === 'select') {
    control = h('select', { id: spec.id, class: 'field-select', onchange: spec.onChange },
      spec.options.map(o => h('option', { value: o.value, selected: o.value === spec.value }, o.label)));
  } else {
    const rk = spec.group + '.' + spec.key;
    control = h('input', {
      type: 'text', inputmode: 'decimal', id: fieldId(spec.group, spec.key),
      class: 'field-input' + (spec.error ? ' error' : ''), value: spec.display,
      oninput: e => {
        const txt = e.target.value;
        const num = parseFloat(txt.replace(/[^0-9.\-]/g, ''));
        state.raw[rk] = txt;
        state[spec.group][spec.key] = isNaN(num) ? 0 : num;
        scheduleRender();
      },
      onblur: () => { if (suppressBlur) return; delete state.raw[rk]; scheduleRender(); }
    });
  }
  return wrapField(spec.label, spec.unit, control, spec.error, spec.hint);
}

function buildNavbar(V) {
  return h('div', { class: 'navbar noprint' },
    h('div', { class: 'navbar-inner' },
      h('div', { class: 'brand' },
        h('div', { class: 'brand-badge' }, '฿'),
        h('div', { class: 'brand-name' }, V.t.brand)
      ),
      h('div', { class: 'spacer' }),
      h('div', { class: 'seg lang-switch' }, V.langOpts.map(o =>
        h('button', { class: 'seg-opt' + (o.active ? ' active' : ''), onclick: o.onClick }, o.label))),
      h('button', { class: 'btn-outline-accent', onclick: V.onShare }, V.shareLabel),
      h('button', { class: 'btn-outline-neutral', onclick: V.onPrint }, V.t.print)
    )
  );
}
function buildHero(V) {
  return h('div', { class: 'hero' },
    h('div', { class: 'hero-inner' },
      h('div', { class: 'kicker' }, V.t.kicker),
      h('h1', {}, V.t.heroTitle),
      h('p', {}, V.t.heroSub),
      h('div', { class: 'hero-ctas' },
        h('button', { class: 'btn-cta-primary', onclick: V.goCalc }, V.t.ctaStart),
        h('button', { class: 'btn-cta-secondary', onclick: V.goFaq }, V.t.ctaFaq)
      )
    )
  );
}
function buildCats(V) {
  return h('div', { class: 'cats-section' },
    h('div', { class: 'cats-grid' }, V.cats.map(c =>
      h('button', { class: 'cat-card' + (c.active ? ' active' : ''), onclick: c.onClick },
        h('div', { class: 'cat-tag' }, c.tag),
        h('div', { class: 'cat-label' }, c.label),
        h('div', { class: 'cat-note' }, c.note)
      )))
  );
}

function buildStepupBlock(V) {
  const kids = [
    h('label', { class: 'stepup-check-label' },
      h('input', { type: 'checkbox', id: 'stepupCheckbox', checked: V.stepup, onchange: V.toggleStepup }),
      V.t.stepupLabel
    )
  ];
  if (V.stepup) {
    kids.push(h('div', { class: 'stepup-fields' }, V.stepFields.map((s, i) =>
      h('div', { class: 'stepup-row' },
        h('div', { class: 'stepup-row-label' }, s.label),
        h('input', { type: 'text', inputmode: 'decimal', id: 'f-home-steps-' + i, class: 'stepup-row-input', value: s.display, oninput: s.onChange, onblur: s.onBlur }),
        h('div', { class: 'stepup-row-suffix' }, '%')
      ))));
  }
  return h('div', { class: 'stepup-block' }, kids);
}
function buildExtraPanel(V) {
  const kids = [
    h('div', { class: 'extra-title' }, V.t.extraTitle),
    h('div', { class: 'extra-modes' }, V.extraModes.map(o =>
      h('button', { class: 'seg-opt' + (o.active ? ' active' : ''), onclick: o.onClick }, o.label)))
  ];
  if (V.showExtraAmt) {
    kids.push(h('div', { class: 'extra-amt' },
      h('div', { class: 'extra-amt-head' },
        h('label', { class: 'extra-amt-label' }, V.extraAmtLabel),
        h('div', { class: 'extra-amt-value', id: 'extraAmtValue' }, V.extraAmtText)
      ),
      h('input', { type: 'range', id: 'extraSlider', class: 'range-full', min: '0', max: String(V.extraSliderMax), step: String(V.extraSliderStep), value: String(V.extraSliderVal), oninput: V.onExtraSlider, onchange: V.onExtraSliderCommit })
    ));
  }
  if (V.showLumpMonth) {
    kids.push(h('div', { class: 'extra-lump-row' },
      h('div', { class: 'extra-lump-label' }, V.t.lumpAt),
      h('input', { type: 'text', inputmode: 'decimal', id: 'f-extra-lumpMonth', class: 'extra-lump-input', value: V.lumpMonthVal, oninput: V.onLumpMonth, onblur: V.onLumpMonthBlur })
    ));
  }
  return h('div', { class: 'extra-panel' }, kids);
}
function buildSidebar(V) {
  const kids = [
    h('div', { class: 'panel' },
      h('div', { class: 'panel-title' }, V.panelTitle),
      h('div', { class: 'panel-note' }, V.panelNote),
      h('div', { class: 'fields' }, V.fields.map(buildField)),
      V.isHome ? buildStepupBlock(V) : null,
      V.hasExtraPanel ? buildExtraPanel(V) : null,
      h('button', { class: 'btn-reset noprint', onclick: V.onReset }, V.t.reset)
    )
  ];
  if (V.isAuto) {
    kids.push(h('div', { class: 'info-box' },
      h('div', { class: 'info-box-title' }, V.t.flatBoxTitle),
      h('div', { class: 'info-box-body' }, V.flatBoxBody)
    ));
  }
  return h('div', { class: 'sidebar sticky' }, kids);
}
function buildErrorBox(V) {
  return h('div', { class: 'error-box' },
    h('div', { class: 'error-title' }, V.t.errTitle),
    h('div', { class: 'error-list' }, V.errors.map(e => h('div', { class: 'error-item' }, e)))
  );
}
function buildBigCards(V) {
  return [
    h('div', { class: 'result-head' },
      h('div', { class: 'result-title' }, V.t.resultTitle),
      h('div', { class: 'result-caption' }, V.resultCaption)
    ),
    h('div', { class: 'big-cards' }, V.bigCards.map(k => h('div', { class: 'big-card' },
      h('div', { class: 'big-card-label' }, k.label),
      h('div', { class: 'big-card-value', style: { color: k.color } }, k.value),
      h('div', { class: 'big-card-sub' }, k.sub)
    ))),
    h('div', { class: 'narrative-box' },
      h('div', { class: 'narrative-kicker' }, V.t.meaning),
      h('div', { class: 'narrative-text' }, V.narrative),
      h('div', { class: 'narrative-disclaimer' }, V.t.disclaimer)
    )
  ];
}
function buildBreakdown(V) {
  return h('div', { class: 'card' },
    h('div', { class: 'card-title' }, V.breakdownTitle),
    h('div', { class: 'breakdown-bar' },
      h('div', { class: 'breakdown-seg', style: { width: V.pctA + '%', background: '#b2b6ca' } }, V.pctAText),
      h('div', { class: 'breakdown-seg', style: { width: V.pctB + '%', background: '#9184d9' } }, V.pctBText),
      h('div', { style: { width: V.pctC + '%', background: '#595d6c' } })
    ),
    h('div', { class: 'breakdown-legend' }, V.legend.map(l => h('div', { class: 'legend-item' },
      h('div', { class: 'legend-swatch', style: { background: l.color } }),
      h('div', { class: 'legend-label' }, l.label),
      h('div', { class: 'legend-value' }, l.value)
    )))
  );
}
function buildCurveSvg(V) {
  const svg = svgEl('svg', { viewBox: '0 0 620 180', preserveAspectRatio: 'none', class: 'chart-svg' });
  svg.appendChild(svgEl('path', { d: V.curveArea, fill: 'rgba(145,132,217,0.14)' }));
  svg.appendChild(svgEl('polyline', { points: V.curvePoints, fill: 'none', stroke: '#9184d9', 'stroke-width': '2', 'stroke-linejoin': 'round' }));
  svg.appendChild(svgEl('line', { x1: '0', y1: '164', x2: '620', y2: '164', stroke: '#3f424d', 'stroke-width': '1' }));
  return svg;
}
function buildCharts(V) {
  return h('div', { class: 'charts-grid' },
    h('div', { class: 'card' },
      h('div', { class: 'chart-card-title' }, V.curveTitle),
      h('div', { class: 'chart-card-note' }, V.curveNote),
      buildCurveSvg(V),
      h('div', { class: 'chart-ticks' }, V.curveTicks.map(x => h('div', { class: 'chart-tick' }, x))),
      h('div', { class: 'chart-marks' }, V.curveMarks.map(m => h('div', { class: 'chart-mark-row' },
        h('div', { class: 'chart-mark-label' }, m.label),
        h('div', { class: 'chart-mark-value' }, m.value)
      )))
    ),
    h('div', { class: 'card' },
      h('div', { class: 'chart-card-title' }, V.barsTitle),
      h('div', { class: 'chart-card-note' }, V.barsNote),
      h('div', { class: 'bars' }, V.yearBars.map(bar => h('div', { class: 'bar-col', title: bar.title },
        h('div', { class: 'bar-b', style: { height: bar.bH + '%' } }),
        h('div', { class: 'bar-a', style: { height: bar.aH + '%' } })
      ))),
      h('div', { class: 'bars-labels' }, h('div', {}, V.barsFirst), h('div', {}, V.barsLast))
    )
  );
}
function buildExtraCompare(V) {
  return h('div', { class: 'card' },
    h('div', { class: 'chart-card-title' }, V.t.extraCompareTitle),
    h('div', { class: 'chart-card-note note-mb18' }, V.t.extraCompareNote),
    h('div', { class: 'extra-compare-rows' }, V.extraRows.map(r => h('div', { class: 'extra-compare-row' },
      h('div', { class: 'extra-compare-head' },
        h('div', { class: 'extra-compare-label' }, r.label),
        h('div', { class: 'extra-compare-detail' }, r.detail)
      ),
      h('div', { class: 'extra-compare-bar' },
        h('div', { style: { width: r.pW + '%', background: '#b2b6ca' } }),
        h('div', { style: { width: r.iW + '%', background: '#9184d9' } })
      )
    )))
  );
}
function buildWhatIf(V) {
  return h('div', { class: 'card' },
    h('div', { class: 'chart-card-title' }, V.t.whatIfTitle),
    h('div', { class: 'chart-card-note', id: 'whatIfNote' }, V.whatIfNote),
    h('input', { type: 'range', id: 'downSlider', class: 'range-full', min: '0', max: '60', step: '1', value: String(V.downPctVal), oninput: V.onDownSlider, onchange: V.onDownSliderCommit }),
    h('div', { class: 'whatif-rows' }, V.whatIfRows.map(w => h('div', { class: 'whatif-card' },
      h('div', { class: 'whatif-label' }, w.label),
      h('div', { class: 'whatif-value' }, w.value),
      h('div', { class: 'whatif-delta', style: { color: w.color } }, w.delta)
    )))
  );
}
function buildTable2(V) {
  const kids = [h('div', { class: 'chart-card-title' }, V.table2Title)];
  if (V.table2Verdict) kids.push(h('div', { class: 'table2-verdict', style: { color: V.table2VerdictColor } }, V.table2Verdict));
  const thead = h('thead', {}, h('tr', {}, V.table2Heads.map(hd => h('th', { style: { textAlign: hd.align } }, hd.label))));
  const tbody = h('tbody', {}, V.table2Rows.map(r => h('tr', {},
    [h('td', {}, r.label)].concat(r.cells.map(c => h('td', { class: 'cell-num', style: { fontWeight: c.weight, color: c.color } }, c.text)))
  )));
  kids.push(h('div', { class: 'table-wrap table2-wrap' }, h('table', {}, thead, tbody)));
  if (V.table2Foot) kids.push(h('div', { class: 'table2-foot' }, V.table2Foot));
  return h('div', { class: 'card' }, kids);
}
function buildAmort(V) {
  const thead = h('thead', {}, h('tr', {}, V.amortHeads.map(hd => h('th', { style: { textAlign: hd.align } }, hd.label))));
  const tbody = h('tbody', {}, V.amortRows.map(r => h('tr', {},
    h('td', { style: { fontWeight: r.weight, color: '#cfd3e5' } }, r.n),
    h('td', { style: { color: '#9397ab', fontSize: '12.5px' } }, r.date),
    h('td', { class: 'cell-num', style: { color: '#e9e9ed' } }, r.pay),
    h('td', { class: 'cell-num', style: { color: '#b2b6ca' } }, r.principal),
    h('td', { class: 'cell-num', style: { color: '#b5abfc' } }, r.interest),
    h('td', { class: 'cell-num', style: { color: '#e9e9ed', fontWeight: '500' } }, r.balance)
  )));
  return h('div', { class: 'card' },
    h('div', { class: 'amort-head' },
      h('div', {},
        h('div', { class: 'chart-card-title' }, V.amortTitle),
        h('div', { class: 'chart-card-note note-mb0' }, V.amortNote)
      ),
      h('div', { class: 'amort-actions noprint' },
        h('button', { class: 'btn-small', onclick: V.onToggleAmortView }, V.amortViewLabel),
        h('button', { class: 'btn-small', onclick: V.onCsv }, 'CSV')
      )
    ),
    h('div', { class: 'amort-scroll' }, h('table', {}, thead, tbody))
  );
}
function buildResultsColumn(V) {
  const outer = [];
  if (V.hasErrors) outer.push(buildErrorBox(V));
  if (V.ok) {
    const inner = buildBigCards(V);
    if (V.hasBreakdown) inner.push(buildBreakdown(V));
    if (V.hasCharts) inner.push(buildCharts(V));
    if (V.hasExtraCompare) inner.push(buildExtraCompare(V));
    if (V.hasWhatIf) inner.push(buildWhatIf(V));
    if (V.hasTable2) inner.push(buildTable2(V));
    if (V.hasAmort) inner.push(buildAmort(V));
    outer.push(h('div', { class: 'results' }, inner));
  }
  return h('div', { class: 'results' }, outer);
}
function buildCalcSection(V) {
  return h('div', { id: 'calc' },
    h('div', { class: 'split' }, buildSidebar(V), buildResultsColumn(V))
  );
}
function buildTestsSection(V) {
  const kids = [
    h('div', { class: 'tests-head' },
      h('div', {},
        h('div', { class: 'tests-title' }, V.t.testsTitle),
        h('div', { class: 'tests-summary' }, V.testSummary)
      ),
      h('button', { class: 'btn-small noprint', onclick: V.onToggleTests }, V.testToggleLabel)
    )
  ];
  if (V.showTests) {
    kids.push(h('div', { class: 'test-rows' }, V.testRows.map(x => h('div', { class: 'test-row' },
      h('div', { class: 'test-mark', style: { color: x.color } }, x.mark),
      h('div', { class: 'test-name' }, x.name),
      h('div', { class: 'test-detail' }, x.detail)
    ))));
  }
  return h('div', { class: 'tests-section' }, h('div', { class: 'tests-panel' }, kids));
}
function buildFaqSection(V) {
  return h('div', { id: 'faq', class: 'faq-section' },
    h('div', { class: 'faq-title' }, V.t.faqTitle),
    h('div', { class: 'faq-sub' }, V.t.faqSub),
    h('div', { class: 'faq-grid' }, V.faqs.map(q => h('div', { class: 'faq-card' },
      h('div', { class: 'faq-q' }, q.q),
      h('div', { class: 'faq-a' }, q.a)
    )))
  );
}
function buildGlossarySection(V) {
  return h('div', { class: 'glossary-section' },
    h('div', { class: 'glossary-title' }, V.t.glossaryTitle),
    h('div', { class: 'glossary-grid' }, V.glossary.map(g => h('div', { class: 'glossary-item' },
      h('div', { class: 'glossary-term' }, g.term),
      h('div', { class: 'glossary-def' }, g.def)
    )))
  );
}
function buildFooterSection(V) {
  return h('div', { class: 'footer-section' },
    h('div', { class: 'footer-inner' },
      h('div', { class: 'footer-text' }, V.t.footer),
      h('div', { class: 'footer-brand' }, V.t.brand + ' · THB')
    ),
    h('div', { class: 'footer-credit' }, V.t.credit)
  );
}
function buildApp(V) {
  return h('div', { class: 'page' },
    buildNavbar(V),
    buildHero(V),
    buildCats(V),
    buildCalcSection(V),
    V.showTestPanel ? buildTestsSection(V) : null,
    buildFaqSection(V),
    buildGlossarySection(V),
    buildFooterSection(V)
  );
}
/* ============================================================
   UTILITIES: CSV export, share-by-URL, smooth scroll
   ============================================================ */
function exportCsv(rows, name) {
  const head = ['period', 'payment', 'principal', 'interest', 'balance'];
  const body = rows.map(r => [r.m, r.payment.toFixed(2), r.principal.toFixed(2), r.interest.toFixed(2), r.balance.toFixed(2)].join(','));
  const blob = new Blob(['﻿' + head.join(',') + '\n' + body.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name + '.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function doShare() {
  const s = state;
  const payload = { tab: s.tab, lang: s.lang, home: s.home, auto: s.auto, comp: s.comp, refi: s.refi, afford: s.afford, extra: s.extra };
  try {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    history.replaceState(null, '', '#s=' + encodeURIComponent(enc));
    if (navigator.clipboard) navigator.clipboard.writeText(location.href).catch(() => {});
    state.shared = true;
    scheduleRender();
    setTimeout(() => { state.shared = false; scheduleRender(); }, 2200);
  } catch (e) { /* clipboard blocked — the URL is still updated */ }
}
function scrollToEl(id) {
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 64, behavior: 'smooth' });
}

/* ============================================================
   LIVE SLIDER PATCHES
   Range inputs fire 'input' continuously while being dragged.
   Running a full render() on every tick would replace the
   slider's own DOM node mid-drag and cancel the browser's
   native pointer capture (the thumb would stop following the
   mouse). So dragging only patches the one label that needs to
   move live, via buildViewModel() (cheap — no DOM rebuild); a
   full render() only runs on 'change', once the drag ends.
   ============================================================ */
function livePatchExtra() {
  const el = document.getElementById('extraAmtValue');
  if (el) el.textContent = buildViewModel().extraAmtText;
}
function livePatchWhatIf() {
  const el = document.getElementById('whatIfNote');
  if (el) el.textContent = buildViewModel().whatIfNote;
}

/* ============================================================
   RENDER LOOP
   A full rebuild runs on every other state change. A focused
   text input would normally lose focus and cursor position on
   rebuild; fixed by moving its live DOM node into the new tree
   (instead of discarding it) and re-focusing it afterward.
   Moving a focused node briefly detaches it, which fires a
   native 'blur' — suppressBlur tells field blur handlers to
   ignore that one, since it isn't a real, user-caused blur.
   ============================================================ */
const ROOT = document.getElementById('app');
let renderScheduled = false;
let suppressBlur = false;
function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => { renderScheduled = false; render(); });
}
function render() {
  const active = document.activeElement;
  const preserveId = (active && active.id && ROOT.contains(active)) ? active.id : null;
  const selStart = (preserveId && typeof active.selectionStart === 'number') ? active.selectionStart : null;
  const selEnd = (preserveId && typeof active.selectionEnd === 'number') ? active.selectionEnd : null;
  const scrollBox = document.querySelector('.amort-scroll');
  const scrollTop = scrollBox ? scrollBox.scrollTop : null;

  const newTree = buildApp(buildViewModel());

  let preserved = null;
  if (preserveId) {
    const oldNode = document.getElementById(preserveId);
    const newNode = newTree.querySelector('#' + CSS.escape(preserveId));
    if (oldNode && newNode && oldNode.tagName === newNode.tagName) {
      suppressBlur = true;
      newNode.parentNode.replaceChild(oldNode, newNode);
      preserved = oldNode;
    }
  }

  ROOT.replaceChildren(newTree);

  if (preserved) {
    preserved.focus({ preventScroll: true });
    if (selStart !== null && preserved.setSelectionRange) {
      try { preserved.setSelectionRange(selStart, selEnd); } catch (e) { /* not a text-selectable input */ }
    }
    suppressBlur = false;
  }

  if (scrollTop !== null) {
    const newScrollBox = document.querySelector('.amort-scroll');
    if (newScrollBox) newScrollBox.scrollTop = scrollTop;
  }
}

/* ============================================================
   BOOT — restore a shared state from the URL hash, then render.
   ============================================================ */
(function boot() {
  try {
    const hv = location.hash.replace(/^#s=/, '');
    if (hv && location.hash.indexOf('#s=') === 0) {
      const o = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(hv)))));
      if (o && o.tab) Object.assign(state, o);
    }
  } catch (e) { /* a malformed link just falls back to defaults */ }
  render();
})();






/* =========================================================================
   CALCULATION ENGINE — pure functions. No DOM, no formatting, no state.
   Ported unchanged from the Claude Design prototype so the numbers behind
   every tab stay verifiably identical to what was designed and tested.
   ========================================================================= */
const ENGINE = {
  /* Reducing-balance payment. r = periodic rate. Handles r = 0. */
  pmt(P, r, n) {
    if (n <= 0) return 0;
    if (!r) return P / n;
    const g = Math.pow(1 + r, n);
    return P * r * g / (g - 1);
  },
  /* Inverse of pmt: largest principal a given payment can service. */
  maxPrincipal(pay, r, n) {
    if (n <= 0) return 0;
    if (!r) return pay * n;
    const g = Math.pow(1 + r, n);
    return pay * (g - 1) / (r * g);
  },
  /* sched = [{months, annual}] in order; last entry extends to the end. */
  rateAt(sched, m) {
    let acc = 0;
    for (const s of sched) { acc += s.months; if (m <= acc) return s.annual; }
    return sched[sched.length - 1].annual;
  },
  /* Reducing-balance amortisation.
     Full float precision internally; the final period is trued up so the
     balance lands on exactly 0 and principal sums to the original loan. */
  amortize(o) {
    const months = Math.max(1, Math.round(o.months));
    const extraMonthly = o.extraMonthly || 0;
    const extraAnnual = o.extraAnnual || 0;
    const lump = o.lump || 0, lumpMonth = o.lumpMonth || 0;
    let bal = o.principal, totI = 0, totP = 0, pay = 0, curR = null;
    const rows = [];
    for (let m = 1; m <= months && bal > 0.005; m++) {
      const r = this.rateAt(o.sched, m) / 100 / 12;
      if (curR === null || Math.abs(r - curR) > 1e-15) {
        curR = r; pay = this.pmt(bal, r, months - m + 1);
      }
      const interest = bal * r;
      let princ = pay - interest + extraMonthly;
      if (extraAnnual && m % 12 === 0) princ += extraAnnual;
      if (lump && m === lumpMonth) princ += lump;
      if (princ > bal) princ = bal;
      bal -= princ; totI += interest; totP += princ;
      rows.push({ m, interest, principal: princ, payment: princ + interest, balance: bal < 0.005 ? 0 : bal });
    }
    return {
      rows, months: rows.length, scheduledMonths: months,
      totalInterest: totI, totalPrincipal: totP, totalPayment: totI + totP,
      basePayment: this.pmt(o.principal, this.rateAt(o.sched, 1) / 100 / 12, months)
    };
  },
  /* FLAT / ADD-ON RATE — a different product, deliberately a different
     function: interest is charged on the ORIGINAL principal for the whole
     term and never falls as the balance falls. */
  flat(P, flatPct, months, balloon) {
    const b = balloon || 0;
    const totI = P * (flatPct / 100) * (months / 12);
    const pay = (P + totI - b) / months;
    const perI = totI / months;
    const rows = [];
    let bal = P;
    for (let m = 1; m <= months; m++) {
      let princ = m === months ? bal : pay - perI;
      bal -= princ;
      rows.push({ m, interest: perI, principal: princ, payment: m === months ? princ + perI + b : pay, balance: bal < 0.005 ? 0 : bal });
    }
    const eff = this.solveRate(P, pay, months, b);
    return { rows, months, payment: pay, totalPrincipal: P, totalInterest: totI, totalPayment: P + totI, effAnnual: eff * 12 * 100 };
  },
  /* Bisection for the periodic rate that discounts the payment stream to P. */
  solveRate(P, pay, n, balloon) {
    const b = balloon || 0;
    const pv = r => { if (!r) return pay * n + b; const g = Math.pow(1 + r, n); return pay * (g - 1) / (r * g) + b / g; };
    let lo = 0, hi = 1;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (pv(mid) > P) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  },
  simple(P, annualPct, years) {
    const i = P * (annualPct / 100) * years;
    return { principal: P, interest: i, total: P + i };
  },
  /* Effective monthly growth factor of a nominal annual rate compounded
     perYear times a year. */
  monthlyGrowth(annualPct, perYear) {
    return Math.pow(1 + (annualPct / 100) / perYear, perYear / 12);
  },
  compound(o) {
    const g = this.monthlyGrowth(o.annualPct, o.perYear);
    const n = Math.max(1, Math.round(o.years * 12));
    let bal = o.pv, contrib = o.pv;
    const series = [{ month: 0, year: 0, balance: bal, contrib, gain: 0 }];
    for (let m = 1; m <= n; m++) {
      bal = bal * g + o.monthly; contrib += o.monthly;
      if (m % 12 === 0 || m === n) series.push({ month: m, year: Math.round(m / 12 * 10) / 10, balance: bal, contrib, gain: bal - contrib });
    }
    return { series, months: n, final: bal, contrib, gain: bal - contrib };
  },
  requiredSaving(target, pv, annualPct, years, perYear) {
    const i = this.monthlyGrowth(annualPct, perYear) - 1;
    const n = Math.max(1, Math.round(years * 12));
    const need = target - pv * Math.pow(1 + i, n);
    if (need <= 0) return 0;
    return i ? need * i / (Math.pow(1 + i, n) - 1) : need / n;
  },
  refinance(o) {
    const oldL = this.amortize({ principal: o.balance, months: o.monthsLeft, sched: [{ months: o.monthsLeft, annual: o.oldRate }] });
    const newPrincipal = o.balance + (o.rollFees ? o.fees : 0);
    const newL = this.amortize({ principal: newPrincipal, months: o.newMonths, sched: [{ months: o.newMonths, annual: o.newRate }], extraMonthly: o.extraMonthly || 0 });
    const cash = o.rollFees ? 0 : o.fees;
    const monthlySave = oldL.basePayment - newL.basePayment;
    return {
      oldL, newL, newPrincipal,
      oldTotal: oldL.totalPayment, newTotal: newL.totalPayment + cash,
      netSaving: oldL.totalPayment - (newL.totalPayment + cash),
      monthlySave,
      breakeven: monthlySave > 0 ? o.fees / monthlySave : Infinity
    };
  },
  affordability(o) {
    const byDsr = o.income * (o.dsr / 100) - o.otherDebt;
    const byCash = o.income - o.expense - o.otherDebt;
    const maxPay = Math.max(0, Math.min(byDsr, byCash));
    const maxLoan = this.maxPrincipal(maxPay, o.rate / 100 / 12, Math.round(o.years * 12));
    return { maxPay, maxLoan, price: maxLoan + o.down, byDsr, byCash, limitedBy: byDsr <= byCash ? 'dsr' : 'cash' };
  }
};

/* ===== ENGINE SELF-TESTS (verifiable, run in the browser) ===== */
function runTests() {
  const E = ENGINE, out = [];
  const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.5 : tol);
  const add = (th, en, pass, detail) => out.push({ th, en, pass, detail });

  add('ดอกเบี้ย 0% → ค่างวด = เงินต้น ÷ จำนวนงวด', '0% interest → payment = principal / periods', near(E.pmt(120000, 0, 12), 10000), '10,000.00');
  const p1 = E.pmt(100000, 0.06 / 12, 12);
  add('เงินต้น 100,000 · 6%/ปี · 12 งวด', 'P 100,000 · 6%/yr · 12 periods', near(p1, 8606.64, 0.02), p1.toFixed(2));
  const a1 = E.amortize({ principal: 2400000, months: 360, sched: [{ months: 360, annual: 4.5 }] });
  add('ผลรวมเงินต้นในตาราง = เงินกู้ตั้งต้น', 'schedule principal sums to the loan', near(a1.totalPrincipal, 2400000, 0.02), a1.totalPrincipal.toFixed(2));
  add('เงินต้น + ดอกเบี้ย = ยอดจ่ายทั้งหมด', 'principal + interest = total paid', near(a1.totalPrincipal + a1.totalInterest, a1.totalPayment, 0.01), a1.totalPayment.toFixed(0));
  add('งวดสุดท้ายเหลือเงินต้น 0 พอดี', 'final balance is exactly 0', a1.rows[a1.rows.length - 1].balance === 0, '0.00');
  const shortL = E.amortize({ principal: 50000, months: 6, sched: [{ months: 6, annual: 1 }] });
  add('สินเชื่อระยะสั้น 6 งวด · 1%', 'short 6-period loan · 1%', near(E.pmt(50000, 0.01 / 12, 6) * 6 - 50000, shortL.totalInterest, 0.5), shortL.totalInterest.toFixed(2));
  const bigL = E.amortize({ principal: 50000000, months: 360, sched: [{ months: 360, annual: 5 }] });
  add('เงินต้นก้อนใหญ่ 50 ล้าน · 30 ปี', 'large principal 50M · 30 years', near(bigL.totalPrincipal, 50000000, 0.05), bigL.months + ' periods');
  const f1 = E.flat(800000, 3, 60);
  add('Flat 3% · 800,000 · 5 ปี → ดอกเบี้ย 120,000', 'flat 3% · 800,000 · 5y → interest 120,000', near(f1.totalInterest, 120000, 0.01), f1.totalInterest.toFixed(0));
  add('Flat 3% มีต้นทุนจริงสูงกว่าลดต้นลดดอก 3%', 'flat 3% costs more than 3% reducing', f1.effAnnual > 5 && f1.effAnnual < 6, f1.effAnnual.toFixed(2) + '%');
  const a2 = E.amortize({ principal: 2400000, months: 360, sched: [{ months: 360, annual: 4.5 }], extraMonthly: 5000 });
  add('โปะเพิ่ม → หมดหนี้เร็วขึ้นและดอกเบี้ยลด', 'extra payment shortens term and cuts interest', a2.months < a1.months && a2.totalInterest < a1.totalInterest, '-' + (a1.months - a2.months) + ' periods');
  const stp = E.amortize({ principal: 2000000, months: 360, sched: [{ months: 12, annual: 2.5 }, { months: 12, annual: 3 }, { months: 12, annual: 3.5 }, { months: 324, annual: 4.5 }] });
  add('ดอกเบี้ยขั้นบันไดคิดแยกช่วงจริง', 'step-up rate applied per period', stp.rows[0].interest < stp.rows[40].interest, 'p1 < p41');
  const c1 = ENGINE.compound({ pv: 100000, monthly: 0, annualPct: 10, years: 10, perYear: 1 });
  add('ทบต้นปีละครั้ง 10% · 10 ปี → 259,374', 'annual compounding 10% · 10y → 259,374', near(c1.final, 259374.25, 1), c1.final.toFixed(0));
  const s1 = E.simple(100000, 5, 3);
  add('ดอกเบี้ยคงที่ 100,000 · 5% · 3 ปี → 15,000', 'simple interest → 15,000', near(s1.interest, 15000, 0.01), s1.interest.toFixed(0));
  const af = E.affordability({ income: 60000, expense: 20000, otherDebt: 5000, dsr: 40, down: 600000, rate: 4.5, years: 30 });
  add('กู้ได้เท่าไร ↔ ค่างวดสอดคล้องกับสูตร', 'affordability round-trips through pmt', near(E.pmt(af.maxLoan, 0.045 / 12, 360), af.maxPay, 1), af.maxPay.toFixed(0));
  const rf = E.refinance({ balance: 1800000, oldRate: 6, monthsLeft: 240, newRate: 3.5, newMonths: 240, fees: 30000, rollFees: false });
  add('Refinance ดอกเบี้ยต่ำลง → ประหยัดสุทธิเป็นบวก', 'lower refi rate → positive net saving', rf.netSaving > 0 && rf.breakeven > 0, rf.breakeven.toFixed(1) + ' mo');
  return out;
}

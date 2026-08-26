/* Static content: i18n strings, per-tab defaults, FAQ and glossary copy. */
const FREQ = [[365, 'รายวัน', 'Daily'], [12, 'รายเดือน', 'Monthly'], [4, 'รายไตรมาส', 'Quarterly'], [1, 'รายปี', 'Annually']];

const DICT = {
  th: {
    brand: 'เครื่องคำนวณสินเชื่อและดอกเบี้ย', print: 'พิมพ์', share: 'แชร์ลิงก์', shared: 'คัดลอกแล้ว',
    kicker: 'คำนวณในเบราว์เซอร์คุณ · ไม่ส่งข้อมูลออก',
    heroTitle: 'คำนวณดอกเบี้ยและค่างวดทั้งหมดในไม่กี่วินาที',
    heroSub: 'รู้ทันทีว่าคุณต้องจ่ายเดือนละเท่าไร ดอกเบี้ยทั้งหมดเท่าไร และสุดท้ายคุณจะจ่ายเงินจริงทั้งหมดเท่าไร',
    ctaStart: 'เริ่มคำนวณ', ctaFaq: 'ดอกเบี้ยคิดอย่างไร',
    resultTitle: 'ผลการคำนวณของคุณ', meaning: 'ตัวเลขนี้หมายความว่าอย่างไร',
    disclaimer: 'หมายเหตุ: ผลลัพธ์เป็นการประมาณการจากข้อมูลที่กรอก อัตราดอกเบี้ยจริง ค่าธรรมเนียม และวิธีคิดของสถาบันการเงินอาจแตกต่างกัน ไม่ใช่การอนุมัติสินเชื่อและไม่ใช่คำแนะนำการลงทุน',
    reset: 'คืนค่าเริ่มต้น', errTitle: 'ยังคำนวณไม่ได้',
    stepupLabel: 'ดอกเบี้ยขั้นบันได / โปรโมชั่นช่วงแรก',
    extraTitle: 'จ่ายเพิ่ม / โปะ', lumpAt: 'โปะในงวดที่',
    extraCompareTitle: 'ถ้าโปะเพิ่มทุกเดือน จะเกิดอะไรขึ้น',
    extraCompareNote: 'เทียบกับแผนเดิมที่จ่ายตามค่างวดเท่านั้น — แถบยาวคือเงินที่จ่ายทั้งหมด',
    whatIfTitle: 'ทดลองสถานการณ์: เงินดาวน์',
    flatBoxTitle: 'Flat Rate ต่างจากลดต้นลดดอกอย่างไร',
    testsTitle: 'ตรวจสอบสูตรคำนวณ', testsShow: 'ดูรายการทดสอบ', testsHide: 'ซ่อน',
    faqTitle: 'คำถามที่พบบ่อย', faqSub: 'เรื่องที่คนเข้าใจผิดบ่อยที่สุดเกี่ยวกับดอกเบี้ย',
    glossaryTitle: 'คำศัพท์ที่ใช้ในหน้านี้',
    footer: 'การคำนวณทั้งหมดเกิดขึ้นในเบราว์เซอร์ของคุณ ไม่มีการส่งข้อมูลทางการเงินไปยังเซิร์ฟเวอร์ และไม่มีการจัดเก็บข้อมูลส่วนบุคคล ลิงก์แชร์เก็บค่าที่กรอกไว้ในตัว URL เท่านั้น ผลลัพธ์เป็นการประมาณการเพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุนหรือการอนุมัติสินเชื่อ',
    credit: 'ทำโดย YoungBoyInvestor · ห้ามลอกเลียนแบบเด็ดขาด',
    perMonth: 'ต่อเดือน', months: 'งวด', years: 'ปี', month: 'เดือน',
    byYear: 'ดูรายปี', byMonth: 'ดูทุกงวด',
    thPeriod: 'งวด', thYear: 'ปีที่', thWhen: 'ช่วงเวลา', thPay: 'ยอดชำระ', thPrin: 'เงินต้น', thInt: 'ดอกเบี้ย', thBal: 'คงเหลือ'
  },
  en: {
    brand: 'Loan & Interest Calculator', print: 'Print', share: 'Share link', shared: 'Copied',
    kicker: 'Runs in your browser · nothing leaves the page',
    heroTitle: 'Every payment and every baht of interest, in seconds',
    heroSub: 'See what you pay each month, how much of it is interest, and what the loan really costs you by the end.',
    ctaStart: 'Start calculating', ctaFaq: 'How interest works',
    resultTitle: 'Your result', meaning: 'What these numbers mean',
    disclaimer: 'Note: results are estimates based on the values you entered. Real rates, fees and each lender’s method may differ. This is not a credit approval and not investment advice.',
    reset: 'Reset to defaults', errTitle: 'Cannot calculate yet',
    stepupLabel: 'Step-up rate / introductory promotion',
    extraTitle: 'Extra payment', lumpAt: 'Lump sum at period',
    extraCompareTitle: 'What paying extra every month does',
    extraCompareNote: 'Against the plan where you pay only the scheduled instalment — bar length is total paid',
    whatIfTitle: 'What if: down payment',
    flatBoxTitle: 'Flat rate vs reducing balance',
    testsTitle: 'Engine self-checks', testsShow: 'Show checks', testsHide: 'Hide',
    faqTitle: 'Frequently asked', faqSub: 'The things people most often get wrong about interest',
    glossaryTitle: 'Terms used on this page',
    footer: 'Every calculation runs in your browser. No financial data is sent to a server and nothing personal is stored. A share link carries your inputs inside the URL itself. Results are estimates for education, not investment advice or a credit approval.',
    credit: 'Made by YoungBoyInvestor · Do not copy or clone',
    perMonth: 'per month', months: 'periods', years: 'years', month: 'months',
    byYear: 'By year', byMonth: 'Every period',
    thPeriod: 'Period', thYear: 'Year', thWhen: 'When', thPay: 'Payment', thPrin: 'Principal', thInt: 'Interest', thBal: 'Balance'
  }
};

const DEFAULTS = {
  home: { price: 3000000, downPct: 20, rate: 4.5, years: 30, fees: 30000, insurance: 0, stepup: false, steps: [2.5, 3, 3.5, 4.5] },
  auto: { price: 1000000, downPct: 20, rate: 3, years: 5, fees: 5000, balloon: 0 },
  comp: { pv: 100000, monthly: 5000, rate: 7, years: 20, perYear: 12, goal: 0 },
  refi: { balance: 1800000, oldRate: 6, monthsLeft: 240, newRate: 3.5, newYears: 20, fees: 30000, rollFees: 0 },
  afford: { income: 60000, expense: 20000, otherDebt: 5000, dsr: 40, down: 600000, rate: 4.5, years: 30 },
  extra: { mode: 'none', amount: 5000, lumpMonth: 12 }
};

function getFaqs(th) {
  const F = [
    ['ค่างวดบ้านคำนวณอย่างไร', 'How is a mortgage payment calculated?',
      'สินเชื่อบ้านเป็นแบบลดต้นลดดอก ค่างวดคงที่มาจากสูตร M = P × r(1+r)ⁿ / ((1+r)ⁿ − 1) โดย r คือดอกเบี้ยต่อปีหารด้วย 12 และ n คือจำนวนงวด ดอกเบี้ยแต่ละงวดคิดจากยอดหนี้ที่เหลือจริงในงวดนั้น',
      'A mortgage uses a reducing balance. The fixed instalment comes from M = P × r(1+r)ⁿ / ((1+r)ⁿ − 1), where r is the annual rate divided by 12 and n is the number of periods. Each period’s interest is charged on the balance still outstanding.'],
    ['ทำไมช่วงแรกจ่ายดอกเบี้ยเยอะ เงินต้นลดช้า', 'Why is early interest so high?',
      'เพราะดอกเบี้ยคิดจากยอดหนี้คงเหลือ ตอนเริ่มสัญญายอดหนี้ยังเต็มจำนวน ดอกเบี้ยจึงกินค่างวดไปเกือบหมด เมื่อเงินต้นลดลง ดอกเบี้ยในแต่ละงวดก็ลดลงและส่วนที่ไปตัดเงินต้นก็โตขึ้นเรื่อยๆ',
      'Interest is charged on the outstanding balance. At the start the balance is at its highest, so interest eats most of the instalment. As principal falls, each period’s interest shrinks and the share going to principal grows.'],
    ['Flat Rate กับลดต้นลดดอกต่างกันอย่างไร', 'Flat rate vs reducing balance?',
      'Flat Rate คิดดอกเบี้ยจากเงินต้นเต็มจำนวนทุกงวดตลอดสัญญา ไม่ว่าจะผ่อนไปแล้วเท่าไร ส่วนลดต้นลดดอกคิดจากยอดคงเหลือจริง ดังนั้นดอกเบี้ย Flat 3% มีต้นทุนจริงใกล้เคียงดอกเบี้ยลดต้นลดดอกราว 5–6%',
      'A flat rate charges interest on the original principal for the whole term, no matter how much you have repaid. A reducing balance charges only on what is left. A 3% flat rate therefore costs roughly the same as 5–6% on a reducing balance.'],
    ['โปะช่วยลดดอกเบี้ยได้จริงหรือไม่', 'Does paying extra really help?',
      'ได้จริงกับสินเชื่อลดต้นลดดอก เพราะเงินที่โปะเข้าไปตัดเงินต้นทันที ดอกเบี้ยงวดถัดไปจึงคิดจากยอดที่น้อยลง ผลคือหมดหนี้เร็วขึ้นและดอกเบี้ยรวมลดลง แต่กับสินเชื่อ Flat Rate ต้องสอบถามเงื่อนไขส่วนลดดอกเบี้ยกรณีปิดก่อนกำหนดจากผู้ให้กู้',
      'Yes, on a reducing-balance loan: the extra goes straight against principal, so the next period’s interest is charged on less. The term shortens and total interest falls. On a flat-rate loan, ask the lender what rebate applies if you settle early.'],
    ['ผ่อน 30 ปีกับ 20 ปี แบบไหนดีกว่า', '30-year or 20-year term?',
      'ยิ่งยาวค่างวดยิ่งต่ำแต่ดอกเบี้ยรวมยิ่งสูง เพราะจ่ายดอกเบี้ยนานกว่า วิธีที่หลายคนใช้คือกู้ยาวเพื่อให้ผ่านเกณฑ์ค่างวด แล้วโปะเพิ่มเมื่อมีเงินเหลือ ให้เปลี่ยนค่าในช่องระยะเวลาแล้วดูตัวเลขดอกเบี้ยรวมเปรียบเทียบเอง',
      'A longer term means a lower instalment but more total interest, because you pay interest for longer. A common approach is to borrow long to pass the affordability test, then pay extra when you can. Change the term field and compare total interest yourself.'],
    ['Refinance คุ้มหรือไม่', 'Is refinancing worth it?',
      'ดูสองตัวเลข คือดอกเบี้ยที่ประหยัดได้ตลอดสัญญาใหม่ กับค่าธรรมเนียมทั้งหมดในการย้าย ถ้าประหยัดสุทธิเป็นบวกและระยะเวลาคืนทุนสั้นกว่าเวลาที่คุณจะถือสินเชื่อนี้ต่อ ก็คุ้ม อย่าลืมค่าจดจำนอง ค่าประเมิน และค่าปรับกรณีปิดก่อนกำหนด',
      'Compare two numbers: the interest you save over the new contract, and every fee to move. If the net saving is positive and the payback period is shorter than how long you will keep the loan, it is worth it. Include mortgage registration, valuation and any prepayment penalty.'],
    ['ดอกเบี้ยทบต้นทำงานอย่างไร', 'How does compounding work?',
      'ดอกเบี้ยที่ได้จะถูกรวมเข้าไปเป็นเงินต้นในรอบถัดไป ทำให้รอบต่อไปได้ดอกเบี้ยจากยอดที่โตขึ้น ยิ่งทบถี่และยิ่งระยะเวลานาน ผลต่างยิ่งชัด เงิน 100,000 บาทที่ผลตอบแทน 10% ทบต้นปีละครั้ง จะเป็น 259,374 บาทใน 10 ปี',
      'Each period’s interest joins the principal, so the next period earns on a larger base. The more frequent the compounding and the longer the horizon, the bigger the gap. 100,000 at 10% compounded annually becomes 259,374 in 10 years.'],
    ['ธนาคารจะให้กู้ได้เท่าไร', 'How much will a bank lend?',
      'โดยทั่วไปธนาคารดูสัดส่วนภาระหนี้ต่อรายได้ (DSR) ราว 30–50% ของรายได้ต่อเดือน หักหนี้ที่มีอยู่แล้วออก เครื่องคำนวณนี้ใช้เกณฑ์นั้นประมาณวงเงิน แต่การอนุมัติจริงยังดูประวัติเครดิต ความมั่นคงของรายได้ และมูลค่าหลักประกันด้วย',
      'Banks typically allow a debt-service ratio of roughly 30–50% of monthly income, minus existing obligations. This calculator estimates on that basis, but real approval also weighs credit history, income stability and the value of the collateral.']
  ];
  return F.map(r => ({ q: th ? r[0] : r[1], a: th ? r[2] : r[3] }));
}

function getGlossary(th) {
  const G = [
    ['เงินต้น (Principal)', 'Principal', 'ยอดเงินที่กู้จริง ไม่รวมดอกเบี้ย', 'The amount actually borrowed, before any interest.'],
    ['ลดต้นลดดอก (Reducing balance)', 'Reducing balance', 'ดอกเบี้ยคิดจากยอดหนี้คงเหลือในแต่ละงวด', 'Interest is charged on the balance still outstanding each period.'],
    ['Flat Rate', 'Flat rate', 'ดอกเบี้ยคิดจากเงินต้นเต็มจำนวนตลอดสัญญา', 'Interest is charged on the original principal for the whole term.'],
    ['Effective Rate', 'Effective rate', 'อัตราดอกเบี้ยแบบลดต้นลดดอกที่ให้ต้นทุนเท่ากับสินเชื่อนั้น ใช้เทียบข้ามผลิตภัณฑ์', 'The reducing-balance rate that costs the same — the number to compare products with.'],
    ['ตารางผ่อนชำระ (Amortization)', 'Amortization schedule', 'ตารางที่แยกให้เห็นว่าแต่ละงวดจ่ายเป็นเงินต้นเท่าไร ดอกเบี้ยเท่าไร และเหลือหนี้เท่าไร', 'The period-by-period split of principal, interest and remaining balance.'],
    ['DSR', 'DSR', 'สัดส่วนภาระหนี้ต่อรายได้ต่อเดือน เกณฑ์ที่ผู้ให้กู้ใช้จำกัดวงเงิน', 'Debt-service ratio: monthly debt payments as a share of monthly income.']
  ];
  return G.map(r => ({ term: th ? r[0] : r[1], def: th ? r[2] : r[3] }));
}

// Node unit tests for js/logic.js. Run: node tests/logic.test.js
const assert = require('assert');
const L = require('../js/logic.js');
let n = 0;
function check(name, fn) { fn(); n++; console.log('ok - ' + name); }

check('toPaisa rounds to integer paisa', () => {
  assert.strictEqual(L.toPaisa(12500.555), 1250056);
  assert.strictEqual(L.toPaisa(0), 0);
});
check('amountInWords: 12500.50', () => {
  assert.strictEqual(L.amountInWords(1250050), 'Twelve thousand five hundred taka and fifty paisa only');
});
check('amountInWords: zero and lakh', () => {
  assert.strictEqual(L.amountInWords(0), 'Zero taka only');
  assert.strictEqual(L.amountInWords(15000000), 'One lakh fifty thousand taka only');
});
check('amountInWords: 1 taka singular, rejects negative', () => {
  assert.strictEqual(L.amountInWords(100), 'One taka only');
  assert.strictEqual(L.amountInWords(-100), null);
});
check('Bengali digits', () => {
  assert.strictEqual(L.toBnDigits('2026-11'), '২০২৬-১১');
});
check('month validation + label', () => {
  assert.strictEqual(L.isValidMonth('2026-11'), true);
  assert.strictEqual(L.isValidMonth('2026-13'), false);
  assert.strictEqual(L.isValidMonth('2026-1'), false);
  assert.strictEqual(L.monthLabel('2026-11'), 'Nov 2026');
});
check('tenant validation catches empty name / bad rent', () => {
  const bad = { name: '', property: 'Flat 3B', rentPaisa: 0, advancePaisa: -1, phone: 'abc', startMonth: '2026-13' };
  const errs = L.validateTenant(bad);
  assert.ok(errs.includes('name') && errs.includes('rent') && errs.includes('advance') && errs.includes('phone') && errs.includes('startMonth'));
  const good = { name: 'Rahim', property: 'Flat 3B', rentPaisa: 1200000, advancePaisa: 2400000, phone: '01712345678', startMonth: '2026-10' };
  assert.deepStrictEqual(L.validateTenant(good), []);
});
check('payment validation: before-start rejected', () => {
  const tenant = { id: 't1', name: 'R', property: 'F', rentPaisa: 1000000, advancePaisa: 0, startMonth: '2026-11' };
  const p = { month: '2026-10', amountPaisa: 1000000, method: 'Cash', date: '2026-10-05' };
  assert.ok(L.validatePayment(p, tenant).includes('beforeStart'));
  const p2 = { month: '2026-11', amountPaisa: 1000000, method: 'bKash', date: '2026-11-05' };
  assert.deepStrictEqual(L.validatePayment(p2, tenant), []);
});
check('month status: unpaid / partial / paid', () => {
  const tenant = { id: 't1', rentPaisa: 1200000 };
  assert.strictEqual(L.monthStatus(tenant, [], '2026-11'), 'Unpaid');
  assert.strictEqual(L.monthStatus(tenant, [{ tenantId: 't1', month: '2026-11', amountPaisa: 500000 }], '2026-11'), 'Partial');
  assert.strictEqual(L.monthStatus(tenant, [{ tenantId: 't1', month: '2026-11', amountPaisa: 1200000 }], '2026-11'), 'Paid');
});
check('paidForMonth sums only that tenant+month', () => {
  const ps = [
    { tenantId: 't1', month: '2026-11', amountPaisa: 700000 },
    { tenantId: 't1', month: '2026-11', amountPaisa: 500000 },
    { tenantId: 't1', month: '2026-10', amountPaisa: 900000 },
    { tenantId: 't2', month: '2026-11', amountPaisa: 999999 },
  ];
  assert.strictEqual(L.paidForMonth(ps, 't1', '2026-11'), 1200000);
});
check('receipt numbers sequence within a year', () => {
  const rs = [{ receiptNo: 'RR-2026-0001' }, { receiptNo: 'RR-2026-0002' }, { receiptNo: 'RR-2025-0009' }];
  assert.strictEqual(L.nextReceiptNo(rs, '2026'), 'RR-2026-0003');
  assert.strictEqual(L.nextReceiptNo([], '2026'), 'RR-2026-0001');
});
check('dashboard stats: collected, outstanding, advance held', () => {
  const tenants = [
    { id: 't1', rentPaisa: 1200000, advancePaisa: 2400000, startMonth: '2026-10', vacated: false },
    { id: 't2', rentPaisa: 800000, advancePaisa: 1600000, startMonth: '2026-11', vacated: false },
    { id: 't3', rentPaisa: 500000, advancePaisa: 1000000, startMonth: '2026-10', vacated: true },
  ];
  const payments = [
    { tenantId: 't1', month: '2026-11', amountPaisa: 1200000 },
    { tenantId: 't2', month: '2026-11', amountPaisa: 300000 },
  ];
  const s = L.dashboardStats(tenants, payments, '2026-11');
  assert.strictEqual(s.activeTenants, 2);
  assert.strictEqual(s.collectedPaisa, 1500000);
  assert.strictEqual(s.outstandingPaisa, 500000);
  assert.strictEqual(s.advanceHeldPaisa, 4000000);
});
check('dashboard: tenant starting after view month owes nothing', () => {
  const tenants = [{ id: 't1', rentPaisa: 1000000, advancePaisa: 0, startMonth: '2026-12', vacated: false }];
  assert.strictEqual(L.dashboardStats(tenants, [], '2026-11').outstandingPaisa, 0);
});
check('import validation: valid, unknown tenant, bad receipt', () => {
  const good = { tenants: [{ id: 't1', name: 'R', property: 'F', rentPaisa: 1000000, advancePaisa: 0, startMonth: '2026-11' }],
    payments: [{ id: 'p1', tenantId: 't1', month: '2026-11', amountPaisa: 1000000, method: 'Cash', date: '2026-11-05', receiptNo: 'RR-2026-0001' }] };
  assert.strictEqual(L.validateImport(good), true);
  const badTenant = JSON.parse(JSON.stringify(good));
  badTenant.payments[0].tenantId = 'nope';
  assert.strictEqual(L.validateImport(badTenant), false);
  const badReceipt = JSON.parse(JSON.stringify(good));
  delete badReceipt.payments[0].receiptNo;
  assert.strictEqual(L.validateImport(badReceipt), false);
  assert.strictEqual(L.validateImport(null), false);
  assert.strictEqual(L.validateImport({ tenants: [], payments: 'x' }), false);
});
check('import validation: duplicate tenant id rejected', () => {
  const t = { id: 't1', name: 'R', property: 'F', rentPaisa: 1000000, advancePaisa: 0, startMonth: '2026-11' };
  assert.strictEqual(L.validateImport({ tenants: [t, { ...t }], payments: [] }), false);
});

console.log(n + '/' + n + ' node unit tests passed');

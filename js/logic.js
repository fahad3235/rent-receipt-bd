// Rent Receipt BD — pure logic (no DOM). Money is integer paisa.
// All functions are unit-tested by tests/logic.test.js (node).

function toPaisa(bdt) {
  if (typeof bdt !== 'number' || !isFinite(bdt)) return null;
  return Math.round(bdt * 100);
}
function fromPaisa(p) { return (p / 100).toFixed(2); }

// --- Bengali digits ---
const BN_DIGITS = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
function toBnDigits(str) {
  return String(str).replace(/[0-9]/g, d => BN_DIGITS[Number(d)]);
}

// --- Month helpers: YYYY-MM ---
function isValidMonth(m) {
  if (typeof m !== 'string') return false;
  const mt = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(m);
  return !!mt;
}
function currentMonth(date) {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function monthLabel(m) {
  // "2026-11" -> "Nov 2026" (EN label; BN rendering converts digits)
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const parts = m.split('-');
  return names[Number(parts[1]) - 1] + ' ' + parts[0];
}

// --- Amount in words (English, BDT, up to 999,999,999.99) ---
const ONES = ['', 'one','two','three','four','five','six','seven','eight','nine','ten',
  'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS = ['', '', 'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function wordsUnder1000(n) {
  let out = '';
  if (n >= 100) {
    out += ONES[Math.floor(n / 100)] + ' hundred';
    n %= 100;
    if (n) out += ' ';
  }
  if (n >= 20) {
    out += TENS[Math.floor(n / 10)];
    if (n % 10) out += '-' + ONES[n % 10];
  } else if (n > 0) {
    out += ONES[n];
  }
  return out;
}
function amountInWords(paisa) {
  if (typeof paisa !== 'number' || !Number.isInteger(paisa) || paisa < 0) return null;
  const taka = Math.floor(paisa / 100);
  const p = paisa % 100;
  let takaWords;
  if (taka === 0) takaWords = 'zero';
  else {
    const scales = [[10000000, 'crore'], [100000, 'lakh'], [1000, 'thousand']];
    let rest = taka;
    const parts = [];
    for (const [val, name] of scales) {
      if (rest >= val) {
        const q = Math.floor(rest / val);
        parts.push(wordsUnder1000(q) + ' ' + name);
        rest %= val;
      }
    }
    if (rest) parts.push(wordsUnder1000(rest));
    takaWords = parts.join(' ');
  }
  let out = takaWords + (taka === 1 ? ' taka' : ' taka');
  if (p) out += ' and ' + wordsUnder1000(p) + (p === 1 ? ' paisa' : ' paisa');
  return out.charAt(0).toUpperCase() + out.slice(1) + ' only';
}

// --- Tenants & payments ---
// tenant: {id, name, property, rentPaisa, advancePaisa, phone, startMonth, vacated, refundPaisa}
// payment: {id, tenantId, month, amountPaisa, method, date, receiptNo}
function validateTenant(t) {
  const errors = [];
  if (!t || typeof t.name !== 'string' || !t.name.trim()) errors.push('name');
  if (!t || typeof t.property !== 'string' || !t.property.trim()) errors.push('property');
  if (!t || !Number.isInteger(t.rentPaisa) || t.rentPaisa <= 0) errors.push('rent');
  if (!t || !Number.isInteger(t.advancePaisa) || t.advancePaisa < 0) errors.push('advance');
  if (t && t.phone && !/^[0-9+\- ]{7,16}$/.test(t.phone)) errors.push('phone');
  if (!t || !isValidMonth(t.startMonth)) errors.push('startMonth');
  return errors;
}
function validatePayment(p, tenant) {
  const errors = [];
  if (!p || !isValidMonth(p.month)) errors.push('month');
  if (!p || !Number.isInteger(p.amountPaisa) || p.amountPaisa <= 0) errors.push('amount');
  if (!p || !['Cash','bKash','Nagad','Bank','Other'].includes(p.method)) errors.push('method');
  if (!p || !/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) errors.push('date');
  if (tenant && p && p.month < tenant.startMonth) errors.push('beforeStart');
  return errors;
}
function paidForMonth(payments, tenantId, month) {
  return payments.filter(p => p.tenantId === tenantId && p.month === month)
    .reduce((s, p) => s + p.amountPaisa, 0);
}
function monthStatus(tenant, payments, month) {
  const paid = paidForMonth(payments, tenantIdOf(tenant), month);
  if (paid <= 0) return 'Unpaid';
  if (paid >= tenant.rentPaisa) return 'Paid';
  return 'Partial';
}
function tenantIdOf(t) { return t.id; }

function nextReceiptNo(receipts, year) {
  // RR-2026-0001, sequential within the calendar year of the payment date.
  const prefix = 'RR-' + year + '-';
  let max = 0;
  for (const r of receipts) {
    if (typeof r.receiptNo === 'string' && r.receiptNo.startsWith(prefix)) {
      const n = parseInt(r.receiptNo.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return prefix + String(max + 1).padStart(4, '0');
}

function dashboardStats(tenants, payments, month) {
  const active = tenants.filter(t => !t.vacated);
  const collected = payments.filter(p => p.month === month)
    .reduce((s, p) => s + p.amountPaisa, 0);
  let outstanding = 0;
  for (const t of active) {
    if (t.startMonth <= month) {
      outstanding += Math.max(0, t.rentPaisa - paidForMonth(payments, t.id, month));
    }
  }
  const advanceHeld = tenants.filter(t => !t.vacated)
    .reduce((s, t) => s + t.advancePaisa, 0);
  return {
    activeTenants: active.length,
    collectedPaisa: collected,
    outstandingPaisa: outstanding,
    advanceHeldPaisa: advanceHeld
  };
}

// --- Export / import (strict) ---
function validateImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!Array.isArray(data.tenants) || !Array.isArray(data.payments)) return false;
  const tenantIds = new Set();
  for (const t of data.tenants) {
    if (typeof t.id !== 'string' || !t.id) return false;
    if (tenantIds.has(t.id)) return false;
    tenantIds.add(t.id);
    if (validateTenant(t).length) return false;
  }
  for (const p of data.payments) {
    if (typeof p.id !== 'string' || !p.id) return false;
    if (!tenantIds.has(p.tenantId)) return false;
    const tenant = data.tenants.find(t => t.id === p.tenantId);
    if (validatePayment(p, tenant).length) return false;
    if (typeof p.receiptNo !== 'string' || !p.receiptNo) return false;
  }
  return true;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { toPaisa, fromPaisa, toBnDigits, isValidMonth, currentMonth,
    monthLabel, amountInWords, validateTenant, validatePayment, paidForMonth,
    monthStatus, nextReceiptNo, dashboardStats, validateImport };
}

// Rent Receipt BD — UI. Depends on logic.js + i18n.js (globals in browser).
(function () {
  'use strict';
  const KEY = 'rent-receipt-bd-v1';
  const METHODS = ['Cash', 'bKash', 'Nagad', 'Bank', 'Other'];
  let state = load();
  let lang = state.lang || 'en';
  let viewMonth = currentMonth();
  let activeTab = 'dashboard';
  let searchQ = '';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const d = JSON.parse(raw); if (validateImport(d)) return d; }
    } catch (e) {}
    return { tenants: [], payments: [] };
  }
  function save() {
    state.lang = lang;
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  function t(k) { return I18N[lang][k] || I18N.en[k] || k; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmt(paisa) {
    const n = fromPaisa(paisa);
    const parts = n.split('.');
    parts[0] = Number(parts[0]).toLocaleString('en-US');
    const out = '৳' + parts.join('.');
    return lang === 'bn' ? toBnDigits(out) : out;
  }
  function fmtMonth(m) { return lang === 'bn' ? toBnDigits(monthLabel(m)) : monthLabel(m); }
  function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function $(id) { return document.getElementById(id); }

  function setLang(l) { lang = l; save(); renderAll(); }
  function setTab(tab) { activeTab = tab; renderAll(); }

  function renderAll() {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    $('lang-en').classList.toggle('active', lang === 'en');
    $('lang-bn').classList.toggle('active', lang === 'bn');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'tab-' + activeTab));
    $('view-month').value = viewMonth;
    renderDashboard(); renderTenants(); renderReceipts();
    $('tenant-select').innerHTML = state.tenants.filter(x => !x.vacated)
      .map(x => '<option value="' + x.id + '">' + esc(x.name) + ' — ' + esc(x.property) + '</option>').join('')
      || '<option value="">—</option>';
  }

  function renderDashboard() {
    const s = dashboardStats(state.tenants, state.payments, viewMonth);
    $('stat-tenants').textContent = lang === 'bn' ? toBnDigits(String(s.activeTenants)) : s.activeTenants;
    $('stat-collected').textContent = fmt(s.collectedPaisa);
    $('stat-outstanding').textContent = fmt(s.outstandingPaisa);
    $('stat-advance').textContent = fmt(s.advanceHeldPaisa);
    const rows = state.tenants.filter(x => !x.vacated && x.startMonth <= viewMonth)
      .map(x => {
        const paid = paidForMonth(state.payments, x.id, viewMonth);
        const st = monthStatus(x, state.payments, viewMonth);
        const stKey = st === 'Paid' ? 'paidStatus' : st === 'Partial' ? 'partialStatus' : 'unpaidStatus';
        return '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.property) + '</td><td>' + fmt(x.rentPaisa) +
          '</td><td>' + fmt(paid) + '</td><td><span class="badge ' + st.toLowerCase() + '">' + t(stKey) + '</span></td></tr>';
      }).join('');
    $('month-table-body').innerHTML = rows || '<tr><td colspan="5">' + t('noTenants') + '</td></tr>';
    $('month-title').textContent = fmtMonth(viewMonth);
  }

  function renderTenants() {
    const q = searchQ.trim().toLowerCase();
    const list = state.tenants.filter(x => !q || (x.name + ' ' + x.property).toLowerCase().includes(q));
    $('tenant-list').innerHTML = list.map(x => {
      const paid = paidForMonth(state.payments, x.id, viewMonth);
      const st = monthStatus(x, state.payments, viewMonth);
      const stKey = st === 'Paid' ? 'paidStatus' : st === 'Partial' ? 'partialStatus' : 'unpaidStatus';
      return '<article class="card"><h3>' + esc(x.name) + (x.vacated ? ' <span class="badge vacated">' + t('vacated') + '</span>' : '') +
        '</h3><p>' + esc(x.property) + (x.phone ? ' · ' + esc(x.phone) : '') + '</p>' +
        '<p>' + t('monthlyRent') + ': ' + fmt(x.rentPaisa) + ' · ' + t('advance') + ': ' + fmt(x.advancePaisa) + '</p>' +
        '<p>' + fmtMonth(viewMonth) + ': ' + fmt(paid) + ' — <span class="badge ' + st.toLowerCase() + '">' + t(stKey) + '</span></p>' +
        '<div class="row">' +
        (!x.vacated ? '<button data-vacate="' + x.id + '">' + t('vacate') + '</button>' : '') +
        '<button data-del-tenant="' + x.id + '">' + t('delete') + '</button></div></article>';
    }).join('') || '<p>' + t('noTenants') + '</p>';
    document.querySelectorAll('[data-vacate]').forEach(b => b.onclick = () => vacateTenant(b.dataset.vacate));
    document.querySelectorAll('[data-del-tenant]').forEach(b => b.onclick = () => {
      state.tenants = state.tenants.filter(x => x.id !== b.dataset.delTenant);
      state.payments = state.payments.filter(p => p.tenantId !== b.dataset.delTenant);
      save(); renderAll();
    });
  }

  function renderReceipts() {
    const q = searchQ.trim().toLowerCase();
    const sorted = [...state.payments].sort((a, b) => b.date.localeCompare(a.date) || b.receiptNo.localeCompare(a.receiptNo));
    const list = sorted.filter(p => {
      const tn = state.tenants.find(x => x.id === p.tenantId);
      return !q || (p.receiptNo + ' ' + (tn ? tn.name : '')).toLowerCase().includes(q);
    });
    $('receipt-list').innerHTML = list.map(p => {
      const tn = state.tenants.find(x => x.id === p.tenantId);
      return '<article class="card"><h3>' + esc(p.receiptNo) + '</h3><p>' + esc(tn ? tn.name : '?') +
        ' · ' + fmtMonth(p.month) + ' · ' + esc(p.method) + ' · ' + esc(p.date) + '</p>' +
        '<p class="big">' + fmt(p.amountPaisa) + '</p>' +
        '<button data-print="' + p.id + '">' + t('print') + '</button></article>';
    }).join('') || '<p>' + t('noReceipts') + '</p>';
    document.querySelectorAll('[data-print]').forEach(b => b.onclick = () => printReceipt(b.dataset.print));
  }

  function vacateTenant(id) {
    if (!confirm(t('vacateConfirm'))) return;
    const x = state.tenants.find(v => v.id === id);
    if (!x) return;
    const raw = prompt(t('refundLabel'), '0');
    if (raw === null) return;
    const refund = toPaisa(parseFloat(raw));
    if (refund === null || refund < 0 || refund > x.advancePaisa) { alert(t('errAdvance')); return; }
    x.vacated = true; x.refundPaisa = refund; x.advancePaisa = x.advancePaisa - refund;
    save(); renderAll();
  }

  function printReceipt(paymentId) {
    const p = state.payments.find(x => x.id === paymentId);
    if (!p) return;
    const tn = state.tenants.find(x => x.id === p.tenantId);
    const area = $('print-area');
    area.innerHTML = '<h1>' + t('receiptTitle') + '</h1>' +
      '<p><strong>' + t('receiptNo') + ':</strong> ' + esc(p.receiptNo) + '</p>' +
      '<p><strong>' + t('receivedFrom') + ':</strong> ' + esc(tn ? tn.name : '?') + '</p>' +
      '<p><strong>' + t('property') + ':</strong> ' + esc(tn ? tn.property : '') + '</p>' +
      '<p><strong>' + t('forMonth') + ':</strong> ' + fmtMonth(p.month) + '</p>' +
      '<p><strong>' + t('amount') + ':</strong> ' + fmt(p.amountPaisa) + '</p>' +
      '<p><strong>' + t('amountWords') + ':</strong> ' + esc(amountInWords(p.amountPaisa)) + '</p>' +
      '<p><strong>' + t('method') + ':</strong> ' + esc(p.method) + ' · <strong>' + t('payDate') + ':</strong> ' + esc(p.date) + '</p>' +
      '<p class="small">' + t('landlordNote') + '</p>';
    document.body.classList.add('printing');
    window.print();
    setTimeout(() => document.body.classList.remove('printing'), 500);
  }

  function showError(id, msg) { const el = $(id); el.textContent = msg; el.classList.toggle('hidden', !msg); }

  document.addEventListener('DOMContentLoaded', () => {
    $('lang-en').onclick = () => setLang('en');
    $('lang-bn').onclick = () => setLang('bn');
    document.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => setTab(b.dataset.tab));
    $('view-month').onchange = e => { viewMonth = e.target.value || currentMonth(); renderAll(); };
    $('search').oninput = e => { searchQ = e.target.value; renderTenants(); renderReceipts(); };

    $('tenant-form').onsubmit = e => {
      e.preventDefault();
      const tenant = {
        id: uid(),
        name: $('f-name').value.trim(),
        property: $('f-property').value.trim(),
        rentPaisa: toPaisa(parseFloat($('f-rent').value)),
        advancePaisa: toPaisa(parseFloat($('f-advance').value || '0')),
        phone: $('f-phone').value.trim(),
        startMonth: $('f-start').value,
        vacated: false, refundPaisa: 0
      };
      const errs = validateTenant(tenant);
      const msgMap = { name: 'errName', property: 'errProperty', rent: 'errRent', advance: 'errAdvance', phone: 'errPhone', startMonth: 'errMonth' };
      showError('tenant-error', errs.length ? t(msgMap[errs[0]]) : '');
      if (errs.length) return;
      state.tenants.push(tenant); save(); e.target.reset(); $('f-start').value = currentMonth(); renderAll();
    };
    $('f-start').value = currentMonth();

    $('payment-form').onsubmit = e => {
      e.preventDefault();
      const tenant = state.tenants.find(x => x.id === $('tenant-select').value);
      if (!tenant) { showError('payment-error', t('errName')); return; }
      const p = {
        id: uid(), tenantId: tenant.id,
        month: $('p-month').value,
        amountPaisa: toPaisa(parseFloat($('p-amount').value)),
        method: $('p-method').value,
        date: $('p-date').value,
        receiptNo: nextReceiptNo(state.payments, ($('p-date').value || '2026-01-01').slice(0, 4))
      };
      const errs = validatePayment(p, tenant);
      const msgMap = { month: 'errMonth', amount: 'errAmount', method: 'errMethod', date: 'errDate', beforeStart: 'errBeforeStart' };
      showError('payment-error', errs.length ? t(msgMap[errs[0]]) : '');
      if (errs.length) return;
      state.payments.push(p); save(); e.target.reset(); $('p-month').value = currentMonth();
      $('p-date').value = new Date().toISOString().slice(0, 10); renderAll();
    };
    $('p-month').value = currentMonth();
    $('p-date').value = new Date().toISOString().slice(0, 10);

    $('export-btn').onclick = () => {
      const blob = new Blob([JSON.stringify({ tenants: state.tenants, payments: state.payments }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'rent-receipt-bd-export.json'; a.click();
      URL.revokeObjectURL(a.href);
    };
    $('import-file').onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!validateImport(data)) throw new Error('invalid');
          state = { tenants: data.tenants, payments: data.payments };
          save(); showError('data-msg', t('okImport')); renderAll();
        } catch (err) { showError('data-msg', t('errImport')); }
      };
      reader.readAsText(file);
    };
    $('erase-btn').onclick = () => {
      const typed = prompt(t('eraseConfirm'), '');
      if (typed === 'DELETE') {
        state = { tenants: [], payments: [] }; save();
        showError('data-msg', t('okErase')); renderAll();
      }
    };
    renderAll();
  });
})();

// ── UTILS.JS ──────────────────────────────────────────────────────────────────
// Pure helpers with no feature logic. Safe to call from any module.
// Depends on: state.js (for `data`, `appLang`, storage keys)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

// ── DOM SHORTHAND ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── FORMATTING ────────────────────────────────────────────────────────────────
const usd      = n  => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
const today    = () => { const d = new Date(); const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmtDate  = d  => { if (!d || d === 'N/A') return 'N/A'; const [y, mo, dy] = d.split('-'); return `${mo}-${dy}-${y}`; };
const daysUntil = d => Math.ceil((new Date(d) - new Date(today())) / 86400000);
const pct      = n  => (n || 0).toFixed(2) + '%';

// Strip non-numeric chars from pasted values (%, $, commas, spaces, etc.)
const sanitizeNum = s => parseFloat(String(s).replace(/[^0-9.\-]/g, '')) || 0;

// Escape HTML special chars — used in chat/advisor output
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── i18n ──────────────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  es: {
    'Theme':'Tema',
    'Restored!':'Restaurado!',
    'Please select a Pay From account':'Por favor selecciona una cuenta de pago',
    'Please select a payment method':'Por favor selecciona un metodo de pago',
    'Set as default payment account':'Cuenta de pago predeterminada',
    'Spending Anomalies':'Anomalias de Gastos',
    'Track Promo Debt':'Registrar Promo',
    'Promo debt tracked!':'Promo registrada!',
    'Net Worth History':'Historial de Patrimonio Neto',
    '📊 Export to Excel / Numbers':'📊 Exportar a Excel / Numbers',
    'Excel file downloaded!':'Archivo Excel descargado!',
    'Debt-Free Countdown':'Cuenta Regresiva sin Deudas',
    'Smart Bill Reminder':'Recordatorio Inteligente de Facturas',
    'Next 30 Days':'Proximos 30 dias',
    'vs 3-month average':'vs promedio 3 meses',
    'this month vs':'este mes vs',
    'ahead of pace':'adelantado al ritmo',
    'slightly ahead':'ligeramente adelantado',
    'on track':'al ritmo',
    'Income Projection':'Proyeccion de Ingresos',
    'Dark':'Oscuro',
    'Light':'Claro',
    'Auto':'Auto',
    'Cash Flow':'Flujo de Caja',
    'Money In':'Dinero Entrante',
    'Money Out':'Dinero Saliente',
    'Net Cash Flow':'Flujo Neto',
    'Dashboard':'Panel',
    'Budget':'Presupuesto',
    'Bills':'Facturas',
    'Bills & Payments':'Facturas y Pagos',
    'Bills &amp; Payments':'Facturas y Pagos',
    'Debt Planner':'Plan de Deudas',
    'Net Worth':'Patrimonio',
    'Accounts':'Cuentas',
    'Insights':'Analisis',
    'Cards':'Tarjetas',
    'Quick Update':'Actualizacion',
    'Lock App':'Bloquear App',
    'Settings':'Configuracion',
    'Personal Finance Tools':'Herramientas Financieras',
    'Financial Overview':'Resumen Financiero',
    'Total Income':'Ingresos Totales',
    'Total Expenses':'Gastos Totales',
    'Total Debt':'Deuda Total',
    'Net Balance':'Saldo Neto',
    'Recent Activity':'Actividad Reciente',
    'No recent activity':'Sin actividad reciente',
    'Bills & Payments':'Facturas y Pagos',
    'Add Bill':'Agregar Factura',
    'No bills yet':'Sin facturas aun',
    'Paid':'Pagado',
    'Pending':'Pendiente',
    'Overdue':'Vencido',
    'Scheduled':'Programado',
    'Missed':'Perdido',
    'Received':'Recibido',
    'No Data':'Sin Datos',
    'Theme':'Tema',
    'Reset All Data':'Restablecer Datos',
    'Backup':'Respaldo',
    'Saved just now':'Guardado ahora',
    'Not saved yet':'Sin guardar',
    'Backup downloaded!':'Respaldo descargado!',
    'Set Up PIN':'Configurar PIN',
    'Change PIN':'Cambiar PIN',
    'PIN Lock':'Bloqueo PIN',
    'Language':'Idioma',
    '⬇️ Export Backup':'⬇️ Exportar Respaldo',
    '⬆️ Import Backup':'⬆️ Importar Respaldo',
    '🎭 Load Demo Data':'🎭 Cargar Demo',
    '🗑️ Reset Everything':'🗑️ Restablecer Todo',
    'Source':'Fuente',
    'Amount ($)':'Monto ($)',
    'Date Received':'Fecha de Recibo',
    'Deposit to Account':'Depositar en Cuenta',
    'Frequency':'Frecuencia',
    'One-time':'Una vez',
    'Weekly':'Semanal',
    'Bi-weekly':'Quincenal',
    'Monthly':'Mensual',
    'Yearly':'Anual',
    'Save Income':'Guardar Ingreso',
    'Category':'Categoria',
    'Description':'Descripcion',
    'Description (optional)':'Descripcion (opcional)',
    'Date':'Fecha',
    'Pay from Account':'Pagar desde Cuenta',
    'Save Expense':'Guardar Gasto',
    'Name':'Nombre',
    'Type':'Tipo',
    'Regular Bill':'Factura Regular',
    'Credit Card':'Tarjeta de Credito',
    'Loan (Car, Student, Mortgage)':'Prestamo (Auto, Estudiante, Hipoteca)',
    'Min. Payment ($)':'Pago Minimo ($)',
    'Due Date':'Fecha de Vencimiento',
    'Current Balance ($)':'Saldo Actual ($)',
    'APR (%)':'APR (%)',
    'Credit Limit ($)':'Limite de Credito ($)',
    'Recurring?':'Recurrente?',
    'Save':'Guardar',
    '🗑️ Remove this Bill / Debt':'🗑️ Eliminar Factura / Deuda',
    'Card Name / Bank':'Nombre de Tarjeta / Banco',
    'Last 4 Digits':'Ultimos 4 Digitos',
    'Remind me every':'Recordarme cada',
    '30 days':'30 dias',
    '60 days':'60 dias',
    '90 days':'90 dias',
    'Notes (optional)':'Notas (opcional)',
    'Save Card':'Guardar Tarjeta',
    'Account Name':'Nombre de Cuenta',
    'Current Value ($)':'Valor Actual ($)',
    'Save Asset':'Guardar Activo',
    'Target Type':'Tipo de Meta',
    'Expense Category':'Categoria de Gasto',
    'Credit Card Spending':'Gasto en Tarjeta',
    'Monthly Limit ($)':'Limite Mensual ($)',
    'Save Target':'Guardar Meta',
    'Payment Method':'Metodo de Pago',
    'Category (optional)':'Categoria (opcional)',
    'Housing':'Vivienda',
    'Food':'Comida',
    'Transport':'Transporte',
    'Utilities':'Servicios',
    'Subscriptions':'Suscripciones',
    'Healthcare':'Salud',
    'Entertainment':'Entretenimiento',
    'Savings':'Ahorros',
    'Other':'Otro',
    'Select category...':'Seleccionar categoria...',
    'Add Income':'Agregar Ingreso',
    'Edit Income':'Editar Ingreso',
    'Add Expense':'Agregar Gasto',
    'Edit Expense':'Editar Gasto',
    'Add Bill / Debt':'Agregar Factura / Deuda',
    'Edit Bill / Debt':'Editar Factura / Deuda',
    'Add Inactive Card':'Agregar Tarjeta Inactiva',
    'Add Asset':'Agregar Activo',
    'Edit Asset':'Editar Activo',
    'Set Budget Target':'Establecer Meta',
    'Add Account':'Agregar Cuenta',
    'Edit Account':'Editar Cuenta',
    '🛒 New Purchase':'🛒 Nueva Compra',
    '📅 Schedule Payment':'📅 Programar Pago',
    '💳 Record Payment':'💳 Registrar Pago',
    '📅 Add to Calendar':'📅 Agregar al Calendario',
    '⚙️ Settings':'⚙️ Configuracion',
    'Cash Withdrawal':'Retiro de Efectivo',
    'Edit:':'Editar:',
    'Add to Calendar':'Agregar al Calendario',
    'Payment Amount':'Monto de Pago',
    'Minimum Payment':'Pago Minimo',
    'Suggested (Planner)':'Sugerido (Planificador)',
    'Pay in Full':'Pagar Total',
    'Or enter custom amount ($)':'O ingresa monto personalizado ($)',
    'Confirm Payment':'Confirmar Pago',
    'Minimum / Standard':'Minimo / Estandar',
    'Confirm Schedule':'Confirmar Programacion',
    'Apple Calendar':'Calendario Apple',
    'Google Calendar':'Google Calendar',
    'Outlook / Other':'Outlook / Otro',
    'Downloads .ics file - opens in Apple Calendar':'Descarga archivo .ics para Apple Calendar',
    'Opens Google Calendar in your browser':'Abre Google Calendar en tu navegador',
    'Downloads .ics - works with any calendar app':'Descarga .ics para cualquier app de calendario',
    'Enter your PIN to continue':'Ingresa tu PIN para continuar',
    'Clear':'Limpiar',
    'New PIN (4 digits)':'Nuevo PIN (4 digitos)',
    'Confirm PIN':'Confirmar PIN',
    'Remove PIN Lock':'Eliminar PIN',
    'Save PIN':'Guardar PIN',
    'No PIN set. Add a PIN to lock the app on startup.':'Sin PIN. Agrega un PIN para bloquear la app al inicio.',
    'PIN is active. App locks on startup.':'PIN activo. La app se bloquea al inicio.',
    'No inactive cards. Cards with a $0 balance will appear here automatically.':'Sin tarjetas inactivas. Las tarjetas con saldo $0 apareceran automaticamente.',
    'No credit cards with a limit set. Edit a debt in Bills and add a Credit Limit.':'Sin tarjetas con limite. Edita una deuda en Facturas y agrega un Limite de Credito.',
    'Track your checking, savings, and cash accounts. Link income and expenses to keep balances accurate.':'Registra tus cuentas para mantener saldos precisos.',
    'No account linked':'Sin cuenta vinculada',
    'No card / cash purchase':'Sin tarjeta / efectivo',
    '-- Select payment method --':'-- Selecciona metodo de pago --',
    'No debt cards found':'Sin tarjetas de credito registradas',
    'No category':'Sin categoria',
    'Due TODAY':'Vence HOY',
    'days overdue':'dias vencido',
    'Due in':'Vence en',
    'day':'dia',
    'days':'dias',
    'No activity in the past 7 days.':'Sin actividad en los ultimos 7 dias.',
    'No activity in the past or next 7 days.':'Sin actividad esta semana.',
    'Upcoming':'Proximos',
    'Recent':'Recientes',
    'TODAY':'HOY',
    'APR:':'APR:',
    'Balance:':'Saldo:',
    'No purchases in 90+ days - use this card!':'Sin compras en 90+ dias - usa esta tarjeta!',
    'No purchases logged yet':'Sin compras registradas',
    'Last purchase:':'Ultima compra:',
    'days ago':'dias atras',
    'Over budget by':'Excede el presupuesto por',
    'used this month':'usado este mes',
    '-- No account linked --':'-- Sin cuenta vinculada --',
    'Auto-Save Active':'Guardado Automatico Activo',
    'Data saves automatically in':'Los datos se guardan automaticamente en',
    'this browser only':'este navegador',
  }
};

function t(key) {
  if (appLang === 'en') return key;
  return TRANSLATIONS.es[key] || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  const autosave = $('autosave-desc');
  if (autosave) {
    autosave.innerHTML = appLang === 'es'
      ? 'Los datos se guardan automaticamente en <strong style="color:var(--text)">este navegador</strong> via almacenamiento local. Nada se envia a ningun lugar. <strong class="txt-accent">Formato v4</strong> - exporta un respaldo antes de actualizar.'
      : 'Data saves automatically in <strong style="color:var(--text)">this browser only</strong> via local storage. Nothing is ever sent anywhere. <strong class="txt-accent">v4 format</strong> - export a backup before updating if you have real data.';
  }
  const backupDesc = $('backup-desc');
  if (backupDesc) {
    backupDesc.innerHTML = appLang === 'es'
      ? 'Exporta tus datos como archivo <strong style="color:var(--text)">.json</strong> guardado en tu dispositivo. Importalos en cualquier momento para restaurar, incluso despues de actualizaciones.'
      : 'Export your data as a <strong style="color:var(--text)">.json</strong> file saved to your device. Import it any time to restore - even after app updates or on a new device.';
  }
  document.title = 'FinanceOS';
}

// ── HAPTIC ────────────────────────────────────────────────────────────────────
function haptic(type) {
  try { navigator.vibrate && navigator.vibrate(type === 'heavy' ? 20 : type === 'medium' ? 12 : 6); } catch (e) {}
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, type) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg || (appLang === 'es' ? 'Guardado' : 'Saved');
  if (type === 'error') {
    el.style.background = 'rgba(239,68,68,.15)';
    el.style.borderColor = 'rgba(239,68,68,.4)';
    el.style.color = 'var(--red)';
  } else {
    el.style.background = 'rgba(34,197,94,.15)';
    el.style.borderColor = 'rgba(34,197,94,.35)';
    el.style.color = 'var(--green)';
  }
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 2400);
}

// ── CONFIRM / ALERT MODALS ────────────────────────────────────────────────────
let _confirmCallback = null;

function showConfirm(opts) {
  const o = Object.assign({ title: 'Are you sure?', msg: '', icon: '⚠️', okLabel: 'Confirm', okStyle: 'background:var(--accent);color:#fff' }, opts);
  $('confirm-icon').textContent = o.icon;
  $('confirm-title').textContent = o.title;
  $('confirm-msg').textContent = o.msg;
  const btn = $('confirm-ok-btn');
  btn.textContent = o.okLabel;
  btn.style.cssText = o.okStyle;
  _confirmCallback = { onOk: o.onOk || null, onCancel: o.onCancel || null };
  document.getElementById('modal-confirm').classList.add('open');
}

function _confirmOk() {
  document.getElementById('modal-confirm').classList.remove('open');
  if (_confirmCallback && _confirmCallback.onOk) _confirmCallback.onOk();
  _confirmCallback = null;
}

function _confirmCancel() {
  document.getElementById('modal-confirm').classList.remove('open');
  if (_confirmCallback && _confirmCallback.onCancel) _confirmCallback.onCancel();
  _confirmCallback = null;
}

function showAlert(opts) {
  const o = Object.assign({ title: 'Notice', msg: '', icon: 'ℹ️' }, opts);
  $('alert-icon').textContent = o.icon;
  $('alert-title').textContent = o.title;
  $('alert-msg').textContent = o.msg;
  document.getElementById('modal-alert').classList.add('open');
}

// ── EMPTY STATE HTML HELPER ───────────────────────────────────────────────────
function emptyState(icon, title, desc, btnLabel, btnAction) {
  return '<div class="empty-state">'
    + '<div class="es-icon">' + icon + '</div>'
    + '<div class="es-title">' + title + '</div>'
    + '<div class="es-desc">' + desc + '</div>'
    + (btnLabel ? '<button class="es-btn" onclick="' + btnAction + '">' + btnLabel + '</button>' : '')
    + '</div>';
}

// ── FLASH ANIMATION ───────────────────────────────────────────────────────────
function flashBillCard(id, color) {
  setTimeout(() => {
    const card = document.querySelector('#bill-list .card[data-bill-id="' + id + '"]');
    if (!card) return;
    const col = color === 'green' ? 'rgba(34,197,94,.2)' : 'rgba(59,130,246,.2)';
    card.style.transition = 'background .1s';
    card.style.background = col;
    setTimeout(() => { card.style.background = ''; }, 600);
  }, 100);
}

// ── LAST SAVED UI ─────────────────────────────────────────────────────────────
function updateLastSavedUI() {
  const ts  = localStorage.getItem(SAVE_TS_KEY);
  const dot = $('ls-dot');
  const txt = $('ls-text');
  if (!dot || !txt) return;
  if (!ts) { txt.textContent = 'Not saved yet'; dot.style.background = 'var(--yellow)'; return; }
  dot.style.background = 'var(--green)';
  const saved    = new Date(parseInt(ts));
  const now      = new Date();
  const diffMins = Math.floor((now - saved) / 60000);
  const diffHrs  = Math.floor((now - saved) / 3600000);
  const diffDays = Math.floor((now - saved) / 86400000);
  let label = '';
  if (diffMins < 1)       label = 'Saved just now';
  else if (diffMins < 60) label = `Saved ${diffMins}m ago`;
  else if (diffHrs < 24)  label = `Saved ${diffHrs}h ago`;
  else                    label = `Saved ${diffDays}d ago`;
  txt.textContent = label;
  if (dot) dot.classList.toggle('stale', diffHrs >= 1);
}

// ── BACKUP REMINDER ───────────────────────────────────────────────────────────
function checkBackupReminder() {
  const badge = $('settings-badge');
  if (!badge) return;
  const hasData = data.income.length || data.expenses.length || data.bills.length || data.transactions.length;
  if (!hasData) { badge.style.display = 'none'; return; }
  const last = localStorage.getItem(BACKUP_KEY);
  if (!last) { badge.style.display = 'inline-block'; return; }
  const daysSince = Math.floor((Date.now() - parseInt(last)) / 86400000);
  badge.style.display = daysSince >= 7 ? 'inline-block' : 'none';
}

function markBackupDone() {
  localStorage.setItem(BACKUP_KEY, Date.now().toString());
  checkBackupReminder();
}

// ── THEME ─────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light')     root.setAttribute('data-theme', 'light');
  else if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }
}

function setTheme(theme) {
  appTheme = theme;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  updateThemeButtons();
}

function updateThemeButtons() {
  ['dark', 'light', 'auto'].forEach(t => {
    const btn = $('theme-' + t);
    if (!btn) return;
    btn.style.background = appTheme === t ? 'var(--accent)' : 'rgba(255,255,255,.06)';
    btn.style.color      = appTheme === t ? '#fff'          : 'var(--text)';
  });
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'auto';
  appTheme = saved;
  applyTheme(saved);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (appTheme === 'auto') applyTheme('auto');
  });
}

// ── URL / BILLER HELPERS ──────────────────────────────────────────────────────
const BILLER_URLS = {
  'chase':              'https://chase.com',
  'pnc':               'https://pnc.com',
  'bank of america':   'https://bankofamerica.com',
  'boa':               'https://bankofamerica.com',
  'wells fargo':       'https://wellsfargo.com',
  'capital one':       'https://capitalone.com',
  'citi':              'https://citi.com',
  'citibank':          'https://citi.com',
  'us bank':           'https://usbank.com',
  'usbank':            'https://usbank.com',
  'discover':          'https://discover.com',
  'amex':              'https://americanexpress.com',
  'american express':  'https://americanexpress.com',
  'synchrony':         'https://mysynchrony.com',
  'paypal':            'https://paypal.com',
  'venmo':             'https://venmo.com',
  'sofi':              'https://sofi.com',
  'ally':              'https://ally.com',
  'marcus':            'https://marcus.com',
  'sallie mae':        'https://salliemae.com',
  'navient':           'https://navient.com',
  'mohela':            'https://mohela.com',
  'nelnet':            'https://nelnet.com',
  'netflix':           'https://netflix.com',
  'hulu':              'https://hulu.com',
  'disney':            'https://disneyplus.com',
  'spotify':           'https://spotify.com',
  'apple':             'https://appleid.apple.com',
  'amazon':            'https://amazon.com',
  'google':            'https://myaccount.google.com',
  'youtube':           'https://youtube.com/premium',
  'microsoft':         'https://account.microsoft.com',
  'xbox':              'https://account.microsoft.com',
  'playstation':       'https://account.playstation.com',
  'comcast':           'https://xfinity.com',
  'xfinity':           'https://xfinity.com',
  'verizon':           'https://verizon.com',
  't-mobile':          'https://t-mobile.com',
  'tmobile':           'https://t-mobile.com',
  'att':               'https://att.com',
  'at&t':              'https://att.com',
  'pseg':              'https://pseg.com',
  'con edison':        'https://coned.com',
  'conedison':         'https://coned.com',
  'geico':             'https://geico.com',
  'progressive':       'https://progressive.com',
  'state farm':        'https://statefarm.com',
  'allstate':          'https://allstate.com',
};

function linkHost(url) {
  if (!url) return '';
  try { return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', ''); }
  catch { return url; }
}

function normUrl(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : 'https://' + url;
}

function suggestBillerUrl(query) {
  if (!query || query.length < 2) return null;
  const q = query.toLowerCase();
  for (const [k, v] of Object.entries(BILLER_URLS)) {
    if (q.includes(k) || k.includes(q)) return v;
  }
  return null;
}

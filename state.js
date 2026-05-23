// ── STATE.JS ─────────────────────────────────────────────────────────────────
// Single source of truth for persisted data and localStorage keys.
// All other modules read/write `data` directly (in-place mutation only).
// To replace the whole data object use Object.assign(data, newData) — never
// reassign `data =` from another module or the reference will break.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

// ── VERSION ──────────────────────────────────────────────────────────────────
const APP_VERSION = 'v2.2.0';

// ── STORAGE KEYS ─────────────────────────────────────────────────────────────
const STORAGE_KEY      = 'financeOS_v4';
const PIN_KEY          = 'financeOS_pin';
const LANG_KEY         = 'financeOS_lang';
const BACKUP_KEY       = 'financeOS_lastBackup';
const THEME_KEY        = 'financeOS_theme';
const SAVE_TS_KEY      = 'financeOS_lastSaved';
const ONBOARD_KEY      = 'financeOS_onboarded';
const BILL_RESET_KEY   = 'financeOS_billResetMonth';
const PWA_PROMPT_KEY   = 'financeOS_pwaPromptDismissed';
const NW_HISTORY_KEY   = 'financeOS_nwHistory';
const AUTO_LOG_KEY     = 'financeOS_autoLogMonth';

// ── DATA OBJECT ───────────────────────────────────────────────────────────────
// Always mutate in place. Never do `data = something` from another module.
let data = {
  income:       [],
  expenses:     [],
  bills:        [],
  cards:        [],
  transactions: [],
  assets:       [],
  targets:      [],
  accounts:     [],
};

// ── SAVE ─────────────────────────────────────────────────────────────────────
function saveData() {
  // Enrich latest transaction with pending promo data
  if (window._pendingPromo && data.transactions.length) {
    const last = data.transactions[data.transactions.length - 1];
    if (!last.promoType) Object.assign(last, window._pendingPromo);
    window._pendingPromo = null;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(SAVE_TS_KEY, Date.now().toString());
    haptic('light');
    showToast();
    updateLastSavedUI();
    checkBackupReminder();
  } catch (e) { console.warn(e); }
}

// ── LOAD ─────────────────────────────────────────────────────────────────────
function loadData() {
  // Load language preference
  const savedLang = localStorage.getItem(LANG_KEY);
  if (savedLang) {
    appLang = savedLang;
  } else {
    const bl = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    appLang = bl.startsWith('es') ? 'es' : 'en';
    localStorage.setItem(LANG_KEY, appLang);
  }

  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) Object.assign(data, JSON.parse(s));

    // Ensure all arrays exist
    if (!data.assets)            data.assets = [];
    if (!data.targets)           data.targets = [];
    if (!data.accounts)          data.accounts = [];
    if (!data._pendingTransfers) data._pendingTransfers = [];
    if (!data.goals)             data.goals = [];

    // Ensure reconciliation fields on accounts
    (data.accounts || []).forEach(a => { if (!a.lastReconciled) a.lastReconciled = null; });

    // Migrate revolvingBalance for existing cards
    data.bills.forEach(b => {
      if (b.btype === 'creditcard' || b.btype === 'loan' || b.btype === 'promo') migrateRevolvingBalance(b);
    });

    // Repair: advance recurring bills stuck on a past due date
    (data.bills || []).forEach(b => {
      if (!b.dueDate || b.recurring === 'One-time' || !b.recurring) return;
      if (b.status !== 'Paid' && b.status !== 'Pending' && b.status !== 'Scheduled') return;
      let guard = 0;
      while (daysUntil(b.dueDate) < 0 && guard++ < 24) {
        const dd = new Date(b.dueDate + 'T12:00:00');
        if      (b.recurring === 'Monthly')    dd.setMonth(dd.getMonth() + 1);
        else if (b.recurring === 'Weekly')     dd.setDate(dd.getDate() + 7);
        else if (b.recurring === 'Bi-weekly')  dd.setDate(dd.getDate() + 14);
        else if (b.recurring === 'Quarterly')  dd.setMonth(dd.getMonth() + 3);
        else if (b.recurring === 'Annually')   dd.setFullYear(dd.getFullYear() + 1);
        else break;
        b.dueDate = dd.toISOString().split('T')[0];
      }
      if (b.status === 'Paid' && daysUntil(b.dueDate) > 0) {
        b.status = b.autoLog ? 'Scheduled' : 'Pending';
        b.scheduledAmount = null;
        b.scheduledAccountId = null;
      }
    });

    // Auto-reset recurring bills on new month
    autoResetRecurringBills();
    // Auto-expire promo APRs when end date passes
    autoExpirePromos();
    // Auto-log recurring transactions
    runAutoLog();
    // Reset stale expense paid flags from previous months
    resetStaleExpensePaid();
    // Purge obsolete transaction types
    const obsolete = ['Extra Payment', 'Adjustment'];
    data.transactions = data.transactions.filter(t => !obsolete.includes(t.type));
    // Auto-clear stale income overrides from previous months
    const thisMonth = today().slice(0, 7);
    data.income.forEach(i => {
      if (i.actualMonth && i.actualMonth !== thisMonth) {
        i.actualAmount = null;
        i.actualMonth = null;
      }
    });
  } catch (e) { console.warn(e); }
}

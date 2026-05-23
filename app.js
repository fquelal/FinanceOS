// ── APP.JS ───────────────────────────────────────────────────────────────────
// Bootstrap, navigation, modals, event handlers, data mutations, renderAll.
// Depends on: state.js, utils.js, and all render_*.js files.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
// Constants and data object live in state.js
let currentTxnType='Withdrawal';
let debtMethod='avalanche';
let appLang='en';
let appTheme='auto';
let insightsTab='categories';
let txnFilter='All';
let billSort='date';
let txnSearch='';
let txnAllMonths=false;
let txnMonth='';
let pinBuffer='';

// $, usd, today, fmtDate, daysUntil, pct live in utils.js


// t(), applyTranslations(), setLanguage(), TRANSLATIONS live in utils.js

// ── SIDEBAR MOBILE ──────────────────────────────
function toggleSidebar(){
  $('sidebar').classList.toggle('open');
  $('overlay-bg').classList.toggle('show');
}
function closeSidebar(){
  $('sidebar').classList.remove('open');
  $('overlay-bg').classList.remove('show');
}

// ── PERSISTENCE ──────────────────────────────────
// saveData lives in state.js

// loadData lives in state.js
// Returns effective income - actual override if set this month, otherwise scheduled
function getIncomeOccurrences(income, yr, mo){
  // Returns [{date:'YYYY-MM-DD', amount:number}] for every occurrence in the given month
  const now = new Date();
  const targetYr = yr != null ? yr : now.getFullYear();
  const targetMo = mo != null ? mo : now.getMonth();
  const base = parseFloat((income.amount||0).toFixed(2));
  const monthStart = new Date(targetYr, targetMo, 1);
  const monthEnd   = new Date(targetYr, targetMo+1, 0);

  // Helper: resolve amount for a date (checks occurrenceOverrides)
  const resolveAmt = (dateStr) => {
    const ov = (income.occurrenceOverrides || {})[dateStr];
    return ov != null ? parseFloat(ov) : base;
  };

  if(income.frequency === 'Weekly'){
    const anchorStr = income.date || new Date().toISOString().split('T')[0];
    const anchor = new Date(anchorStr + 'T12:00:00');
    let d = new Date(anchor);
    // Walk to vicinity of month
    while(d > monthEnd)   d.setDate(d.getDate() - 7);
    while(d < monthStart) d.setDate(d.getDate() + 7);
    const dates = [];
    while(d <= monthEnd){
      const ds = d.toISOString().split('T')[0];
      if(d >= monthStart) dates.push({ date: ds, amount: resolveAmt(ds) });
      d = new Date(d);
      d.setDate(d.getDate() + 7);
    }
    return dates;
  }

  if(income.frequency === 'Bi-weekly'){
    // Use lastPayDate if set, otherwise fall back to income.date as anchor
    const anchorStr = income.lastPayDate || income.date;
    const tempIncome = Object.assign({}, income, { lastPayDate: anchorStr });
    const paycheckDates = getPaycheckDates(tempIncome, targetYr, targetMo) || [];
    return paycheckDates.map(d => {
      const ds = d.toISOString().split('T')[0];
      return { date: ds, amount: resolveAmt(ds) };
    });
  }

  // Monthly, One-time, Yearly — single entry using recorded date
  return [{ date: income.date || new Date().toISOString().split('T')[0], amount: base }];
}

function getEffectiveIncome(i, yr, mo){
  const now = new Date();
  const targetYr = yr != null ? yr : now.getFullYear();
  const targetMo = mo != null ? mo : now.getMonth();
  const targetMonthStr = targetYr+'-'+String(targetMo+1).padStart(2,'0');
  // Actual override takes highest priority
  if(i.actualAmount && i.actualMonth === targetMonthStr) return i.actualAmount;
  // Sum all occurrences in the month
  const occs = getIncomeOccurrences(i, targetYr, targetMo);
  return parseFloat(occs.reduce((s,o) => s + o.amount, 0).toFixed(2));
}
// haptic lives in utils.js

// showConfirm/showAlert/_confirmOk/_confirmCancel live in utils.js

// showToast lives in utils.js
function confirmReset(){
  showConfirm({
    icon:'🗑️', title:'Reset all data?',
    msg:'This will permanently erase everything. Cannot be undone.',
    okLabel:'Reset Everything', okStyle:'background:var(--red);color:#fff',
    onOk:()=>{
      data={income:[],expenses:[],bills:[],cards:[],transactions:[],goals:[],_pendingTransfers:[]};
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SAVE_TS_KEY);
      localStorage.removeItem(ONBOARD_KEY);
      localStorage.removeItem(NW_HISTORY_KEY);
      localStorage.removeItem(THEME_KEY);
      appTheme='auto';
      applyTheme('auto');
      updateThemeButtons();
      closeModal('settings');
      const si=$('txn-search');if(si)si.value='';
      txnAllMonths=false;_updateAllMonthsBtn();
      const sc=$('txn-clear');if(sc)sc.style.display='none';renderAll();updateLastSavedUI();showOnboarding();
      showToast('All data has been reset.');
    }
  });
}
function exportData(){
  try{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    const d=new Date();
    a.download=`financeos-backup-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('Backup downloaded!'));
    markBackupDone();
  }catch(e){showAlert({icon:'❌',title:'Export failed',msg:e.message});}
}
function importData(skipConfirm){
  const input=document.createElement('input');
  input.type='file';input.accept='.json';
  input.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
  input.onchange=e=>{
    document.body.removeChild(input);
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const parsed=JSON.parse(ev.target.result);
        // Validate structure
        if(typeof parsed!=='object'||Array.isArray(parsed)) throw new Error('Invalid file format');
        const valid={income:[],expenses:[],bills:[],cards:[],transactions:[]};
        Object.keys(valid).forEach(k=>{ if(Array.isArray(parsed[k])) valid[k]=parsed[k]; });
        // Carry over optional arrays
        ['assets','targets','accounts','goals','_pendingTransfers'].forEach(k=>{
          if(Array.isArray(parsed[k])) valid[k]=parsed[k];
        });
        const doImport=()=>{
          data=valid;
          saveData();
          document.getElementById('onboarding-overlay').classList.add('hidden');
          closeModal('settings');
          renderAll();
          showToast(t('Data imported!'));
        };
        if(skipConfirm){
          doImport();
        } else {
          showConfirm({
            icon:'⬆️', title:'Import backup?',
            msg:`This will replace your current data.\n\nFound: ${valid.income.length} income, ${valid.expenses.length} expenses, ${valid.bills.length} bills, ${valid.cards.length} cards, ${valid.transactions.length} transactions.`,
            okLabel:'Import', okStyle:'background:var(--accent);color:#fff',
            onOk: doImport
          });
        }
      }catch(err){showAlert({icon:'❌',title:'Import failed',msg:'Invalid backup file. '+err.message});}
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input);
  input.click();
}

function obImportBackup(){ importData(true); }

function loadDemoData(skipConfirm){
  const _run=()=>{
    const now=new Date();
  const dt=days=>{ const d=new Date(now); d.setDate(d.getDate()+days); return d.toISOString().split('T')[0]; };
  const ago=days=>dt(-days);
  const monthAgo=(m,day)=>{ const d=new Date(now); d.setMonth(d.getMonth()-m); d.setDate(day); return d.toISOString().split('T')[0]; };
  const nextMonth=(m,day)=>{ const d=new Date(now); d.setMonth(d.getMonth()+m); d.setDate(day); return d.toISOString().split('T')[0]; };

  data={
    // ── INCOME ─────────────────────────────────────────────────
    income:[
      // Bi-weekly salary — lastPayDate powers 2-or-3-paycheck calendar
      // First occurrence marked Received; second has an override (overtime)
      {id:1001, source:'Salary - Main Job', amount:1800, frequency:'Bi-weekly', date:ago(17), accountId:8001,
       lastPayDate:ago(17),
       occurrenceOverrides:{ [ago(17)]:1950 },
       incomeStatusOverrides:{ [ago(17)]:'Received' },
      },
      // Weekly side gig — shows 4 individual cards this month
      {id:1004, source:'Side Gig', amount:250, frequency:'Weekly', date:ago(22), accountId:8001,
       occurrenceOverrides:{}, incomeStatusOverrides:{ [ago(22)]:'Received', [ago(15)]:'Received' },
      },
      // Monthly freelance
      {id:1002, source:'Freelance', amount:600, frequency:'Monthly', date:ago(8), accountId:8001,
       occurrenceOverrides:{}, incomeStatusOverrides:{},
      },
      // One-time bonus
      {id:1003, source:'Tax Refund', amount:1100, frequency:'One-time', date:ago(15), accountId:8002,
       occurrenceOverrides:{}, incomeStatusOverrides:{},
      },
    ],

    // ── EXPENSES ───────────────────────────────────────────────
    expenses:[
      // auto-log → shows auto badge
      {id:2001, category:'Housing',       description:'Rent',                  amount:1450, frequency:'Monthly',  date:ago(1),  accountId:8001, autoLog:true, autoLogAccountId:8001},
      // paid this month → shows ✓ PAID badge
      {id:2002, category:'Utilities',     description:'Electric & gas',         amount:140,  frequency:'Monthly',  date:ago(4),  accountId:8001,
       paidMonth: new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')},
      {id:2003, category:'Food',          description:'Grocery budget',         amount:280,  frequency:'Monthly',  date:ago(3),  accountId:8001},
      {id:2004, category:'Subscriptions', description:'Netflix, Spotify',       amount:38,   frequency:'Monthly',  date:ago(6),  accountId:8001},
      {id:2005, category:'Healthcare',    description:'Health insurance copay', amount:95,   frequency:'Monthly',  date:ago(5),  accountId:8001},
      {id:2006, category:'Transport',     description:'Gas & tolls',            amount:120,  frequency:'Monthly',  date:ago(2),  accountId:8001},
    ],

    // ── BILLS ──────────────────────────────────────────────────
    bills:[
      // Pending — shows on 7-day timeline
      {id:3001, name:'Phone Bill',        amount:65,   dueDate:dt(3),           recurring:'Monthly', status:'Pending',   btype:'bill',       balance:0,    apr:0,     creditLimit:0,    scheduledAmount:null, scheduledAccountId:null, url:'https://verizon.com'},
      // Scheduled — blue badge
      {id:3002, name:'Internet',          amount:79,   dueDate:dt(5),           recurring:'Monthly', status:'Scheduled', btype:'bill',       balance:0,    apr:0,     creditLimit:0,    scheduledAmount:79,   scheduledAccountId:8001, url:'https://xfinity.com'},
      // Paid — checkmark
      {id:3003, name:'Car Insurance',     amount:187,  dueDate:ago(3),          recurring:'Monthly', status:'Paid',      btype:'bill',       balance:0,    apr:0,     creditLimit:0,    scheduledAmount:null, scheduledAccountId:null, url:'https://geico.com'},
      // Overdue — red alert
      {id:3004, name:'Gym Membership',    amount:45,   dueDate:ago(2),          recurring:'Monthly', status:'Overdue',   btype:'bill',       balance:0,    apr:0,     creditLimit:0,    scheduledAmount:null, scheduledAccountId:null},
      // Credit card — shows revolving + promo split, APR badge, utilization
      {id:3005, name:'Chase Sapphire',    amount:85,   dueDate:dt(4),           recurring:'Monthly', status:'Pending',   btype:'creditcard', balance:2801, apr:22.99, creditLimit:10000,scheduledAmount:null, scheduledAccountId:null, originalBalance:5800, revolvingBalance:2801, url:'https://chase.com'},
      // Loan with original amount → payoff progress bar in Debt Planner
      {id:3006, name:'Car Loan',          amount:340,  dueDate:dt(2),           recurring:'Monthly', status:'Pending',   btype:'loan',       balance:9800, apr:7.49,  creditLimit:0,    scheduledAmount:null, scheduledAccountId:null, originalBalance:14000, originalLoanAmount:14000, url:'https://pnc.com'},
      // Loan with same-day scheduled → processes immediately
      {id:3007, name:'Student Loan',      amount:210,  dueDate:today(),         recurring:'Monthly', status:'Scheduled', btype:'loan',       balance:18400,apr:5.75,  creditLimit:0,    scheduledAmount:210,  scheduledAccountId:8001, originalBalance:24000, originalLoanAmount:24000, url:'https://mohela.com'},
      // Next-month bills → month divider in calendar view
      {id:3008, name:'Rent',              amount:1450, dueDate:nextMonth(1,1),  recurring:'Monthly', status:'Pending',   btype:'bill',       balance:0,    apr:0,     creditLimit:0,    scheduledAmount:null, scheduledAccountId:null},
    ],

    // ── INACTIVE REMINDER CARD ─────────────────────────────────
    cards:[
      {id:4001, name:'Discover it', last4:'4823', reminderDays:90, nextReminder:ago(5), notes:'Keep open for credit age'},
    ],

    // ── TRANSACTIONS (3 months → anomaly detection + dual chart) ──
    transactions:[
      // ── 2 months ago (baseline) ──────────────────────────────
      {id:5001, description:'Whole Foods',        amount:90,  type:'Purchase',    date:monthAgo(2,8),  cardId:3005, accountId:0, category:'Food',          methodLabel:'Chase Sapphire'},
      {id:5002, description:'Shell Gas',          amount:48,  type:'Purchase',    date:monthAgo(2,12), cardId:3005, accountId:0, category:'Transport',     methodLabel:'Chase Sapphire'},
      {id:5003, description:'AMC Theaters',       amount:30,  type:'Purchase',    date:monthAgo(2,20), cardId:3005, accountId:0, category:'Entertainment', methodLabel:'Chase Sapphire'},
      {id:5004, description:'ATM',                amount:100, type:'Withdrawal',  date:monthAgo(2,15), accountId:8001, methodLabel:'Chase Checking'},
      // ── Last month (moderate) ────────────────────────────────
      {id:5005, description:'Trader Joes',        amount:110, type:'Purchase',    date:monthAgo(1,6),  cardId:3005, accountId:0, category:'Food',          methodLabel:'Chase Sapphire'},
      {id:5006, description:'Uber Eats',          amount:42,  type:'Purchase',    date:monthAgo(1,10), cardId:3005, accountId:0, category:'Dining',        methodLabel:'Chase Sapphire'},
      {id:5007, description:'Shell Gas',          amount:55,  type:'Purchase',    date:monthAgo(1,14), cardId:3005, accountId:0, category:'Transport',     methodLabel:'Chase Sapphire'},
      {id:5008, description:'ATM',                amount:80,  type:'Withdrawal',  date:monthAgo(1,5),  accountId:8001, methodLabel:'Chase Checking'},
      {id:5009, description:'Car Loan payment',   amount:340, type:'Debt Payment',date:monthAgo(1,20), accountId:8001, methodLabel:'Chase Checking'},
      {id:5010, description:'Phone Bill (auto)',  amount:65,  type:'Bill Payment', date:monthAgo(1,3), accountId:8001, methodLabel:'Chase Checking'},
      // ── This month (anomalies: Food +55%, Entertainment +100%) ─
      {id:5011, description:'Whole Foods',        amount:180, type:'Purchase',    date:ago(3),  cardId:3005, accountId:0, category:'Food',          methodLabel:'Chase Sapphire'},
      {id:5012, description:'Costco',             amount:155, type:'Purchase',    date:ago(2),  accountId:8001, category:'Food',          methodLabel:'Chase Checking'},
      {id:5013, description:'Concert tickets',    amount:220, type:'Purchase',    date:ago(7),  cardId:3005, accountId:0, category:'Entertainment', methodLabel:'Chase Sapphire', note:'Taylor Swift - Section 104'},
      {id:5014, description:'NJ Transit pass',    amount:89,  type:'Purchase',    date:ago(10), accountId:8001, category:'Transport',     methodLabel:'Chase Checking'},
      {id:5015, description:'CVS Pharmacy',       amount:35,  type:'Purchase',    date:ago(9),  cardId:3005, accountId:0, category:'Healthcare',    methodLabel:'Chase Sapphire', note:'Prescription refill'},
      // Account transfer → shows green tint + excluded from spending
      {id:5016, description:'Transfer → High-Yield Savings', amount:500, type:'Transfer', date:ago(5), accountId:8001, toAccountId:8002, methodLabel:'Chase Checking', note:'Monthly savings contribution'},
      // Promo purchases → showcase promo tracker on Chase Sapphire
      {id:5080, description:'iPhone 15 Pro',      amount:999, type:'Purchase',    date:monthAgo(1,5), cardId:3005, accountId:0, category:'Electronics', methodLabel:'Chase Sapphire',
        promoType:'installment', promoMonths:24, promoApr:0,
        promoEnd:(()=>{const d=new Date();d.setMonth(d.getMonth()+23);return d.toISOString().split('T')[0];})(),
        monthlyRequired:41.63},
      {id:5081, description:'Dyson Vacuum',       amount:450, type:'Purchase',    date:ago(45),       cardId:3005, accountId:0, category:'Shopping',    methodLabel:'Chase Sapphire',
        promoType:'deferred', promoMonths:6, promoApr:29.99,
        promoEnd:(()=>{const d=new Date();d.setDate(d.getDate()+(180-45));return d.toISOString().split('T')[0];})(),
        monthlyRequired:75},
    ],

    // ── ASSETS ─────────────────────────────────────────────────
    assets:[
      // Investments — no extra fields needed
      {id:6001, name:'Fidelity 401k',        category:'invest',   value:31000, notes:'Employer matched 6%', purchaseDate:null, originalValue:0, depreciationRate:0, linkedBillId:0},
      // Vehicle — shows depreciation estimate
      {id:6002, name:'Honda Civic 2021',      category:'vehicle',  value:18000, notes:'KBB estimate',
       purchaseDate:(()=>{const d=new Date();d.setFullYear(d.getFullYear()-3);return d.toISOString().split('T')[0];})(),
       originalValue:26000, depreciationRate:15, linkedBillId:0},
      // Property linked to Car Loan (id 3006) → shows equity panel
      {id:6003, name:'Jersey City Condo',     category:'property', value:320000, notes:'Zillow estimate',
       purchaseDate:(()=>{const d=new Date();d.setFullYear(d.getFullYear()-4);return d.toISOString().split('T')[0];})(),
       originalValue:275000, depreciationRate:0, linkedBillId:3006},
      {id:6004, name:'Robinhood Portfolio',   category:'invest',   value:5200,  notes:'Index funds', purchaseDate:null, originalValue:0, depreciationRate:0, linkedBillId:0},
    ],

    // ── BUDGET TARGETS ─────────────────────────────────────────
    targets:[
      {id:7001, type:'category', category:'Food',          amount:350},
      {id:7002, type:'category', category:'Entertainment', amount:120},
      {id:7003, type:'category', category:'Transport',     amount:200},
      {id:7004, type:'card',     cardId:3005,              amount:400},
    ],

    // ── SAVINGS GOALS ──────────────────────────────────────────
    goals:[
      {id:9001, name:'Emergency Fund', target:15000, date:nextMonth(6,1),  accountId:8002, saved:9200, notes:'6 months expenses', createdAt:monthAgo(4,1)},
      {id:9002, name:'Japan Trip',     target:4500,  date:nextMonth(12,1), accountId:0,    saved:900,  notes:'Flights + hotels + fun', createdAt:monthAgo(2,1)},
    ],

    // ── ACCOUNTS (with APY on savings) ─────────────────────────
    accounts:[
      {id:8001, name:'Chase Checking',      type:'checking', balance:5100, notes:'Primary',        isDefault:true,  apy:0,   url:'https://chase.com'},
      {id:8002, name:'Marcus Savings',      type:'savings',  balance:9200, notes:'Emergency fund', isDefault:false, apy:4.6, url:'https://marcus.com'},
      {id:8003, name:'Cash Wallet',         type:'cash',     balance:120,  notes:'',              isDefault:false, apy:0},
    ]
  };

  updateOriginalBalances();
  saveData();
  localStorage.setItem(SAVE_TS_KEY, Date.now().toString());

  // ── Seed Net Worth History (6 months for chart) ─────────────
  const nwHistory=[];
  const baseNW=308000;
  const monthlyGrowth=[2200, -800, 1500, 3100, -400, 2800];
  let runningNW=baseNW;
  for(let i=6;i>=1;i--){
    const d=new Date(now); d.setMonth(d.getMonth()-i);
    const mo=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    runningNW+=monthlyGrowth[6-i];
    nwHistory.push({month:mo, value:runningNW});
  }
  // Current month
  const currentMo=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  nwHistory.push({month:currentMo, value:runningNW+3200});
  localStorage.setItem('financeOS_nwHistory', JSON.stringify(nwHistory));

  // ── Reset bill reset key so demo starts fresh ───────────────
  localStorage.removeItem('financeOS_billResetMonth');

  // Reset UI state
  txnFilter='All';
  billSort='date';
  txnSearch='';
  txnAllMonths=false;
  txnMonth=today().slice(0,7);
  insightsTab='categories';
  closeModal('settings');
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  $('dashboard').classList.add('active');
  document.querySelector('[data-section=dashboard]').classList.add('active');
  const mob=$('mobile-brand'); if(mob) mob.innerHTML='<span>FinanceOS</span>';
  renderAll();
  showToast(t('Demo data loaded!'));
  }; // end _run
  if(skipConfirm){ _run(); } else {
    showConfirm({
      icon:'🎭', title:'Load demo data?',
      msg:'This will replace your current data with realistic sample data. Export a backup first if you have real data to keep.',
      okLabel:'Load Demo', okStyle:'background:#fb923c;color:#fff',
      onOk: _run
    });
  }
}

const acTypeIcon={checking:'🏦',savings:'💰',cash:'💵'};
const acTypeLabel={checking:'Checking',savings:'Savings',cash:'Cash'};

function populateAccountSelects(){
  const accs=data.accounts||[];
  const opts='<option value="">-- No account linked --</option>'+accs.map(a=>`<option value="${a.id}">${acTypeIcon[a.type]||''} ${a.name} (${usd(a.balance)})</option>`).join('');
  ['i-account','sb-account','pd-account','pu-account','t-account'].forEach(id=>{
    const el=$(id); if(!el) return;
    const prev=el.value;
    el.innerHTML=opts;
    if(prev) el.value=prev;
  });
}

function getDefaultAccountId(){
  const def=(data.accounts||[]).find(a=>a.isDefault);
  return def?def.id:((data.accounts||[])[0]?.id||0);
}

function getAccountBalance(id){
  const a=(data.accounts||[]).find(x=>x.id===parseInt(id));
  return a?a.balance:null;
}

function adjustAccountBalance(id,delta){
  if(!id) return;
  const a=(data.accounts||[]).find(x=>x.id===parseInt(id));
  if(a) a.balance=parseFloat((a.balance+delta).toFixed(2));
}

function toggleAcApyField(){
  const t=$('ac-type').value;
  const wrap=$('ac-apy-wrap');
  if(wrap) wrap.style.display=(t==='checking'||t==='savings')?'block':'none';
}

function openEditAccount(id){
  const a=(data.accounts||[]).find(x=>x.id===id);if(!a)return;
  $('account-modal-title').textContent='Edit Account';
  $('ac-id').value=a.id;$('ac-name').value=a.name;$('ac-type').value=a.type;
  $('ac-balance').value=a.balance;$('ac-notes').value=a.notes||'';
  $('ac-apy').value=a.apy||'';
  if($('ac-url'))$('ac-url').value=a.url||'';
  $('ac-default').checked=a.isDefault||false;
  toggleAcApyField();
  $('account-delete-wrap').style.display='block';
  $('modal-account').classList.add('open');
}

function saveAccount(){
  const name=$('ac-name').value.trim(),type=$('ac-type').value,bal=parseFloat($('ac-balance').value)||0,notes=$('ac-notes').value.trim();
  const apy=(type==='cash')?0:(parseFloat($('ac-apy').value)||0);
  const rawUrl=($('ac-url')&&$('ac-url').value.trim())||'';
  const acUrl=rawUrl?normUrl(rawUrl):'';
  if(!name)return;
  if(!data.accounts)data.accounts=[];
  const isDefault=$('ac-default').checked;
  const eid=parseInt($('ac-id').value);
  const item={id:eid||Date.now(),name,type,balance:bal,notes,isDefault,apy,url:acUrl||undefined};
  // If this is default, clear isDefault on all others
  if(isDefault) (data.accounts||[]).forEach(a=>{ if(a.id!==item.id) a.isDefault=false; });
  data.accounts=eid?data.accounts.map(a=>a.id===eid?item:a):[...data.accounts,item];
  $('ac-name').value='';$('ac-balance').value='';$('ac-notes').value='';$('ac-apy').value='';$('ac-id').value='';if($('ac-url'))$('ac-url').value='';
  $('account-delete-wrap').style.display='none';
  closeModal('account');saveData();renderSections('alerts','dashboard','bills','debt','networth','insights','txns');
}

function deleteAccountFromModal(){
  const id=parseInt($('ac-id').value);
  const a=(data.accounts||[]).find(x=>x.id===id);if(!a)return;
  closeModal('account');
  deleteItem('accounts',id);
}

// ── ACCOUNT TRANSFER ─────────────────────────────
function openTransferModal(){
  const accs=data.accounts||[];
  if(accs.length<2){showToast('Add at least 2 accounts to transfer between them.','error');return;}
  const opts=accs.map(a=>`<option value="${a.id}">${acTypeIcon[a.type]||'🏦'} ${a.name} (${usd(a.balance)})</option>`).join('');
  $('tr-from').innerHTML='<option value="">-- Select account --</option>'+opts;
  $('tr-to').innerHTML='<option value="">-- Select account --</option>'+opts;
  const defId=getDefaultAccountId();
  if(defId) $('tr-from').value=defId;
  $('tr-amount').value='';$('tr-date').value=today();$('tr-note').value='';
  $('tr-overdraft-warn').style.display='none';
  delete $('modal-transfer').dataset.editId;
  $('modal-transfer').classList.add('open');
  setTimeout(()=>$('tr-amount').focus(),260);
}

function checkTransferOverdraft(){
  const fromId=parseInt($('tr-from').value);
  const amt=parseFloat($('tr-amount').value)||0;
  const warn=$('tr-overdraft-warn');
  if(!fromId||!amt){warn.style.display='none';return;}
  const acc=(data.accounts||[]).find(a=>a.id===fromId);
  if(acc&&amt>acc.balance){
    warn.style.display='block';
    warn.textContent='Warning: this transfer of '+usd(amt)+' would overdraw '+acc.name+' by '+usd(amt-acc.balance)+'.';
  } else {warn.style.display='none';}
}

function saveTransfer(){
  const fromId=parseInt($('tr-from').value);
  const toId=parseInt($('tr-to').value);
  const amt=parseFloat($('tr-amount').value)||0;
  const dt=$('tr-date').value||today();
  const note=$('tr-note').value.trim();
  if(!fromId||!toId||!amt){showToast('Please fill in all required fields.','error');return;}
  if(fromId===toId){showToast('From and To accounts must be different.','error');return;}
  const fromAcc=(data.accounts||[]).find(a=>a.id===fromId);
  const toAcc=(data.accounts||[]).find(a=>a.id===toId);
  if(!fromAcc||!toAcc)return;

  // Edit mode — reverse the original transfer first
  const editId=$('modal-transfer').dataset.editId;
  if(editId){
    const orig=data.transactions.find(tx=>tx.id===parseInt(editId));
    if(orig){
      const origFrom=(data.accounts||[]).find(a=>a.id===orig.accountId);
      const origTo=(data.accounts||[]).find(a=>a.id===orig.toAccountId);
      if(origFrom) origFrom.balance=parseFloat((origFrom.balance+orig.amount).toFixed(2));
      if(origTo)   origTo.balance=parseFloat((origTo.balance-orig.amount).toFixed(2));
      data.transactions=data.transactions.filter(tx=>tx.id!==parseInt(editId));
    }
    delete $('modal-transfer').dataset.editId;
  }

  const _doTransfer=()=>{
    fromAcc.balance=parseFloat((fromAcc.balance-amt).toFixed(2));
    toAcc.balance=parseFloat((toAcc.balance+amt).toFixed(2));
    data.transactions.push({
      id:Date.now(),
      description:'Transfer → '+toAcc.name,
      amount:amt,
      type:'Transfer',
      date:dt,
      accountId:fromId,
      toAccountId:toId,
      methodLabel:fromAcc.name,
      note
    });
    closeModal('transfer');saveData();renderSections('dashboard','networth','txns');
    showToast(editId?'Transfer updated!':'Transfer saved!');
  };
  if(amt>fromAcc.balance){
    showConfirm({
      icon:'⚠️', title:'Overdraft warning',
      msg:'This transfer of '+usd(amt)+' would overdraw '+fromAcc.name+' by '+usd(amt-fromAcc.balance)+'. Continue anyway?',
      okLabel:'Continue', okStyle:'background:var(--yellow);color:#000',
      onOk:_doTransfer
    });
  } else { _doTransfer(); }
}

// ── NEW PURCHASE ──────────────────────────────────
function openPurchaseModal(){
  $('pu-desc').value='';$('pu-amount').value='';$('pu-date').value=today();
  $('pu-category').value='';
  if($('pu-note'))$('pu-note').value='';
  if($('pu-edit-id')) $('pu-edit-id').value='';
  if($('pu-modal-title')) $('pu-modal-title').textContent='🛒 New Purchase';
  $('pu-method').value='';
  $('pu-overdraft-warn').style.display='none';
  // Populate unified payment method dropdown
  const accs=data.accounts||[];
  const cards=data.bills.filter(b=>b.btype==='creditcard');
  $('pu-accounts-group').innerHTML=accs.map(a=>
    `<option value="acc-${a.id}">${acTypeIcon[a.type]||''} ${a.name} (${usd(a.balance)})</option>`
  ).join('');
  $('pu-cards-group').innerHTML=cards.map(c=>
    `<option value="card-${c.id}">💳 ${c.name} (Balance: ${usd(c.balance)})</option>`
  ).join('');
  // Default to primary account for new purchases
  const defAcId=getDefaultAccountId();
  if(defAcId) $('pu-method').value='acc-'+defAcId;
  // Reset promo fields
  const check=$('pu-promo-check'); if(check) check.checked=false;
  const fields=$('pu-promo-fields'); if(fields) fields.style.display='none';
  const calc=$('pu-promo-calc'); if(calc) calc.style.display='none';
  _promoType='deferred';
  if(typeof setPromoType==='function') setPromoType('deferred');
  const months=$('pu-promo-months'); if(months) months.value='6';
  const apr=$('pu-promo-apr'); if(apr) apr.value='';
  $('modal-purchase').classList.add('open');
  setTimeout(()=>$('pu-desc').focus(),260);
}

function openEditPurchase(id){
  const tx=data.transactions.find(x=>x.id===id);if(!tx)return;
  // Reuse openPurchaseModal to populate dropdowns, then override fields
  openPurchaseModal();
  if($('pu-edit-id')) $('pu-edit-id').value=tx.id;
  if($('pu-modal-title')) $('pu-modal-title').textContent='✏️ Edit Purchase';
  $('pu-desc').value=tx.description||'';
  $('pu-amount').value=tx.amount||'';
  $('pu-date').value=tx.date||today();
  $('pu-category').value=tx.category||'';
  if($('pu-note')) $('pu-note').value=tx.note||'';
  // Restore payment method — card-{id} or acc-{id}
  if(tx.cardId) $('pu-method').value='card-'+tx.cardId;
  else if(tx.accountId) $('pu-method').value='acc-'+tx.accountId;
  else $('pu-method').value='';
  // Restore tags
  _puTags=tx.tags?[...tx.tags]:[];
  // Hide promo section — editing promo details not supported
  const fields=$('pu-promo-fields'); if(fields) fields.style.display='none';
  const check=$('pu-promo-check'); if(check) check.checked=false;
}

function checkPurchaseOverdraft(){
  const method=$('pu-method').value;
  const amt=parseFloat($('pu-amount').value)||0;
  const warn=$('pu-overdraft-warn');
  if(!method||!amt||!method.startsWith('acc-')){warn.style.display='none';return;}
  const acId=parseInt(method.replace('acc-',''));
  const bal=getAccountBalance(acId);
  if(bal!==null&&amt>bal){
    warn.style.display='block';
    warn.textContent='Warning: this purchase of '+usd(amt)+' would overdraw this account by '+usd(amt-bal)+'.';
  } else { warn.style.display='none'; }
}

function confirmPurchase(){
  const desc=$('pu-desc').value.trim(),amt=parseFloat($('pu-amount').value),dt=$('pu-date').value||today();
  const method=$('pu-method').value;
  const category=$('pu-category').value||'';
  if(!desc||!amt)return;
  if(!method){showToast(t('Please select a payment method'),'error');return;}

  // ── Edit mode: reverse the old transaction's balance effects ──
  const editId=parseInt($('pu-edit-id')?.value)||0;
  if(editId){
    const prev=data.transactions.find(x=>x.id===editId);
    if(prev){
      if(prev.cardId){
        const oldCard=data.bills.find(b=>b.id===prev.cardId);
        if(oldCard){
          oldCard.balance=parseFloat(Math.max(0,oldCard.balance-prev.amount).toFixed(2));
          if(oldCard.revolvingBalance!=null)
            oldCard.revolvingBalance=parseFloat(Math.max(0,(oldCard.revolvingBalance||0)-prev.amount).toFixed(2));
        }
      } else if(prev.accountId){
        adjustAccountBalance(prev.accountId,prev.amount); // restore debited amount
      }
    }
  }

  // ── Promo check ───────────────────────────────────────────
  const promoCheck=$('pu-promo-check');
  const isPromo=promoCheck&&promoCheck.checked;
  if(isPromo){
    const months=parseInt($('pu-promo-months').value)||0;
    const apr=parseFloat($('pu-promo-apr').value)||0;
    if(!months){showToast('Enter promo months','error');return;}
    if(_promoType==='deferred'&&!method.startsWith('card-')){
      showToast('Deferred interest requires a credit card','error');return;
    }
    const endDate=new Date();endDate.setMonth(endDate.getMonth()+months);
    window._pendingPromo={
      promoType:_promoType,
      promoMonths:months,
      promoApr:_promoType==='deferred'?apr:0,
      promoEnd:endDate.toISOString().split('T')[0],
      monthlyRequired:parseFloat((amt/months).toFixed(2))
    };
  } else {
    window._pendingPromo=null;
  }

  let cardId=0,acId=0,methodLabel='';
  if(method.startsWith('card-')){
    cardId=parseInt(method.replace('card-',''));
    const card=data.bills.find(b=>b.id===cardId);
    if(card){
      methodLabel=card.name;
      card.balance=parseFloat((card.balance+amt).toFixed(2));
      if(!(window._pendingPromo&&window._pendingPromo.promoType)){
        migrateRevolvingBalance(card);
        card.revolvingBalance=parseFloat(((card.revolvingBalance||0)+amt).toFixed(2));
      }
      if(card.status==='Paid') card.status='Pending';
    }
  } else if(method.startsWith('acc-')){
    acId=parseInt(method.replace('acc-',''));
    const acc=(data.accounts||[]).find(a=>a.id===acId);
    if(acc){
      methodLabel=acc.name;
      const _finishPurchase=()=>{
        adjustAccountBalance(acId,-amt);
        const puNote=$('pu-note')?$('pu-note').value.trim():'';
        const tx={
          id:editId||Date.now(),description:desc,amount:amt,type:'Purchase',
          date:dt,accountId:acId,cardId,category,methodLabel,note:puNote,tags:[..._puTags]
        };
        if(window._pendingPromo){
          Object.assign(tx,{
            promoType:window._pendingPromo.promoType,
            promoMonths:window._pendingPromo.promoMonths,
            promoApr:window._pendingPromo.promoApr,
            promoEnd:window._pendingPromo.promoEnd,
            monthlyRequired:window._pendingPromo.monthlyRequired
          });
          window._pendingPromo=null;
        }
        if(editId) data.transactions=data.transactions.map(x=>x.id===editId?tx:x);
        else data.transactions.push(tx);
        resetInactiveCardForPurchase(cardId);
        closeModal('purchase');saveData();renderSections('dashboard','txns','insights','cards');
        showToast(editId?'Purchase updated!':t('Purchase logged!'));
      };
      if(amt>acc.balance){
        showConfirm({
          icon:'⚠️', title:'Overdraft warning',
          msg:'This purchase of '+usd(amt)+' would overdraw '+acc.name+' by '+usd(amt-acc.balance)+'. Continue anyway?',
          okLabel:'Continue', okStyle:'background:var(--yellow);color:#000',
          onOk:_finishPurchase
        });
      } else { _finishPurchase(); }
      return;
    }
  }

  const puNote=$('pu-note')?$('pu-note').value.trim():'';
  const tx={
    id:editId||Date.now(),description:desc,amount:amt,type:'Purchase',
    date:dt,accountId:acId,cardId,category,methodLabel,note:puNote,tags:[..._puTags]
  };
  if(window._pendingPromo){
    Object.assign(tx,{
      promoType:window._pendingPromo.promoType,
      promoMonths:window._pendingPromo.promoMonths,
      promoApr:window._pendingPromo.promoApr,
      promoEnd:window._pendingPromo.promoEnd,
      monthlyRequired:window._pendingPromo.monthlyRequired
    });
    window._pendingPromo=null;
  }
  if(editId) data.transactions=data.transactions.map(x=>x.id===editId?tx:x);
  else data.transactions.push(tx);
  resetInactiveCardForPurchase(cardId);
// renderNetWorth lives in render_accounts.js

  const card=$('debt-info-card');
  if(card) card.style.display='none';
}

function renderDebt(){
  // Show info card until dismissed
  const card=$('debt-info-card');
  if(card) card.style.display=localStorage.getItem('financeOS_debtInfoDismissed')?'none':'block';

  const debts=data.bills.filter(b=>(b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo')&&b.balance>0&&(b.apr>=0));
  if(!debts.length){
    $('debt-no-data').style.display='block';
    $('debt-planner-content').style.display='none';
    return;
  }
  $('debt-no-data').style.display='none';
  $('debt-planner-content').style.display='block';
  renderDebtProgress();
  renderDebtCountdown();
  // Reset simulator to unselected state if inputs hidden
  const simInputs=$('promo-sim-inputs');
  if(simInputs&&simInputs.style.display==='none'){
    document.querySelectorAll('.promo-tab').forEach(b=>b.classList.remove('active'));
  }

  const desc={
    avalanche:'Sorted by highest APR first - focus payments on most expensive debt to minimize total interest paid.',
    snowball:'Sorted by lowest balance first - knock out small debts quickly to build momentum and free up cash.'
  };
  $('method-desc').textContent=desc[debtMethod];

  // ── CASH FLOW CALCULATION ─────────────────────
  const totalIncome   = data.income.reduce((s,i)=>s+getEffectiveIncome(i,new Date().getFullYear(),new Date().getMonth()),0);
  const totalExpenses = data.expenses.reduce((s,e)=>s+e.amount,0);
  const totalBillsPmt = data.bills.filter(b=>b.btype==='bill').reduce((s,b)=>s+b.amount,0);
  const totalDebtMins = debts.reduce((s,d)=>s+Math.max(d.scheduledAmount||0,d.amount||0),0);
  const manualExtra = 0;

  // Available = income - expenses - non-debt bills - debt minimums + manual extra
  const afterExpenses  = totalIncome - totalExpenses;
  const afterBills     = afterExpenses - totalBillsPmt;
  const afterMins      = afterBills - totalDebtMins;
  const availableExtra = Math.max(0, afterMins) + manualExtra;
  // Total monthly pool = minimums + available extra
  const totalPool      = totalDebtMins + availableExtra;

  // ── RENDER CASH BREAKDOWN ────────────────────
  const cfRows=[
    {label:'Total Income (all sources)', value:totalIncome, color:'var(--teal)', sign:'+'},
    {label:'Living Expenses', value:totalExpenses, color:'var(--red)', sign:'-'},
    {label:'Regular Bills', value:totalBillsPmt, color:'var(--yellow)', sign:'-'},
    {label:'Debt Payments (scheduled where set)', value:totalDebtMins, color:'var(--muted)', sign:'-'},
  ];
  if($('cash-flow-rows')){
    $('cash-flow-rows').innerHTML=cfRows.map(r=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:13px;color:var(--muted)">${r.sign === '+' ? '' : ''}${r.label}</span>
        <span style="font-size:13px;font-weight:600;color:${r.color}">${r.sign === '-' ? '-' : '+'}${usd(r.value)}</span>
      </div>`).join('');
    if($('cash-available')){
      $('cash-available').textContent=usd(availableExtra);
      $('cash-available').style.color=availableExtra>0?'var(--green)':'var(--red)';
    }
  }

  // ── WARN IF INCOME CANT COVER MINIMUMS ───────
  if(afterBills<totalDebtMins && $('cash-flow-rows')){
    const shortfall=totalDebtMins-Math.max(0,afterBills);
    $('cash-flow-rows').innerHTML+=`
      <div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:8px 12px;margin-top:8px;font-size:12px;color:var(--red)">
        ⚠️ Income is ${usd(shortfall)} short of covering all minimums. Consider reducing expenses or increasing income.
      </div>`;
  }

  const extra=availableExtra;
  const plan=calcDebtPlan(debts,extra);
  const totalDebt=debts.reduce((s,d)=>s+d.balance,0);
  const yrs=Math.floor(plan.months/12),mos=plan.months%12;

  // Summary boxes
  // Compare methods to show interest saved vs opposite method
  const altMethod = debtMethod==='avalanche'?'snowball':'avalanche';
  const origMethod = debtMethod;
  debtMethod = altMethod;
  const altPlan = calcDebtPlan(debts, extra);
  debtMethod = origMethod;
  const interestSaved = Math.max(0, altPlan.totalInterestPaid - plan.totalInterestPaid);
  const timeStr2 = plan.months>=600?'500+ months':(yrs>0?`${yrs}y ${mos}m`:`${mos} months`);

  $('debt-summary').innerHTML=`
    <div class="summary-box"><div class="stat-label">Total Debt</div><div class="stat-value" style="color:var(--red);font-size:18px">${usd(totalDebt)}</div></div>
    <div class="summary-box"><div class="stat-label">Payoff Time</div><div class="stat-value" style="color:var(--accent2);font-size:18px">${timeStr2}</div></div>
    <div class="summary-box"><div class="stat-label">Total Interest</div><div class="stat-value" style="color:var(--yellow);font-size:18px">${usd(plan.totalInterestPaid)}</div></div>
    <div class="summary-box"><div class="stat-label">Monthly Pool</div><div class="stat-value" style="color:var(--green);font-size:18px">${usd(totalPool)}</div></div>
    ${interestSaved>0?`<div class="summary-box" style="grid-column:1/-1;background:rgba(34,197,94,.07);border-color:rgba(34,197,94,.2)"><div class="stat-label" class="txt-green">vs ${altMethod.charAt(0).toUpperCase()+altMethod.slice(1)} method</div><div style="font-size:14px;font-weight:700;color:var(--green)">Save ${usd(interestSaved)} in interest with ${debtMethod}</div></div>`:''}
    `;

  // Debt cards
  const rankColors=['#22c55e','#5070f0','#f59e0b','#ef4444','#06b6d4','#8b5cf6'];
  const focusLabel=debtMethod==='avalanche'
    ? (d,idx)=>idx===0?`<span style="font-size:10px;font-weight:700;color:#22c55e;margin-left:6px">HIGHEST APR</span>`:''
    : (d,idx)=>idx===0?`<span style="font-size:10px;font-weight:700;color:#22c55e;margin-left:6px">LOWEST BALANCE</span>`:'';
  $('debt-list').innerHTML=plan.items.map((d,idx)=>{
    const rc=rankColors[idx%rankColors.length];
    const schedId='sched-'+d.id;
    const lastPaid=d.sched.findIndex(s=>s.balance<0.01);
    const payoffMonth=lastPaid>=0?lastPaid+1:d.sched.length;
    const py=Math.floor(payoffMonth/12),pm=payoffMonth%12;
    const payoffStr=py>0?`${py}y ${pm}m`:`${pm} months`;
    const totalInt=d.sched.reduce((s,r)=>s+r.interest,0);

    // Schedule table (first 24 months max)
    const showRows=d.sched.slice(0,24);
    const tableRows=showRows.map(r=>`
      <tr>
        <td>${r.month}</td>
        <td>${usd(r.payment)}</td>
        <td class="txt-red">${usd(r.interest)}</td>
        <td>${usd(r.balance)}</td>
      </tr>`).join('');

    const promoBadgeHtml=getPromoBadgeHtml(d);
    // Per-loan progress bar (only for loans with a user-set original amount)
    const loanOriginal = d.btype==='loan' ? (d.originalLoanAmount || (d.originalBalance > d.balance ? d.originalBalance : 0)) : 0;
    const loanProgressHtml = (d.btype==='loan' && loanOriginal>0) ? (()=>{
      const paid = loanOriginal - d.balance;
      const pct  = Math.min(100, Math.max(0, Math.round(paid / loanOriginal * 100)));
      return `<div style="margin-top:10px;padding:10px 12px;background:rgba(255,255,255,.04);border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Payoff Progress</span>
          <span style="font-size:12px;font-weight:700;color:var(--green)">${pct}% paid off</span>
        </div>
        <div style="background:var(--border);border-radius:4px;height:7px;overflow:hidden">
          <div style="height:7px;border-radius:4px;width:${pct}%;background:var(--green);transition:width .4s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:5px">
          <span class="txt-muted-sm">Paid: <strong style="color:var(--text)">${usd(paid)}</strong></span>
          <span class="txt-muted-sm">Original: <strong style="color:var(--text)">${usd(loanOriginal)}</strong></span>
        </div>
      </div>`;
    })() : '';
    return`<div class="debt-card"${d.btype==='promo'?' style="border-color:rgba(34,197,94,.3)"':''}>
      <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div class="debt-rank" style="background:${rc}22;color:${rc}">${idx+1}</div>
        <div style="flex:1;min-width:160px">
          <div style="font-size:15px;font-weight:700;margin-bottom:4px">${d.name}${focusLabel(d,idx)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
            <span class="apr-badge"${d.btype==='promo'?' style="background:rgba(34,197,94,.15);color:var(--green)"':''}>APR ${pct(d.apr)}</span>
            ${promoBadgeHtml}
            ${getPromoSortNote(d)}
            <span class="txt-muted-xs">${d.scheduledAmount&&d.scheduledAmount!==d.amount?'Scheduled: '+usd(d.scheduledAmount)+' · Min: '+usd(d.amount)+'/mo':'Min: '+usd(d.amount)+'/mo'}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">
            <div class="surface-chip">
              <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:3px">Balance</div>
              <div style="font-size:15px;font-weight:700;color:var(--red)">${usd(d.balance)}</div>
            </div>
            <div class="surface-chip">
              <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:3px">Payoff</div>
              <div style="font-size:15px;font-weight:700;color:var(--green)">${payoffStr}</div>
            </div>
            <div class="surface-chip">
              <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:3px">Total Interest</div>
              <div style="font-size:15px;font-weight:700;color:var(--yellow)">${usd(totalInt)}</div>
            </div>
          </div>
        </div>
      </div>
      ${loanProgressHtml}
      <button class="expand-btn" onclick="toggleSchedule('${schedId}')">▼ Show payment schedule</button>
      <div id="${schedId}" style="display:none;overflow-x:auto">
        <table class="schedule-table">
          <thead><tr><th>Month</th><th>Payment</th><th>Interest</th><th>Balance</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        ${d.sched.length>24?`<div style="font-size:11px;color:var(--muted);padding:8px 0">Showing first 24 months of ${d.sched.length}</div>`:''}
      </div>
    </div>`;
  }).join('');
}

// ── RENDERS ──────────────────────────────────────
function buildAlerts(){
  const now=new Date();
  const alerts=[];

  // ── BILLS: overdue + due within 7 days ──────────────────────
  data.bills.forEach(b=>{
    const d=daysUntil(b.dueDate);
    const isZeroBalance=(b.btype==='creditcard'||b.btype==='loan')&&!b.balance&&!b.amount;
    if(isZeroBalance) return;
    if(b.status!=='Paid'&&b.status!=='Scheduled'&&d<0){
      alerts.push({
        section:'bills', color:'#ef4444', icon:'📋',
        msg:`${b.name} is overdue by ${Math.abs(d)} day${Math.abs(d)===1?'':'s'}`,
      });
    } else if(b.status!=='Paid'&&b.status!=='Scheduled'&&d<=7&&d>=0){
      alerts.push({
        section:'bills', color:'#f59e0b', icon:'📋',
        msg:`${b.name} due in ${d===0?'today':(d+' day'+(d===1?'':'s'))} - ${usd(b.amount)}`,
      });
    }
  });

  // ── CARDS: inactive 90+ days ─────────────────────────────────
  data.bills.filter(b=>b.btype==='creditcard'&&(!b.balance||b.balance<=0)).forEach(b=>{
    const last=getLastPurchaseDate(b.id,null);
    const days=last?-daysUntil(last):null;
    if(days===null||days>=90){
      alerts.push({
        section:'cards', color:'#7090f5', icon:'💳',
        msg:`${b.name} - no purchases in ${days===null?'90+':days} days. Use it to keep it active.`,
      });
    }
  });
  data.cards.forEach(c=>{
    if(cardIsInactive(c)){
      alerts.push({
        section:'cards', color:'#7090f5', icon:'💳',
        msg:`${c.name} - no purchases in 90+ days. Use it to keep it active.`,
      });
    }
  });

  // ── PROMO: expiry warnings ─────────────────────────────────
  // ── PROMO PURCHASES: per-transaction expiry warnings ───────────
  data.transactions.filter(tx=>tx.promoType&&tx.promoEnd&&tx.amount>0).forEach(tx=>{
    const daysLeft=Math.round((new Date(tx.promoEnd)-now)/86400000);
    const paid=data.transactions.filter(t=>t.promoRef===tx.id).reduce((s,t)=>s+t.amount,0);
    const remaining=Math.max(0,tx.amount-paid);
    if(remaining<=0) return; // fully paid
    if(daysLeft<0){
      alerts.push({section:'bills',color:'#ef4444',icon:'🚨',
        msg:`${tx.description} promo EXPIRED - ${usd(remaining)} unpaid${tx.promoType==='deferred'?' (deferred interest may apply)':''}`});
    } else if(daysLeft<=7){
      alerts.push({section:'bills',color:'#ef4444',icon:'🚨',
        msg:`${tx.description} promo expires in ${daysLeft}d - ${usd(remaining)} still due`});
    } else if(daysLeft<=30){
      alerts.push({section:'bills',color:'#f59e0b',icon:'⚠️',
        msg:`${tx.description} promo expires in ${daysLeft}d - ${usd(remaining)} remaining`});
    }
  });

  data.bills.filter(b=>b.promoEndDate&&b.regularApr!=null&&b.balance>0).forEach(b=>{
    const daysLeft=Math.round((new Date(b.promoEndDate)-now)/86400000);
    if(daysLeft<0){
      alerts.push({section:'debt',color:'#ef4444',icon:'🚨',
        msg:`${b.name} promo EXPIRED - now at ${b.regularApr||0}% APR`});
    } else if(daysLeft<=7){
      alerts.push({section:'debt',color:'#ef4444',icon:'🚨',
        msg:`${b.name} promo expires in ${daysLeft} day${daysLeft===1?'':'s'} - ${usd(b.balance)} remaining`});
    } else if(daysLeft<=30){
      alerts.push({section:'debt',color:'#f59e0b',icon:'⚠️',
        msg:`${b.name} promo expires in ${daysLeft} days - pay ${usd(Math.ceil(b.balance/(Math.ceil(daysLeft/30))))} /mo to clear it`});
    }
  });

  // ── INSIGHTS: budget targets ≥ 80% ───────────────────────────
  (data.targets||[]).forEach(tg=>{
    let spent=0, label='';
    if(tg.type==='card'){
      const card=data.bills.find(b=>b.id===tg.cardId);
      label=card?card.name:'Card';
      spent=data.transactions.filter(tr=>{
        if(tr.cardId!==tg.cardId||!tr.date)return false;
        const d=new Date(tr.date);
        return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
      }).reduce((s,tr)=>s+tr.amount,0);
    } else {
      label=tg.category;
      const expSpent=data.expenses.filter(e=>{
        if(e.category!==tg.category||!e.date)return false;
        const d=new Date(e.date);
        return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
      }).reduce((s,e)=>s+e.amount,0);
      const txnSpent=data.transactions.filter(tr=>{
        if(tr.type!=='Purchase'||tr.category!==tg.category||!tr.date)return false;
        const d=new Date(tr.date);
        return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
      }).reduce((s,tr)=>s+tr.amount,0);
      spent=expSpent+txnSpent;
    }
    if(tg.amount>0){
      const pct=Math.round(spent/tg.amount*100);
      if(pct>=100){
        alerts.push({
          section:'insights', color:'#ef4444', icon:'📈',
          msg:`${label} - over budget by ${usd(spent-tg.amount)} (${pct}% used)`,
        });
      } else if(pct>=80){
        alerts.push({
          section:'insights', color:'#f59e0b', icon:'📈',
          msg:`${label} - ${pct}% of ${usd(tg.amount)} budget used this month`,
        });
      }
    }
  });

  return alerts;
}

function renderAlerts(){
  const alerts=buildAlerts();
  const navTarget={
    bills:"show('bills',document.querySelector('[data-section=bills]'))",
    cards:"show('cards',document.querySelector('[data-section=cards]'))",
    insights:"show('insights',document.querySelector('[data-section=insights]'))",
  };

  // ── Per-section: only relevant alerts ────────────────────────
  ['cards','insights','debt','networth','quick'].forEach(sec=>{
    const el=$(sec+'-alerts');
    if(!el) return;
    const relevant=alerts.filter(a=>a.section===sec);
    el.innerHTML=relevant.map(a=>`
      <div class="alert" style="background:${a.color}18;border:1px solid ${a.color}44;color:${a.color}">
        ${a.icon} ${a.msg}
      </div>`).join('');
  });
}

// renderDashboard + toggleDashAccounts live in render_dashboard.js

// renderMoneySummaryCards lives in render_bills.js

// renderBills lives in render_bills.js

// renderBillsManage lives in render_bills.js

function quickUpdateCardBalance(id){
  const b=data.bills.find(x=>x.id===id);
  if(!b) return;
  const val=prompt('Enter new balance for '+b.name+':',b.balance||'');
  if(val===null) return;
  const parsed=parseFloat(val);
  if(isNaN(parsed)||parsed<0){ showToast('Invalid balance','error'); return; }
  b.balance=parseFloat(parsed.toFixed(2));
  if(!b.originalBalance||b.balance>b.originalBalance) b.originalBalance=b.balance;
// renderCards lives in render_accounts.js

// renderLoans lives in render_accounts.js

// renderTxns lives in render_transactions.js

// renderInsights lives in render_insights.js

// renderSnapshot lives in render_insights.js

// renderDebtProgress lives in render_insights.js

// renderProjection lives in render_insights.js

// renderAnomalies lives in render_insights.js

// renderDebtCountdown lives in render_insights.js

// renderPromoItems lives in render_insights.js

// renderGoals lives in render_accounts.js

// renderSpendingTrends lives in render_insights.js

// renderTagFilterStrip lives in render_transactions.js


  return notifs;
}

function renderNotificationCenter(){
  const notifs=buildNotifications();
  const pill=$('notif-pill');
  if(!pill) return;

  const urgentCount=notifs.filter(n=>n.group==='urgent').length;
  const total=notifs.length;

  pill.style.display='inline-flex';

  if(total===0){
    pill.className='nc-clear';
    pill.textContent='✓ All clear';
    pill.onclick=null;
    pill.style.cursor='default';
    const badge=$('mobile-bell-badge');if(badge) badge.style.display='none';
    return;
  }

  pill.onclick=openNotifDrawer;
  pill.style.cursor='pointer';
  if(urgentCount>0){
    pill.className='nc-urgent';
  } else {
    pill.className='nc-warn';
  }
  pill.textContent='🔔 '+total+' alert'+(total===1?'':'s');
  // Sync mobile bell badge
  const badge=$('mobile-bell-badge');
  if(badge) badge.style.display=total>0?'block':'none';
}

function openNotifDrawer(){
  const notifs=buildNotifications();
  const content=$('notif-drawer-content');
  const dismissAll=$('notif-dismiss-all');
  if(!content) return;

  // Show/hide dismiss all based on whether any are dismissable
  const hasDismissable=notifs.some(n=>n.dismissable);
  if(dismissAll) dismissAll.style.display=hasDismissable?'inline-flex':'none';

  if(!notifs.length){
    content.innerHTML=`<div class="nc-empty">
      <div class="nc-empty-icon">🎉</div>
      <div class="nc-empty-title">You're all caught up!</div>
      <div class="nc-empty-sub">No alerts or notifications right now.</div>
    </div>`;
    $('notif-drawer-overlay').classList.add('open');
    return;
  }

  const groups=[
    {key:'urgent', label:'🚨 Action Required', color:'#ef4444'},
    {key:'warning', label:'⚠️ Coming Up', color:'#f59e0b'},
    {key:'info', label:'ℹ️ Info', color:'var(--muted)'},
  ];

  let html='';
  groups.forEach(g=>{
    const items=notifs.filter(n=>n.group===g.key);
    if(!items.length) return;
    html+=`<div class="nc-group-header" style="color:${g.color}">${g.label}</div>`;
    items.forEach(item=>{
      const bg=item.color.startsWith('#')?item.color+'18':item.color.replace('var(','').replace(')','');
      const border=item.color.startsWith('#')?item.color+'44':item.color;
      html+=`<div class="nc-item" style="background:${item.color.startsWith('#')?item.color+'12':'rgba(255,255,255,.04)'};border-color:${item.color.startsWith('#')?item.color+'33':item.color};"
        onclick="${item.action?item.action+';closeNotifDrawer()':''}">
        <div class="nc-item-icon">${item.icon}</div>
        <div class="nc-item-body">
          <div class="nc-item-msg">${item.msg}</div>
          ${item.sub?`<div class="nc-item-sub">${item.sub}</div>`:''}
        </div>
        <div class="nc-item-actions">
          ${item.action?`<div class="nc-chevron">›</div>`:''}
          ${item.dismissable?`<button class="nc-dismiss" onclick="event.stopPropagation();${item.dismissFn};closeNotifDrawer()" title="Dismiss">✕</button>`:''}
        </div>
      </div>`;
    });
  });

  content.innerHTML=html;
  $('notif-drawer-overlay').classList.add('open');
}

function closeNotifDrawer(){
  const overlay=$('notif-drawer-overlay');
  if(overlay) overlay.classList.remove('open');
  renderNotificationCenter();
}

function dismissAutoProcess(){
  localStorage.removeItem('financeOS_autoProcessNotify');
  renderNotificationCenter();
}

function dismissAllNotifs(){
  localStorage.removeItem('financeOS_billResetNotify');
  localStorage.removeItem('financeOS_autoLogNotify');
  localStorage.removeItem('financeOS_autoProcessNotify');
  data._pendingTransfers=[];
  saveData();
  closeNotifDrawer();
}

function checkBillResetNotify(){ /* handled by renderNotificationCenter */ }
function checkTransferBanner(){ /* handled by renderNotificationCenter */ }
function checkAutoLogBanner(){ /* handled by renderNotificationCenter */ }



// ── CASH FLOW CHART ───────────────────────────────────────────
function getCashFlowMonths(months){
  const result=[];
  for(let i=months-1;i>=0;i--){
    const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
    const yr=d.getFullYear(), mo=d.getMonth();
    const label=d.toLocaleString('default',{month:'short',year:'2-digit'});
    const totalIn=data.income.reduce((s,inc)=>s+getEffectiveIncome(inc,yr,mo),0);
    const totalOut=data.expenses.reduce((s,e)=>s+e.amount,0)
      +data.bills.filter(b=>b.amount>0&&!((b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo')&&!(b.balance>0))).reduce((s,b)=>s+(b.scheduledAmount||b.amount),0);
    result.push({label,totalIn,totalOut});
  }
  return result;
}

function drawCashFlowChart(pts){
  const canvas=$('cf-chart'); if(!canvas) return;
  const W=canvas.parentElement.offsetWidth||0;
  if(W===0){setTimeout(()=>drawCashFlowChart(pts),150);return;}
  const H=220;
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  const pad={t:28,r:20,b:36,l:56};
  const cw=W-pad.l-pad.r, ch=H-pad.t-pad.b;
  const maxVal=Math.max(...pts.map(p=>Math.max(p.totalIn,p.totalOut)),1);
  const xStep=cw/(pts.length-1||1);

  canvas._cfPts=pts; canvas._cfPad=pad; canvas._cfH=H;

  // Legend
  ctx.font='10px -apple-system,sans-serif';
  ctx.fillStyle='#22c55e'; ctx.fillRect(pad.l,6,10,8);
  ctx.fillStyle='#777777'; ctx.textAlign='left'; ctx.fillText('Money In',pad.l+13,14);
  ctx.fillStyle='#ef4444'; ctx.fillRect(pad.l+80,6,10,8);
  ctx.fillStyle='#777777'; ctx.fillText('Money Out',pad.l+93,14);

  // Grid lines
  ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad.t+ch-(ch*i/4);
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cw,y); ctx.stroke();
    ctx.fillStyle='#777777'; ctx.font='11px -apple-system,sans-serif';
    ctx.textAlign='right';
    ctx.fillText('$'+(maxVal*i/4>=1000?((maxVal*i/4)/1000).toFixed(0)+'k':(maxVal*i/4).toFixed(0)),pad.l-6,y+4);
  }

  function drawLine(key,color,dash){
    ctx.beginPath(); ctx.strokeStyle=color; ctx.lineWidth=2.5;
    ctx.lineJoin='round'; if(dash) ctx.setLineDash([4,3]);
    pts.forEach((p,i)=>{
      const x=pad.l+i*xStep, y=pad.t+ch-(ch*p[key]/maxVal);
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    });
    ctx.stroke(); ctx.setLineDash([]);
    pts.forEach((p,i)=>{
      const x=pad.l+i*xStep, y=pad.t+ch-(ch*p[key]/maxVal);
      ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2);
      ctx.fillStyle=color; ctx.fill();
      ctx.strokeStyle='#111111'; ctx.lineWidth=1.5; ctx.stroke();
    });
  }

  // Fill area between lines
  ctx.beginPath();
  pts.forEach((p,i)=>{ const x=pad.l+i*xStep,y=pad.t+ch-(ch*p.totalIn/maxVal); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  pts.slice().reverse().forEach((p,i)=>{ const x=pad.l+(pts.length-1-i)*xStep,y=pad.t+ch-(ch*p.totalOut/maxVal); ctx.lineTo(x,y); });
  ctx.closePath();
  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ch);
  grad.addColorStop(0,'rgba(34,197,94,0.08)'); grad.addColorStop(1,'rgba(239,68,68,0.04)');
  ctx.fillStyle=grad; ctx.fill();

  drawLine('totalOut','#ef4444',false);
  drawLine('totalIn','#22c55e',false);

  // X labels
  pts.forEach((p,i)=>{
    ctx.fillStyle='#777777'; ctx.font='10px -apple-system,sans-serif';
    ctx.textAlign='center';
    ctx.fillText(p.label,pad.l+i*xStep,H-8);
  });

  // Touch / click tooltip
  if(!canvas._cfTouchBound){
    canvas._cfTouchBound=true;
    const handler=e=>{
      e.preventDefault();
      const rect=canvas.getBoundingClientRect();
      const tx=(e.touches?e.touches[0].clientX:e.clientX)-rect.left;
      cfChartTooltip(canvas,tx);
    };
    canvas.addEventListener('touchstart',handler,{passive:false});
    canvas.addEventListener('click',handler);
  }
}

function cfChartTooltip(canvas,tapX){
  const pts=canvas._cfPts, pad=canvas._cfPad;
  if(!pts||pts.length<2) return;
  const cw=canvas.width-pad.l-pad.r;
  const xStep=cw/(pts.length-1);
  let nearest=0,minDist=Infinity;
  pts.forEach((p,i)=>{ const d=Math.abs(tapX-(pad.l+i*xStep)); if(d<minDist){minDist=d;nearest=i;} });
  const p=pts[nearest];
  let tip=$('cf-chart-tooltip');
  if(!tip){
    tip=document.createElement('div'); tip.id='cf-chart-tooltip';
    tip.style.cssText='position:absolute;background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:8px 12px;font-size:12px;pointer-events:none;z-index:10;box-shadow:0 4px 16px rgba(0,0,0,.3);min-width:140px;';
    canvas.parentElement.style.position='relative';
    canvas.parentElement.appendChild(tip);
  }
  const net=p.totalIn-p.totalOut;
  tip.innerHTML='<div style="font-weight:700;color:var(--text);margin-bottom:4px">'+p.label+'</div>'
    +'<div style="color:#22c55e">In: <strong>'+usd(p.totalIn)+'</strong></div>'
    +'<div style="color:#ef4444">Out: <strong>'+usd(p.totalOut)+'</strong></div>'
    +'<div style="color:'+(net>=0?'#22c55e':'#ef4444')+';margin-top:3px;border-top:1px solid var(--border);padding-top:3px">Net: <strong>'+(net>=0?'+':'')+usd(net)+'</strong></div>';
  const xPos=pad.l+(nearest*cw/(pts.length-1));
  tip.style.left=Math.min(xPos,canvas.width-160)+'px';
  tip.style.top=(pad.t-10)+'px';
// renderCashFlow lives in render_insights.js


// ── TARGETED RENDERING ───────────────────────────────────────
// Call renderSections() after data mutations instead of renderAll().
// Only re-renders sections whose data actually changed.
function renderSections(...keys){
  const s=new Set(keys);
  if(s.has('debt')||s.has('networth')) updateOriginalBalances();
  if(s.has('alerts'))    { renderAlerts(); updateBillsBadge(); }
  if(s.has('dashboard')) { renderDashboard(); }
  if(s.has('bills'))     { renderBills(); }
  if(s.has('debt'))      { renderDebt(); }
  if(s.has('networth'))  { renderNetWorth(); }
  if(s.has('insights'))  { renderInsights(); renderCashFlow(); renderSnapshot(); updateInsightsBadge(); }
  if(s.has('cards'))     { renderCards(); }
  if(s.has('loans'))     { renderLoans(); }
  if(s.has('txns'))      { renderTxns(); setTimeout(attachSwipes,50); }
  updateLastSavedUI();
  checkBackupReminder();
}

// renderAll() is kept for full resets (init, import, language change, delete/undo).
// rAF gate collapses any double-calls within the same frame to one pass.
let _renderAllScheduled=false;
function renderAll(){
  if(_renderAllScheduled) return;
  _renderAllScheduled=true;
  requestAnimationFrame(()=>{
    _renderAllScheduled=false;
    updateOriginalBalances();
    renderAlerts();renderDashboard();renderBills();renderDebt();
    renderNetWorth();renderInsights();renderCashFlow();renderCards();renderLoans();renderTxns();
    renderSnapshot();updateInsightsBadge();updateBillsBadge();
    updateLastSavedUI();checkBackupReminder();
    setTimeout(attachSwipes,50);
  });
}

// ── INIT ─────────────────────────────────────────
setInterval(updateLastSavedUI, 60000);

document.addEventListener('DOMContentLoaded',()=>{
  const vEl=$('sidebar-version'); if(vEl) vEl.textContent=APP_VERSION;
  // Ensure any stale undo pill is cleared on load
  dismissUndoPill();
  const av=$('about-version-text'); if(av) av.textContent=`FinanceOS \u2022 Built for personal use \u2022 Data never leaves your device \u2022 ${APP_VERSION} \u2022 2026`;
  loadTheme();
  toggleDebtFields();
  loadData();
  checkPinOnLoad();
  applyTranslations();
  renderAll();
  showOnboarding();
  initPWA();
  _initSwipe();
  setTimeout(()=>{
    renderAll();
    const months=parseInt($('chart-months')?$('chart-months').value:3)||3;
    drawChart(getMonthlyExpenses(months));
  },350);
});

// ── AI ADVISOR ─────────────────────────────────────────
let advisorHistory = [];

function buildFinancialContext() {
  const d = data;
  const fmt = n => '$' + Math.abs(n || 0).toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0});

  // Accounts
  const accounts = (d.accounts||[]).map(a =>
    a.name + ' (' + a.type + '): ' + fmt(a.balance) + (a.apy ? ' @ ' + a.apy + '% APY' : '')
  ).join(', ') || 'None';

  // Monthly income estimate
  const monthlyIncome = (d.income||[]).reduce(function(sum, i) {
    var m = i.amount || 0;
    if (i.frequency === 'Bi-weekly') m = m * 26 / 12;
    else if (i.frequency === 'Weekly') m = m * 52 / 12;
    else if (i.frequency === 'Annual') m = m / 12;
    return sum + m;
  }, 0);

  // Expenses by category
  var expCats = {};
  (d.expenses||[]).forEach(function(e) {
    var m = e.amount || 0;
    if (e.frequency === 'Bi-weekly') m = m * 26 / 12;
    else if (e.frequency === 'Weekly') m = m * 52 / 12;
    else if (e.frequency === 'Annual') m = m / 12;
    expCats[e.category] = (expCats[e.category] || 0) + m;
  });
  var topExpenses = Object.entries(expCats)
    .sort(function(a,b){return b[1]-a[1];})
    .map(function(x){return x[0] + ': ' + fmt(x[1]) + '/mo';})
    .join(', ') || 'None logged';

  // Bills (non-debt)
  var billList = (d.bills||[])
    .filter(function(b){return b.btype === 'bill';})
    .map(function(b){return b.name + ': ' + fmt(b.amount) + ' due ' + (b.dueDate||'?');})
    .join(', ') || 'None';

  // Debt (credit cards + loans)
  var debtList = (d.bills||[])
    .filter(function(b){return b.btype === 'creditcard' || b.btype === 'loan' || b.btype === 'promo';})
    .map(function(b){
      var s = b.name + ' (' + b.btype + '): ' + fmt(b.balance||0) + ' balance';
      if (b.apr) s += ' @ ' + b.apr + '% APR';
      if (b.creditLimit) s += ', limit ' + fmt(b.creditLimit);
      if (b.originalLoanAmount) s += ', original loan ' + fmt(b.originalLoanAmount);
      return s;
    }).join('\n') || 'None';

  // Goals
  var goalList = (d.goals||[])
    .map(function(g){
      return g.name + ': ' + fmt(g.saved||0) + ' saved of ' + fmt(g.target) + ' target' + (g.date ? ' by ' + g.date : '');
    }).join('\n') || 'None';

  // Net worth
  var totalAssets = (d.accounts||[]).reduce(function(s,a){return s+(a.balance||0);},0)
    + (d.assets||[]).reduce(function(s,a){return s+(a.value||0);},0);
  var totalDebt = (d.bills||[])
    .filter(function(b){return b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo';})
    .reduce(function(s,b){return s+(b.balance||0);},0);

  // Recent spending (last 30 days from transactions)
  var cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30);
  var cutoffStr = cutoff.toISOString().split('T')[0];
  var recentSpend = (d.transactions||[])
    .filter(function(t){return t.date >= cutoffStr && (t.type==='Purchase'||t.type==='Withdrawal') && !t.promoRef;})
    .reduce(function(s,t){return s+(t.amount||0);},0);

  return 'You are a personal AI financial advisor with direct access to the user\'s real financial data from their FinanceOS app. Be concise, specific, and actionable. Reference their actual numbers when relevant. Do not give generic advice.\n\nUSER\'S FINANCIAL SNAPSHOT:\n\nACCOUNTS: ' + accounts + '\n\nMONTHLY INCOME (estimated): ' + fmt(monthlyIncome) + '/mo\n\nMONTHLY EXPENSES by category: ' + topExpenses + '\n\nBILLS: ' + billList + '\n\nDEBT:\n' + debtList + '\n\nSAVINGS GOALS:\n' + goalList + '\n\nNET WORTH: ' + fmt(totalAssets) + ' total assets - ' + fmt(totalDebt) + ' total debt = ' + fmt(totalAssets - totalDebt) + '\n\nSPENDING (last 30 days): ' + fmt(recentSpend) + '\n\nToday: ' + new Date().toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'});
}

// ── CARD DROPDOWN MENU ─────────────────────────────
function toggleCardMenu(e){
  e.stopPropagation();
  const btn=e.currentTarget;
  const dropdown=btn.nextElementSibling;
  const isOpen=dropdown.classList.contains('open');
  closeAllCardMenus();
  if(!isOpen) dropdown.classList.add('open');
}
function closeAllCardMenus(){
  document.querySelectorAll('.card-dropdown.open').forEach(d=>d.classList.remove('open'));
}
// renderAdvisor + renderAdvisorMessages live in render_advisor.js

  renderAdvisorMessages();
}

function advisorKeyPress(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); advisorSend(); }
}

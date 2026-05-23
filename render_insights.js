// ── RENDER/INSIGHTS.JS ───────────────────────────────────────────────────────
// Renders the Insights tab: spending chart, debt planner, cash flow,
// anomalies, projections, promo items, trends, snapshot, debt countdown.
// Depends on: state.js (data), utils.js ($, usd, today, fmtDate, t, pct)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';


function renderInsights(){
  // Chart
  const months=parseInt($('chart-months')?$('chart-months').value:3)||3;
  const pts=getMonthlyExpenses(months);
  const hasSpending=pts.some(p=>p.total>0);
  const chartWrap=$('spending-chart')?.parentElement;
  if(!hasSpending&&chartWrap){
    chartWrap.innerHTML=emptyState('📊','No spending data yet','Once you add expenses and log transactions, your monthly trend will appear here.','+ Add Expense',"openModal('expense')");
  } else {
    // Restore canvas if it was replaced by empty state
    if(chartWrap&&!$('spending-chart')){
      const newWrap=document.createElement('div');
      newWrap.className='chart-wrap';
      newWrap.innerHTML='<canvas id="spending-chart"></canvas>';
      const tipNote=document.createElement('div');
      tipNote.style.cssText='font-size:10px;color:var(--muted);text-align:center;margin-top:6px;opacity:.7';
      tipNote.textContent='Tap any point to see values';
      chartWrap.parentElement.replaceChild(newWrap,chartWrap);
      newWrap.parentElement.insertBefore(tipNote,newWrap.nextSibling);
    }
    setTimeout(()=>drawChart(pts),100);
  }

  // Budget vs Actual
  if(!$('budget-targets'))return;
  const targets=data.targets||[];
  const now=new Date();
  const tab=insightsTab||'categories';

  // Show/hide trends vs budget view
  const trendsWrap = $('trends-wrap');
  const budgetTargets = $('budget-targets');
  if(tab==='trends'){
    if(trendsWrap) trendsWrap.style.display='block';
    if(budgetTargets) budgetTargets.style.display='none';
    renderSpendingTrends();
    return;
  } else {
    if(trendsWrap) trendsWrap.style.display='none';
    if(budgetTargets) budgetTargets.style.display='block';
  }

  // Filter targets by active tab
  const catTargets=targets.filter(tg=>!tg.type||tg.type==='category');
  const cardTargets=targets.filter(tg=>tg.type==='card');
  const activeTargets=tab==='cards'?cardTargets:catTargets;

  renderAnomalies();
  if(!activeTargets.length){
    $('budget-targets').innerHTML=emptyState(
      tab==='cards'?'💳':'🎯',
      tab==='cards'?'No card targets set':'No budget targets set',
      tab==='cards'?'Set a spending limit for your credit cards to track utilization against your goal.':'Set monthly targets for categories like Food, Housing, or Transport to see how you\'re tracking.',
      '+ Set Target','openAddTarget()'
    );
    return;
  }

  $('budget-targets').innerHTML=activeTargets.map(tg=>{
    let label,spent;
    if(tg.type==='card'){
      // Card: show both monthly spend vs limit AND utilization
      const card=data.bills.find(b=>b.id===tg.cardId);
      label=(card?card.name:'Unknown Card');
      // Monthly spend this month on this card
      spent=data.transactions.filter(tr=>{
        if(tr.cardId!==tg.cardId||!tr.date)return false;
        const d=new Date(tr.date);
        return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
      }).reduce((s,tr)=>s+tr.amount,0);
    } else {
      label=catIcon(tg.category)+tg.category;
      // Expenses with this category this month
      const expSpent=data.expenses.filter(e=>{
        if(e.category!==tg.category||!e.date)return false;
        const d=new Date(e.date);
        return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
      }).reduce((s,e)=>s+e.amount,0);
      // Tagged purchases with this category this month
      const txnSpent=data.transactions.filter(tr=>{
        if(tr.type!=='Purchase'||tr.category!==tg.category||!tr.date)return false;
        const d=new Date(tr.date);
        return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
      }).reduce((s,tr)=>s+tr.amount,0);
      spent=expSpent+txnSpent;
    }
    const pctVal=Math.min(100,Math.round(spent/tg.amount*100));
    const over=spent>tg.amount;
    const barColor=over?'var(--red)':pctVal>80?'var(--yellow)':'var(--green)';
    const icon=tg.type==='card'?'💳 ':'';
    // For card targets: also show utilization if credit limit is set
    const cardBill=tg.type==='card'?data.bills.find(b=>b.id===tg.cardId):null;
    const utilRow=cardBill&&cardBill.creditLimit>0?`
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span class="txt-muted-sm">Credit Utilization</span>
          <span style="font-size:11px;font-weight:700;color:${cardBill.balance/cardBill.creditLimit<0.3?'var(--green)':cardBill.balance/cardBill.creditLimit<0.5?'var(--yellow)':'var(--red)'}">
            ${usd(cardBill.balance)} / ${usd(cardBill.creditLimit)} (${Math.round(cardBill.balance/cardBill.creditLimit*100)}%)
          </span>
        </div>
        <div class="target-bar-bg"><div class="target-bar-fill" style="width:${Math.min(100,Math.round(cardBill.balance/cardBill.creditLimit*100))}%;background:${cardBill.balance/cardBill.creditLimit<0.3?'var(--green)':cardBill.balance/cardBill.creditLimit<0.5?'var(--yellow)':'var(--red)'}"></div></div>
      </div>`:'';
    // Gather transactions for drill-down
    const drillId='drill-tg-'+tg.id;
    let drillRows=[];
    if(tg.type==='card'){
      drillRows=data.transactions.filter(tr=>{
        if(!tr.date)return false;
        const d=new Date(tr.date);
        return tr.cardId===tg.cardId&&d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
      }).sort((a,b)=>b.date.localeCompare(a.date));
    } else {
      const exps=data.expenses.filter(e=>{
        if(e.category!==tg.category||!e.date)return false;
        const d=new Date(e.date);
        return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
      }).map(e=>({date:e.date,desc:e.description||e.category,sub:'Expense',amt:e.amount}));
      const txns=data.transactions.filter(tr=>{
        if(tr.type!=='Purchase'||tr.category!==tg.category||!tr.date)return false;
        const d=new Date(tr.date);
        return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
      }).map(tr=>{
        const cardName=tr.cardId?(data.bills.find(b=>b.id===tr.cardId)||{}).name||'':
          tr.accountId?(data.accounts||[]).find(a=>a.id===tr.accountId)?.name||'':'';
        return{date:tr.date,desc:tr.description,sub:cardName||tr.methodLabel||'Purchase',amt:tr.amount};
      });
      drillRows=[...exps,...txns].sort((a,b)=>b.date.localeCompare(a.date));
    }
    const drillHtml=drillRows.length
      ? drillRows.map(r=>`<div class="drill-row">
          <div class="dr-left">
            <div class="dr-desc">${r.desc?catIcon(r.desc)+r.desc:'--'}</div>
            <div class="dr-sub">${fmtDate(r.date)}${r.sub?' · '+r.sub:''}</div>
          </div>
          <div class="dr-amt">-${usd(r.amt)}</div>
        </div>`).join('')
      : '<div class="drill-empty">No transactions this month for this target.</div>';

    return`<div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;cursor:pointer" onclick="toggleDrill('${drillId}',this)">
        <span style="font-size:13px;font-weight:600">${icon}${label}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;color:${over?'var(--red)':'var(--muted)'}">${usd(spent)} / ${usd(tg.amount)}</span>
          <button class="btn btn-danger btn-sm" style="padding:3px 7px;font-size:10px" onclick="event.stopPropagation();deleteItem('targets',${tg.id})">✕</button>
        </div>
      </div>
      <div class="target-bar-bg"><div class="target-bar-fill" style="width:${pctVal}%;background:${barColor}"></div></div>
      <div style="font-size:10px;color:${over?'var(--red)':'var(--muted)'};margin-top:3px">${over?t('Over budget by')+' '+usd(spent-tg.amount):pctVal+'% '+t('used this month')}</div>
      ${tg.amount>0&&!over?velocityHtml(pctVal,getVelocityInfo().monthPct):''}
      ${utilRow}
      <div class="drill-toggle" onclick="toggleDrill('${drillId}',this.previousElementSibling.previousElementSibling.previousElementSibling)">
        <i class="dt-icon">›</i> <span class="dt-label">${drillRows.length} transaction${drillRows.length===1?'':'s'}</span>
      </div>
      <div class="drill-panel" id="${drillId}">${drillHtml}</div>
    </div>`;
  }).join('');
}

// ── MONTHLY SNAPSHOT ─────────────────────────────────────────

function renderSnapshot(){
  renderProjection();
  const now = new Date();
  const yr = now.getFullYear(), mo = now.getMonth();
  const prevYr = mo === 0 ? yr - 1 : yr;
  const prevMo = mo === 0 ? 11 : mo - 1;

  function inMonth(dateStr, y, m){
    if(!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === y && d.getMonth() === m;
  }

  // This month
  const thisIncome   = data.income.filter(i => inMonth(i.date, yr, mo)).reduce((s,i) => s + getEffectiveIncome(i, yr, mo), 0);
  const thisExpenses = data.expenses.filter(e => inMonth(e.date, yr, mo)).reduce((s,e) => s + e.amount, 0);
  const thisBillsOut = data.bills.filter(b => inMonth(b.dueDate, yr, mo)).reduce((s,b) => s + b.amount, 0);
  const thisOut      = thisExpenses + thisBillsOut;
  const thisNet      = thisIncome - thisOut;
  const thisBillsPaid= data.bills.filter(b => inMonth(b.dueDate, yr, mo) && b.status === 'Paid').length;
  const thisBillsTotal = data.bills.filter(b => inMonth(b.dueDate, yr, mo)).length;

  // Last month
  const lastIncome   = data.income.filter(i => inMonth(i.date, prevYr, prevMo)).reduce((s,i) => s + getEffectiveIncome(i, prevYr, prevMo), 0);
  const lastExpenses = data.expenses.filter(e => inMonth(e.date, prevYr, prevMo)).reduce((s,e) => s + e.amount, 0);
  const lastBillsOut = data.bills.filter(b => inMonth(b.dueDate, prevYr, prevMo)).reduce((s,b) => s + b.amount, 0);
  const lastOut      = lastExpenses + lastBillsOut;
  const lastNet      = lastIncome - lastOut;

  function delta(curr, prev){
    if(!prev) return '';
    const diff = curr - prev;
    const pct  = Math.abs(Math.round(diff / prev * 100));
    const up   = diff >= 0;
    const col  = up ? 'var(--green)' : 'var(--red)';
    return `<div class="si-delta" style="color:${col}">${up ? '▲' : '▼'} ${pct}% vs last month</div>`;
  }

  const monthName = now.toLocaleString('default', {month:'long'});
  const sub = $('snap-subtitle');
  if(sub) sub.textContent = monthName + ' vs ' + new Date(prevYr, prevMo).toLocaleString('default', {month:'long'});

  const grid = $('snap-grid');
  if(!grid) return;
  grid.innerHTML = [
    { label:'Income',    val:thisIncome,   prev:lastIncome,   col:'var(--teal)' },
    { label:'Spending',  val:thisOut,      prev:lastOut,      col:'var(--red)'   },
    { label:'Net',       val:thisNet,      prev:lastNet,      col:thisNet>=0?'var(--green)':'var(--red)' },
    { label:'Bills Paid',val:null,         prev:null,         col:'var(--blue)', custom:`<div class="si-val" style="color:var(--blue)">${thisBillsPaid} / ${thisBillsTotal}</div><div class="si-delta" class="txt-muted">${thisBillsTotal - thisBillsPaid} remaining</div>` },
  ].map(item => `
    <div class="snap-item">
      <div class="si-label">${item.label}</div>
      ${item.custom || `<div class="si-val" style="color:${item.col}">${usd(item.val)}</div>${delta(item.val, item.prev)}`}
    </div>`).join('');

  // Savings rate
  const srWrap = $('savings-rate-wrap');
  if(srWrap && thisIncome > 0){
    const saved   = Math.max(0, thisIncome - thisOut);
    const rate    = Math.round(saved / thisIncome * 100);
    const rateCol = rate >= 20 ? 'var(--green)' : rate >= 10 ? 'var(--yellow)' : 'var(--red)';
    const msg     = rate >= 20 ? 'Great saving rate!' : rate >= 10 ? 'On track - aim for 20%' : 'Try to save more this month';
    srWrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:12px;font-weight:700;color:var(--text)">💰 Savings Rate - ${monthName}</div>
        <div style="font-size:18px;font-weight:700;color:${rateCol}">${rate}%</div>
      </div>
      <div class="savings-rate-bar">
        <div class="savings-rate-fill" style="width:${Math.min(rate,100)}%;background:${rateCol}"></div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:5px">${msg} &nbsp;•&nbsp; ${usd(saved)} saved of ${usd(thisIncome)} earned</div>`;
  } else if(srWrap){
    srWrap.innerHTML = '<div style="font-size:11px;color:var(--muted);margin-top:6px">Add income entries to see your savings rate.</div>';
  }
}

// ── DEBT PAYOFF PROGRESS ─────────────────────────────────────
function updateOriginalBalances(){
  // For loans with a user-set original amount, always anchor to that value.
  // For credit cards (no user input), auto-track the highest ever balance.
  data.bills.forEach(b => {
    if(b.btype === 'loan' && b.originalLoanAmount > 0){
      b.originalBalance = b.originalLoanAmount;
    } else if((b.btype === 'creditcard' || b.btype === 'loan') && b.balance > 0){
      if(!b.originalBalance || b.balance > b.originalBalance){
        b.originalBalance = b.balance;
      }
    }
  });
}


function renderDebtProgress(){
  const debts = data.bills.filter(b => (b.btype==='creditcard'||b.btype==='loan') && b.originalBalance > 0);
  const wrap  = $('debt-progress-wrap');
  if(!wrap) return;
  if(!debts.length){ wrap.style.display = 'none'; return; }

  const totalOriginal = debts.reduce((s,b) => s + b.originalBalance, 0);
  const totalCurrent  = debts.reduce((s,b) => s + (b.balance||0), 0);
  const totalPaid     = totalOriginal - totalCurrent;
  const pct           = Math.min(100, Math.round(totalPaid / totalOriginal * 100));

  wrap.style.display = 'block';
  const fill  = $('debt-progress-fill');
  const label = $('debt-progress-label');
  const pctEl = $('debt-progress-pct');
  const paid  = $('debt-progress-paid');
  const orig  = $('debt-progress-original');

  if(fill)  fill.style.width = pct + '%';
  if(pctEl) pctEl.textContent = pct + '% paid off';
  if(label) label.textContent = usd(totalPaid) + ' paid down from original balances';
  if(paid)  paid.textContent  = usd(totalCurrent) + ' remaining';
  if(orig)  orig.textContent  = 'Started at ' + usd(totalOriginal);
}

// ── SPENDING ALERT BADGE ─────────────────────────────────────
function updateInsightsBadge(){
  const badge = $('insights-badge');
  if(!badge) return;
  const now = new Date();
  const targets = data.targets || [];
  let warnCount = 0;

  targets.forEach(tg => {
    let spent = 0;
    if(tg.type === 'card'){
      spent = data.transactions.filter(tr => {
        if(tr.cardId !== tg.cardId || !tr.date) return false;
        const d = new Date(tr.date);
        return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
      }).reduce((s,tr) => s + tr.amount, 0);
    } else {
      const cat = tg.category;
      const expSpent = data.expenses.filter(e => {
        if(e.category !== cat || !e.date) return false;
        const d = new Date(e.date);
        return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
      }).reduce((s,e) => s + e.amount, 0);
      const txnSpent = data.transactions.filter(tr => {
        if(tr.type!=='Purchase'||tr.category!==cat||!tr.date) return false;
        const d = new Date(tr.date);
        return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
      }).reduce((s,tr) => s + tr.amount, 0);
      spent = expSpent + txnSpent;
    }
    if(tg.amount > 0 && spent / tg.amount >= 0.8) warnCount++;
  });

  if(warnCount > 0){
    badge.textContent = warnCount;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

// ── DRILL-DOWN TOGGLE ────────────────────────────────────────
function toggleDrill(id, toggleEl){
  const panel=$(id);
  if(!panel) return;
  const isOpen=panel.classList.toggle('open');
  if(toggleEl){
    toggleEl.classList.toggle('open', isOpen);
    const lbl=toggleEl.querySelector('.dt-label');
    const icon=toggleEl.querySelector('.dt-icon');
    if(icon) icon.style.transform=isOpen?'rotate(90deg)':'rotate(0)';
  }
}

// ── BILLS OVERDUE BADGE ──────────────────────────────────────
function updateBillsBadge(){
  const badge=$('bills-badge');
  if(!badge) return;
  const overdue=data.bills.filter(b=>{
    if(b.status==='Paid'||b.status==='Scheduled') return false;
    return daysUntil(b.dueDate)<0;
  }).length;
  badge.textContent=overdue;
  badge.style.display=overdue>0?'inline-block':'none';
}


// ── LAST SAVED TIMESTAMP ─────────────────────────────────────
// updateLastSavedUI, checkBackupReminder, markBackupDone live in utils.js

// applyTheme, setTheme, updateThemeButtons, loadTheme live in utils.js

// ── ONBOARDING ───────────────────────────────────────────────
// Storage keys for onboarding live in state.js
// ══════════════════════════════════════════════════════════════
// ONBOARDING - clean rewrite
// ══════════════════════════════════════════════════════════════
let obStep = 0;

function showOnboarding(){
  if(localStorage.getItem(ONBOARD_KEY)) return;
  obStep = 0;
  var ov = document.getElementById('onboarding-overlay');
  if(ov) ov.classList.remove('hidden');
  obRender();
}

function obSkipOnboarding(){
  localStorage.setItem(ONBOARD_KEY,'1');
  var ov = document.getElementById('onboarding-overlay');
  if(ov) ov.classList.add('hidden');
}



function obDots(current, total){
  var s = '';
  for(var i=0;i<total;i++){
    s += '<div class="ob-step-dot' + (i===current?' active':'') + '"></div>';
  }
  return '<div class="ob-steps">' + s + '</div>';
}

function obRender(){
  var card = document.getElementById('ob-card-inner');
  if(!card) return;
  var html = '';

  if(obStep===0){
    html =
      '<div class="ob-icon">&#128075;</div>' +
      '<div class="ob-title">Welcome to FinanceOS</div>' +
      '<div class="ob-desc">Your personal finance co-pilot. Everything stays private on your device &mdash; nothing is ever sent anywhere.</div>' +
      '<div class="ob-btns" style="flex-direction:column;gap:10px;margin-top:8px">' +
        '<button class="btn btn-primary" onclick="obStep=1;obRender()" style="padding:12px 28px;width:100%">&#128640; Get Started</button>' +
        '<button class="btn btn-secondary" onclick="obImportBackup()" style="padding:12px 28px;width:100%">&#128190; Load Backup</button>' +
        '<button class="btn btn-secondary" onclick="obDemo()" style="padding:12px 28px;width:100%">&#127917; Explore with Demo Data</button>' +
      '</div>';
  }


  else if(obStep===1){
    html = obDots(1,5) +
      '<div class="ob-icon">&#127974;</div>' +
      '<div class="ob-title">Step 1 of 3 &mdash; Your Main Account</div>' +
      '<div class="ob-desc">What bank account do you use most? Enter its current balance.</div>' +
      '<div class="ob-form">' +
        '<div class="ob-field"><label>Account Name</label>' +
          '<input class="ob-input" id="ob-ac-name" placeholder="e.g. Chase Checking" value="Checking Account"/></div>' +
        '<div class="ob-input-row">' +
          '<div class="ob-field"><label>Type</label>' +
            '<select class="ob-select" id="ob-ac-type">' +
              '<option value="checking">Checking</option>' +
              '<option value="savings">Savings</option>' +
              '<option value="cash">Cash</option>' +
            '</select></div>' +
          '<div class="ob-field"><label>Current Balance ($)</label>' +
            '<input class="ob-input" id="ob-ac-bal" type="number" inputmode="decimal" placeholder="0.00"/></div>' +
        '</div>' +
      '</div>' +
      '<div id="ob-err-1" style="color:var(--red);font-size:12px;margin-bottom:6px;display:none"></div>' +
      '<div class="ob-btns">' +
        '<button class="btn btn-primary" onclick="obSaveAccount()" style="padding:10px 28px">Save &amp; Continue</button>' +
      '</div>' +
      '<div class="ob-skip-label"><a href="#" onclick="event.preventDefault();obStep=2;obRender()" style="color:var(--muted);font-size:11px;text-decoration:underline">skip &mdash; I\'ll add this later</a></div>';
  }

  else if(obStep===2){
    html = obDots(2,5) +
      '<div class="ob-icon">&#128176;</div>' +
      '<div class="ob-title">Step 2 of 3 &mdash; Your Income</div>' +
      '<div class="ob-desc">Add your primary income source. Powers the Debt Planner and monthly projections.</div>' +
      '<div class="ob-form">' +
        '<div class="ob-field"><label>Income Source</label>' +
          '<input class="ob-input" id="ob-inc-source" placeholder="e.g. Salary, Freelance"/></div>' +
        '<div class="ob-input-row">' +
          '<div class="ob-field"><label>Amount ($)</label>' +
            '<input class="ob-input" id="ob-inc-amount" type="number" inputmode="decimal" placeholder="0.00"/></div>' +
          '<div class="ob-field"><label>Frequency</label>' +
            '<select class="ob-select" id="ob-inc-freq">' +
              '<option value="Monthly">Monthly</option>' +
              '<option value="Bi-weekly">Bi-weekly</option>' +
              '<option value="Weekly">Weekly</option>' +
              '<option value="Yearly">Yearly</option>' +
            '</select></div>' +
        '</div>' +
      '</div>' +
      '<div id="ob-err-2" style="color:var(--red);font-size:12px;margin-bottom:6px;display:none"></div>' +
      '<div class="ob-btns">' +
        '<button class="btn btn-primary" onclick="obSaveIncome()" style="padding:10px 28px">Save &amp; Continue</button>' +
      '</div>' +
      '<div class="ob-skip-label"><a href="#" onclick="event.preventDefault();obStep=3;obRender()" style="color:var(--muted);font-size:11px;text-decoration:underline">skip &mdash; I\'ll add this later</a></div>';
  }

  else if(obStep===3){
    html = obDots(3,5) +
      '<div class="ob-icon">&#128203;</div>' +
      '<div class="ob-title">Step 3 of 3 &mdash; Your Biggest Bill</div>' +
      '<div class="ob-desc">Add your largest recurring expense. Rent, mortgage, or a loan payment.</div>' +
      '<div class="ob-form">' +
        '<div class="ob-field"><label>Bill Name</label>' +
          '<input class="ob-input" id="ob-bill-name" placeholder="e.g. Rent, Mortgage, Car Loan"/></div>' +
        '<div class="ob-input-row">' +
          '<div class="ob-field"><label>Monthly Amount ($)</label>' +
            '<input class="ob-input" id="ob-bill-amt" type="number" inputmode="decimal" placeholder="0.00"/></div>' +
          '<div class="ob-field"><label>Due Day of Month</label>' +
            '<input class="ob-input" id="ob-bill-day" type="number" placeholder="1" min="1" max="31" value="1"/></div>' +
        '</div>' +
      '</div>' +
      '<div id="ob-err-3" style="color:var(--red);font-size:12px;margin-bottom:6px;display:none"></div>' +
      '<div class="ob-btns">' +
        '<button class="btn btn-primary" onclick="obSaveBill()" style="padding:10px 28px">Save &amp; Continue</button>' +
      '</div>' +
      '<div class="ob-skip-label"><a href="#" onclick="event.preventDefault();obStep=4;obRender()" style="color:var(--muted);font-size:11px;text-decoration:underline">skip &mdash; I\'ll add this later</a></div>';
  }

  else if(obStep===4){
    // Build summary
    // Use staged onboarding data only - not old saved data
    var totalBal = (window._obAccount) ? (window._obAccount.balance||0) : 0;
    var monthlyInc = 0;
    if(window._obIncome){
      var freq = window._obIncome.frequency;
      var amt  = window._obIncome.amount||0;
      monthlyInc = freq==='Bi-weekly'?amt*26/12:freq==='Weekly'?amt*52/12:freq==='Yearly'?amt/12:amt;
      monthlyInc = parseFloat(monthlyInc.toFixed(2));
    }
    var monthlyBills = (window._obBill) ? (window._obBill.amount||0) : 0;
    var leftover = monthlyInc - monthlyBills;
    var summaryRows = '';
    if(totalBal>0) summaryRows += '<div class="ob-insight-row"><span class="ob-insight-label">Account Balance</span><span class="ob-insight-val" class="txt-green">'+usd(totalBal)+'</span></div>';
    if(monthlyInc>0) summaryRows += '<div class="ob-insight-row"><span class="ob-insight-label">Monthly Income</span><span class="ob-insight-val" style="color:var(--teal)">'+usd(monthlyInc)+'</span></div>';
    if(monthlyBills>0) summaryRows += '<div class="ob-insight-row"><span class="ob-insight-label">Monthly Bills</span><span class="ob-insight-val" class="txt-red">'+usd(monthlyBills)+'</span></div>';
    if(monthlyInc>0&&monthlyBills>0) summaryRows += '<div class="ob-insight-row"><span class="ob-insight-label">Left Over</span><span class="ob-insight-val" style="color:'+(leftover>=0?'var(--green)':'var(--red)')+'">'+usd(leftover)+'</span></div>';
    var summaryHtml = summaryRows ? '<div class="ob-insight">'+summaryRows+'</div>' : '';

    html = obDots(4,5) +
      '<div class="ob-icon">&#127881;</div>' +
      '<div class="ob-title">You\'re all set!</div>' +
      '<div class="ob-desc">Here\'s your starting picture.</div>' +
      summaryHtml +
      '<div class="ob-btns">' +
        '<button class="btn btn-primary" onclick="obFinish()" style="padding:10px 28px">Open FinanceOS</button>' +
      '</div>';
  }

  card.innerHTML = html;
}

function obDemo(){
  obSkipOnboarding();
  loadDemoData(true);
  var firstNav = document.querySelector('[data-section=dashboard]');
  show('dashboard', firstNav);
  setTimeout(()=>{
    renderAll();
    const months=parseInt($('chart-months')?$('chart-months').value:3)||3;
    drawChart(getMonthlyExpenses(months));
  },350);
}

function obSaveAccount(){
  var nameEl = document.getElementById('ob-ac-name');
  var typeEl = document.getElementById('ob-ac-type');
  var balEl  = document.getElementById('ob-ac-bal');
  var name   = (nameEl && nameEl.value) ? nameEl.value.trim() : '';
  var type   = (typeEl && typeEl.value) ? typeEl.value : 'checking';
  var balRaw = balEl ? balEl.value.trim() : '';
  var err    = document.getElementById('ob-err-1');
  if(!name){
    if(err){err.textContent='Please enter an account name.';err.style.display='block';}
    if(nameEl) nameEl.focus(); return;
  }
  if(balRaw===''){
    if(err){err.textContent='Please enter the current balance (use 0 if unsure).';err.style.display='block';}
    if(balEl) balEl.focus(); return;
  }
  window._obAccount = { name: name, type: type, balance: parseFloat(balRaw)||0 };
  obStep = 2; obRender();
}

function obSaveIncome(){
  var srcEl  = document.getElementById('ob-inc-source');
  var amtEl  = document.getElementById('ob-inc-amount');
  var freqEl = document.getElementById('ob-inc-freq');
  var source = (srcEl && srcEl.value) ? srcEl.value.trim() : '';
  var amount = (amtEl && amtEl.value) ? (parseFloat(amtEl.value)||0) : 0;
  var freq   = (freqEl && freqEl.value) ? freqEl.value : 'Monthly';
  var err    = document.getElementById('ob-err-2');
  if(!source){
    if(err){err.textContent='Please enter an income source name.';err.style.display='block';}
    if(srcEl) srcEl.focus(); return;
  }
  if(!amount||amount<=0){
    if(err){err.textContent='Please enter an amount greater than 0.';err.style.display='block';}
    if(amtEl) amtEl.focus(); return;
  }
  window._obIncome = { source: source, amount: amount, frequency: freq };
  obStep = 3; obRender();
}

function obSaveBill(){
  var nameEl = document.getElementById('ob-bill-name');
  var amtEl  = document.getElementById('ob-bill-amt');
  var dayEl  = document.getElementById('ob-bill-day');
  var name   = (nameEl && nameEl.value) ? nameEl.value.trim() : '';
  var amount = (amtEl && amtEl.value) ? (parseFloat(amtEl.value)||0) : 0;
  var day    = (dayEl && dayEl.value) ? (parseInt(dayEl.value)||1) : 1;
  var err    = document.getElementById('ob-err-3');
  if(!name){
    if(err){err.textContent='Please enter a bill name.';err.style.display='block';}
    if(nameEl) nameEl.focus(); return;
  }
  if(!amount||amount<=0){
    if(err){err.textContent='Please enter an amount greater than 0.';err.style.display='block';}
    if(amtEl) amtEl.focus(); return;
  }
  window._obBill = { name: name, amount: amount, day: day };
  obStep = 4; obRender();
}


function obFinish(){
  // Commit staged onboarding data
  if(window._obAccount){
    if(!data.accounts) data.accounts = [];
    var acId = Date.now();
    data.accounts.push({ id:acId, name:window._obAccount.name, type:window._obAccount.type,
      balance:window._obAccount.balance, notes:'', isDefault:true });
    window._obAccount = null;
  }
  if(window._obIncome){
    if(!data.income) data.income = [];
    var acId2 = (data.accounts && data.accounts[0]) ? data.accounts[0].id : 0;
    data.income.push({ id:Date.now(), source:window._obIncome.source,
      amount:window._obIncome.amount, frequency:window._obIncome.frequency,
      date:today(), accountId:acId2 });
    window._obIncome = null;
  }
  if(window._obBill){
    if(!data.bills) data.bills = [];
    var d2 = new Date(); d2.setDate(window._obBill.day);
    if(d2 < new Date()) d2.setMonth(d2.getMonth()+1);
    data.bills.push({ id:Date.now(), name:window._obBill.name,
      amount:window._obBill.amount, dueDate:d2.toISOString().split('T')[0],
      recurring:'Monthly', status:'Pending', btype:'bill',
      balance:0, apr:0, creditLimit:0, scheduledAmount:null, scheduledAccountId:null });
    window._obBill = null;
  }
  try{ saveData(); }catch(e){}
  obSkipOnboarding();
  renderAll();
  var firstNav = document.querySelector('[data-section=dashboard]');
  show('dashboard', firstNav);
}




// ── AUTO-PROCESS NOTIFICATION ────────────────────────────────
function autoProcessScheduledBillsWithNotify(){
  autoProcessScheduledBills();
  const processed=data.transactions.filter(tx=>{
    if(!tx.date) return false;
    return tx.date===today()&&(tx.description||'').includes('auto-processed');
  }).length;
  if(processed>0){
    localStorage.setItem('financeOS_autoProcessNotify', JSON.stringify({count:processed}));
  }
}

// ── UNDO DELETE ───────────────────────────────────────────────
let _undoTimer=null;
let _undoState=null;

function cleanupOrphanedRefs(key, id){
  if(key==='accounts'){
    data.income.forEach(i=>{ if(i.accountId===id) i.accountId=0; });
    data.expenses.forEach(e=>{ if(e.accountId===id) e.accountId=0; });
    data.transactions.forEach(tx=>{ if(tx.accountId===id) tx.accountId=0; });
    data.bills.forEach(b=>{ if(b.scheduledAccountId===id){ b.scheduledAccountId=null; b.scheduledAmount=null; if(b.status==='Scheduled') b.status='Pending'; } });
    data.expenses.forEach(e=>{ if(e.autoLogAccountId===id) e.autoLogAccountId=0; });
    data.bills.forEach(b=>{ if(b.autoLogAccountId===id) b.autoLogAccountId=0; });
  }
  if(key==='bills'){
    const bill=data.bills.find(b=>b.id===id);
    if(bill&&(bill.btype==='creditcard'||bill.btype==='promo')){
      data.transactions=data.transactions.filter(tx=>tx.cardId!==id);
    }
    data.transactions.forEach(tx=>{ if(tx.cardId===id) tx.cardId=0; });
  }
}

function deleteItem(key,id){
  const item=data[key].find(i=>i.id===id);
  if(!item) return;
  haptic('heavy');
  _undoState={key,id,item,index:data[key].findIndex(i=>i.id===id)};
  cleanupOrphanedRefs(key,id);
  data[key]=data[key].filter(i=>i.id!==id);
  saveData();renderAll();
  showUndoPill(key);
}

function showUndoPill(key){
  const labels={income:'Income entry',expenses:'Expense',bills:'Bill',transactions:'Transaction',assets:'Asset',targets:'Target',accounts:'Account',cards:'Card'};
  // Remove any existing pill
  const existing=document.getElementById('undo-pill');
  if(existing) existing.remove();
  clearTimeout(_undoTimer);
  // Build pill from scratch each time — no CSS class toggling, no fixed+transform
  const pill=document.createElement('div');
  pill.id='undo-pill';
  const label=(labels[key]||'Item')+' deleted';
  pill.innerHTML=
    '<span style="flex:1;font-size:13px;font-weight:600;white-space:nowrap">'+label+'</span>'+
    '<button onclick="undoDelete()" style="background:var(--accent);color:#fff;border:none;border-radius:8px;'+
      'padding:5px 13px;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font-b);flex-shrink:0">Undo</button>'+
    '<div id="undo-pill-bar" style="position:absolute;bottom:0;left:0;height:3px;background:var(--accent);border-radius:0 0 10px 10px;width:100%;transition:none"></div>';
  Object.assign(pill.style,{
    position:'fixed',
    bottom:'84px',
    left:'50%',
    transform:'translateX(-50%)',
    background:'var(--surface)',
    border:'1px solid var(--border2)',
    borderRadius:'12px',
    padding:'10px 14px',
    display:'flex',
    alignItems:'center',
    gap:'12px',
    zIndex:'9999',
    boxShadow:'0 6px 28px rgba(0,0,0,.45)',
    minWidth:'220px',
    maxWidth:'calc(100vw - 32px)',
    opacity:'0',
    transition:'opacity .2s',
    pointerEvents:'auto',
  });
  document.body.appendChild(pill);
  // Fade in
  requestAnimationFrame(()=>{ pill.style.opacity='1'; });
  // Progress bar shrink
  const bar=document.getElementById('undo-pill-bar');
  if(bar){
    setTimeout(()=>{
      bar.style.transition='width 7.5s linear';
      bar.style.width='0%';
    },50);
  }
  // Auto-dismiss after 8 s
  _undoTimer=setTimeout(()=>dismissUndoPill(),8000);
}

function dismissUndoPill(){
  clearTimeout(_undoTimer);
  _undoState=null;
  const pill=document.getElementById('undo-pill');
  if(!pill) return;
  pill.style.opacity='0';
  setTimeout(()=>{ const p=document.getElementById('undo-pill'); if(p) p.remove(); },220);
}

function undoDelete(){
  if(!_undoState) return;
  const{key,item,index}=_undoState;
  data[key].splice(index,0,item);
  saveData();renderAll();
  _undoState=null;
  dismissUndoPill();
  showToast('Restored!');
}

// ── BILL PAID ANIMATION ───────────────────────────────────────
// ── INCOME PROJECTION ─────────────────────────────────────────
let projWindow=3;

function setProjWindow(w, btn){
  projWindow=w;
  document.querySelectorAll('.proj-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderProjection();
}


function renderProjection(){
  const el=$('proj-content');
  if(!el) return;
  const now=new Date();
  let months=[];
  if(projWindow==='year'){
    const remaining=12-now.getMonth();
    for(let i=1;i<=remaining;i++){
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      months.push(d);
    }
  } else {
    for(let i=1;i<=projWindow;i++){
      const d=new Date(now.getFullYear(),now.getMonth()+i,1);
      months.push(d);
    }
  }

  const recurring=data.income.filter(i=>i.frequency!=='One-time');
  if(!recurring.length){
    el.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0">Add recurring income in Cash Flow to see projections.</div>';
    return;
  }

  // Per-month totals using actual paycheck dates
  const monthlyTotals = months.map(d=>{
    const yr = d.getFullYear(), mo = d.getMonth();
    return{
      date: d,
      total: parseFloat(recurring.reduce((s,i)=>s+getEffectiveIncome(i,yr,mo),0).toFixed(2)),
      label: d.toLocaleString('default',{month:'short',year:'2-digit'})
    };
  });

  const grandTotal = parseFloat(monthlyTotals.reduce((s,m)=>s+m.total,0).toFixed(2));
  const avgMonthly = parseFloat((grandTotal/months.length).toFixed(2));
  const maxMonth   = monthlyTotals.reduce((a,b)=>b.total>a.total?b:a);
  const hasSpike   = monthlyTotals.some(m=>m.total > avgMonthly*1.2);

  const endLabel = projWindow==='year'?'end of '+now.getFullYear():(projWindow+' months');

  const monthRows = hasSpike ? monthlyTotals.map(m=>{
    const isSpike = m.total > avgMonthly*1.2;
    return`<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
      <span class="txt-muted-xs">${m.label}</span>
      <span style="font-size:13px;font-weight:700;color:${isSpike?'var(--yellow)':'var(--green)'}">
        ${usd(m.total)}${isSpike?' <span style="font-size:9px;font-weight:700;background:rgba(245,158,11,.15);color:var(--yellow);border-radius:4px;padding:1px 4px">3 checks</span>':''}
      </span>
    </div>`;
  }).join('') : '';

  el.innerHTML=`
    <div style="background:rgba(34,197,94,.07);border-radius:8px;padding:10px 12px;margin-bottom:${hasSpike?'10px':'0'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span class="txt-muted-sm">Expected by ${endLabel}</span>
        <span style="font-size:18px;font-weight:700;color:var(--green)">${usd(grandTotal)}</span>
      </div>
      <div class="txt-muted-sm">${usd(avgMonthly)} avg/month &times; ${months.length} months</div>
      ${hasSpike?`<div style="font-size:11px;color:var(--yellow);margin-top:4px">&#127881; Includes ${monthlyTotals.filter(m=>m.total>avgMonthly*1.2).length} 3-paycheck month${monthlyTotals.filter(m=>m.total>avgMonthly*1.2).length>1?'s':''}</div>`:''}
    </div>
    ${hasSpike?`<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Monthly Breakdown</div>${monthRows}`:''}`;
}



// ── CATEGORY ICONS ────────────────────────────────────────────
const CAT_ICONS={
  'Food':'🍕','Groceries':'🛒','Transport':'🚗','Gas':'⛽',
  'Entertainment':'🎬','Shopping':'🛍️','Healthcare':'🏥',
  'Housing':'🏠','Rent':'🏠','Utilities':'💡','Electric':'💡',
  'Subscriptions':'📱','Education':'📚','Travel':'✈️',
  'Savings':'💰','Investment':'📈','Dining':'🍽️',
  'Gym':'💪','Insurance':'🛡️','Personal':'👤',
  'Clothing':'👕','Electronics':'💻','Other':'📦',
};
function catIcon(cat){
  if(!cat) return '';
  const icon=CAT_ICONS[cat];
  return icon?icon+' ':'';
}

// Haptic feedback removed

// ── RECURRING BILL RESET ──────────────────────────────────────
function autoResetRecurringBills(){
  const currentMonth=today().slice(0,7);
  const lastReset=localStorage.getItem(BILL_RESET_KEY);
  if(lastReset===currentMonth) return;
  let changed=0;
  const resetNames=[];

  function advanceDueDate(dueDate, recurring){
    if(!dueDate) return dueDate;
    const d=new Date(dueDate+'T12:00:00');
    if(recurring==='Monthly')    d.setMonth(d.getMonth()+1);
    else if(recurring==='Weekly')     d.setDate(d.getDate()+7);
    else if(recurring==='Bi-weekly')  d.setDate(d.getDate()+14);
    else if(recurring==='Quarterly')  d.setMonth(d.getMonth()+3);
    else if(recurring==='Annually')   d.setFullYear(d.getFullYear()+1);
    return d.toISOString().split('T')[0];
  }

  data.bills.forEach(b=>{
    if(b.recurring==='One-time') return;
    if(b.status==='Paid'||b.status==='Scheduled'){
      b.status = b.autoLog ? 'Scheduled' : 'Pending';
      if(daysUntil(b.dueDate) <= 0) b.dueDate = advanceDueDate(b.dueDate, b.recurring);
      b.scheduledAmount=null;
      b.scheduledAccountId=null;
      changed++;
      resetNames.push(b.name);
    }
  });
  localStorage.setItem(BILL_RESET_KEY, currentMonth);
  if(changed>0){
    saveData();
    // Store reset notification for dashboard banner
    localStorage.setItem('financeOS_billResetNotify', JSON.stringify({
      month: currentMonth, count: changed, names: resetNames.slice(0,3)
    }));
  }
}

// ── PWA INSTALL PROMPT ────────────────────────────────────────
let _pwaPrompt=null;

function initPWA(){
  if(localStorage.getItem(PWA_PROMPT_KEY)) return;
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandalone=window.navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches;
  if(isInStandalone) return; // Already installed

  if(isIOS){
    // iOS: show manual tip after 10 seconds
    setTimeout(()=>{
      if(localStorage.getItem(PWA_PROMPT_KEY)) return;
      const banner=$('pwa-banner');
      const sub=$('pwa-sub');
      const btn=$('pwa-install-btn');
      if(banner&&sub&&btn){
        sub.textContent='Tap '+String.fromCharCode(0x2B06)+' Share then "Add to Home Screen"';
        btn.style.display='none';
        banner.style.display='flex';
      }
    },10000);
  } else {
    // Android/Chrome: capture install event
    window.addEventListener('beforeinstallprompt',e=>{
      e.preventDefault();
      _pwaPrompt=e;
      setTimeout(()=>{
        if(localStorage.getItem(PWA_PROMPT_KEY)) return;
        const banner=$('pwa-banner');
        if(banner) banner.style.display='flex';
      },5000);
    });
  }
  // Hide if already installed
  window.addEventListener('appinstalled',()=>{ pwaDismiss(); });
}

function pwaInstall(){
  if(_pwaPrompt){
    _pwaPrompt.prompt();
    _pwaPrompt.userChoice.then(r=>{ if(r.outcome==='accepted') pwaDismiss(); });
  }
}

function pwaDismiss(){
  localStorage.setItem(PWA_PROMPT_KEY,'1');
  const banner=$('pwa-banner');
  if(banner) banner.style.display='none';
}



// ── ANOMALY DETECTION ─────────────────────────────────────────
function getCategorySpend(cat, yr, mo){
  const expSpent = data.expenses.filter(e=>{
    if(!e.date||e.category!==cat) return false;
    const d=new Date(e.date);
    return d.getFullYear()===yr && d.getMonth()===mo;
  }).reduce((s,e)=>s+e.amount, 0);
  const txnSpent = data.transactions.filter(tr=>{
    if(!tr.date||tr.type!=='Purchase'||tr.category!==cat) return false;
    const d=new Date(tr.date);
    return d.getFullYear()===yr && d.getMonth()===mo;
  }).reduce((s,tr)=>s+tr.amount, 0);
  return expSpent + txnSpent;
}

function detectAnomalies(){
  const now=new Date();
  const yr=now.getFullYear(), mo=now.getMonth();
  // Get all categories that appear in last 3 months
  const cats=new Set();
  data.expenses.forEach(e=>{ if(e.category) cats.add(e.category); });
  data.transactions.filter(tr=>tr.type==='Purchase'&&tr.category).forEach(tr=>cats.add(tr.category));
  const anomalies=[];
  cats.forEach(cat=>{
    const thisMonth=getCategorySpend(cat, yr, mo);
    if(thisMonth===0) return;
    // 3-month average (previous 3 months, not current)
    let avg3=0, validMonths=0;
    for(let i=1;i<=3;i++){
      const d=new Date(yr, mo-i, 1);
      const spend=getCategorySpend(cat, d.getFullYear(), d.getMonth());
      if(spend>0){ avg3+=spend; validMonths++; }
    }
    if(validMonths===0) return; // No history, skip
    avg3=avg3/validMonths;
    if(avg3===0) return;
    const overpct=Math.round((thisMonth-avg3)/avg3*100);
    if(overpct>=30){
      anomalies.push({
        cat, thisMonth, avg3, overpct,
        level: overpct>=50?'red':'yellow'
      });
    }
  });
  return anomalies.sort((a,b)=>b.overpct-a.overpct);
}


function renderAnomalies(){
  const el=$('anomaly-wrap');
  const card=$('anomaly-card');
  if(!el) return;
  const anomalies=detectAnomalies();
  if(!anomalies.length){
    el.innerHTML='<div style="font-size:12px;color:var(--muted);padding:4px 0">No unusual spending detected vs your 3-month average.</div>';
    if(card) card.style.display='block';
    return;
  }
  if(card) card.style.display='block';
  const items=anomalies.map(a=>`
    <div class="anomaly-item ${a.level}">
      <div>
        <div class="an-label">${catIcon(a.cat)}${a.cat}</div>
        <div class="an-detail">${usd(a.thisMonth)} this month vs ${usd(Math.round(a.avg3))} avg</div>
      </div>
      <div class="an-badge" style="color:${a.level==='red'?'var(--red)':'var(--yellow)'}">
        +${a.overpct}%
      </div>
    </div>`).join('');
  el.innerHTML=`<div style="font-size:10px;color:var(--muted);margin-bottom:10px">vs your 3-month average</div>`+items;
}

// ── SPENDING VELOCITY ─────────────────────────────────────────
function getVelocityInfo(){
  const now=new Date();
  const daysInMonth=new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const daysPassed=now.getDate();
  const monthPct=Math.round(daysPassed/daysInMonth*100);
  return { monthPct, daysPassed, daysInMonth };
}

function velocityHtml(spentPct, monthPct){
  const diff=spentPct-monthPct;
  let color, dotColor, msg;
  if(diff>20){
    color='var(--red)'; dotColor='var(--red)';
    msg=`${spentPct}% spent, ${monthPct}% through month - ahead of pace`;
  } else if(diff>0){
    color='var(--yellow)'; dotColor='var(--yellow)';
    msg=`${spentPct}% spent, ${monthPct}% through month - slightly ahead`;
  } else {
    color='var(--green)'; dotColor='var(--green)';
    msg=`${spentPct}% spent, ${monthPct}% through month - on track`;
  }
  return `<div class="velocity-row">
    <span class="vel-dot" style="background:${dotColor}"></span>
    <span style="color:${color}">${msg}</span>
  </div>`;
}



// ── NET WORTH HISTORY ─────────────────────────────────────────
let nwhWindow = 6;

function setNWHWindow(n, btn){
  nwhWindow = n;
  document.querySelectorAll('.nwh-btn').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  drawNWHistoryChart();
}

function snapshotNetWorth(value){
  const month = today().slice(0,7);
  let history = [];
  try { history = JSON.parse(localStorage.getItem(NW_HISTORY_KEY)||'[]'); } catch(e){}
  const existing = history.find(h => h.month === month);
  if(existing){
    existing.value = value; // Update current month snapshot
  } else {
    history.push({month, value});
  }
  // Keep max 36 months
  history.sort((a,b) => a.month.localeCompare(b.month));
  if(history.length > 36) history = history.slice(-36);
  localStorage.setItem(NW_HISTORY_KEY, JSON.stringify(history));
  return history;
}

function drawNWHistoryChart(){
  const canvas = $('nw-history-chart');
  const empty  = $('nw-history-empty');
  if(!canvas) return;

  let history = [];
  try { history = JSON.parse(localStorage.getItem(NW_HISTORY_KEY)||'[]'); } catch(e){}
  history.sort((a,b) => a.month.localeCompare(b.month));

  // Filter to window
  const sliced = nwhWindow === 0 ? history : history.slice(-nwhWindow);

  if(sliced.length < 2){
    canvas.style.display = 'none';
    if(empty) empty.style.display = 'block';
    return;
  }
  canvas.style.display = 'block';
  if(empty) empty.style.display = 'none';

  const W = canvas.parentElement.offsetWidth || 300;
  if(W === 0){ setTimeout(drawNWHistoryChart, 150); return; }
  const H = 160;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  const values = sliced.map(h => h.value);
  const minV   = Math.min(...values);
  const maxV   = Math.max(...values);
  const range  = maxV - minV || 1;
  const pad    = { top:20, right:16, bottom:28, left:16 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top  - pad.bottom;

  // Gradient fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
  grad.addColorStop(0,  'rgba(26,168,216,0.25)');
  grad.addColorStop(1,  'rgba(26,168,216,0.00)');

  const pts = sliced.map((h,i) => ({
    x: pad.left + (i / (sliced.length-1)) * chartW,
    y: pad.top  + (1 - (h.value - minV) / range) * chartH,
    v: h.value,
    m: h.month,
  }));

  // Fill
  ctx.beginPath();
  ctx.moveTo(pts[0].x, H - pad.bottom);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length-1].x, H - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#5070f0';
  ctx.lineWidth = 2;
  ctx.lineJoin  = 'round';
  pts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
  ctx.stroke();

  // Dots + labels
  pts.forEach((p, i) => {
    // Dot
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
    ctx.fillStyle = '#5070f0';
    ctx.fill();

    // Month label (first, last, and every 3rd)
    if(i===0 || i===pts.length-1 || i%3===0){
      const d = new Date(p.m+'-15');
      const lbl = d.toLocaleString('default',{month:'short', year:'2-digit'});
      ctx.font = '9px -apple-system,sans-serif';
      ctx.fillStyle = 'rgba(136,136,153,0.9)';
      ctx.textAlign = i===0?'left':i===pts.length-1?'right':'center';
      ctx.fillText(lbl, p.x, H - 6);
    }

    // Value label on last point
    if(i===pts.length-1){
      const isPositive = p.v >= 0;
      ctx.font = 'bold 11px -apple-system,sans-serif';
      ctx.fillStyle = isPositive ? '#22c55e' : '#ef4444';
      ctx.textAlign = 'right';
      ctx.fillText(usd(p.v), p.x, p.y - 8);
    }
  });
}



// ── DEBT-FREE DATE COUNTDOWN ──────────────────────────────────

function renderDebtCountdown(){
  const wrap=$('debt-countdown-wrap');
  if(!wrap) return;
  const debts=data.bills.filter(b=>(b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo')&&b.balance>0&&(b.apr>=0));
  if(!debts.length){ wrap.innerHTML=''; return; }

  const extra=Math.max(0,(data.income.reduce((s,i)=>s+getEffectiveIncome(i,new Date().getFullYear(),new Date().getMonth()),0))
    -(data.expenses.reduce((s,e)=>s+e.amount,0))
    -(data.bills.filter(b=>b.btype==='bill').reduce((s,b)=>s+b.amount,0))
    -(debts.reduce((s,b)=>s+Math.max(b.scheduledAmount||0,b.amount||0),0)));
  const plan=calcDebtPlan(debts.map(b=>({...b,balance:b.balance,amount:b.amount,apr:b.apr})), Math.max(0,extra));
  if(!plan||!plan.months){ wrap.innerHTML=''; return; }

  // Find actual payoff month for each debt from sched data (plan order)
  const payoffs=plan.items.map(d=>{
    const idx=d.sched.findIndex(s=>s.balance<0.01);
    const payoffMonth=idx>=0?idx+1:d.sched.length;
    const date=new Date();
    date.setMonth(date.getMonth()+payoffMonth);
    return{name:d.name, payoffMonth, date};
  }).sort((a,b)=>a.payoffMonth-b.payoffMonth);

  if(!payoffs.length){ wrap.innerHTML=''; return; }

  const methodLabel=debtMethod==='avalanche'?'Avalanche':'Snowball';
  const methodColor=debtMethod==='avalanche'?'var(--red)':'var(--green)';

  // Show next 2 payoffs
  const nextTwo=payoffs.slice(0,2).map((p,i)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;${i>0?'margin-top:6px;padding-top:6px;border-top:1px solid var(--border)':''}">
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--text)">${i===0?'Next:':'Then:'} <strong>${p.name}</strong></div>
        <div class="txt-muted-sm">${p.date.toLocaleString('default',{month:'long',year:'numeric'})}</div>
      </div>
      <div style="font-size:14px;font-weight:700;color:var(--accent)">${p.payoffMonth}mo</div>
    </div>`).join('');

  wrap.innerHTML=`
    <div class="debt-countdown">
      <div class="dc-icon">🎯</div>
      <div class="dc-body">
        <div class="dc-label">Next Payoff - <span style="color:${methodColor}">${methodLabel}</span></div>
        ${nextTwo}
      </div>
    </div>`;
}


// ── SMART BILL REMINDER ───────────────────────────────────────
// ── EXPORT TO EXCEL / NUMBERS ─────────────────────────────────
function exportToExcel(){
  if(typeof XLSX==='undefined'){
    showToast('Excel library not loaded. Check your connection.','error');
    return;
  }

  const now  = new Date();
  const fmtD = d => d ? new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
  const fmtN = n => typeof n==='number' ? parseFloat(n.toFixed(2)) : 0;

  // ── STYLE CONSTANTS ──────────────────────────────────────────
  const H  = { font:{name:'Arial',sz:10,bold:true,color:{rgb:'FFFFFF'}},
                fill:{patternType:'solid',fgColor:{rgb:'6C63FF'}},
                border:{top:{style:'thin',color:{rgb:'6C63FF'}},bottom:{style:'thin',color:{rgb:'6C63FF'}},left:{style:'thin',color:{rgb:'6C63FF'}},right:{style:'thin',color:{rgb:'6C63FF'}}},
                alignment:{horizontal:'left',vertical:'center'} };
  const D  = { font:{name:'Arial',sz:10},
                border:{top:{style:'thin',color:{rgb:'EEEEEE'}},bottom:{style:'thin',color:{rgb:'EEEEEE'}},left:{style:'thin',color:{rgb:'EEEEEE'}},right:{style:'thin',color:{rgb:'EEEEEE'}}},
                alignment:{horizontal:'left',vertical:'center'} };
  const DA = { ...D, fill:{patternType:'solid',fgColor:{rgb:'F0EFFF'}} };
  const DR = { ...D,  alignment:{horizontal:'right',vertical:'center'}, numFmt:'"$"#,##0.00' };
  const DRA= { ...DA, alignment:{horizontal:'right',vertical:'center'}, numFmt:'"$"#,##0.00' };
  const HR = { ...H,  alignment:{horizontal:'right',vertical:'center'} };
  const SEC= { font:{name:'Arial',sz:10,bold:true,color:{rgb:'6C63FF'}},
                fill:{patternType:'solid',fgColor:{rgb:'F0EFFF'}},
                alignment:{horizontal:'left',vertical:'center'} };
  const TOT= { font:{name:'Arial',sz:11,bold:true,color:{rgb:'22C55E'}},
                fill:{patternType:'solid',fgColor:{rgb:'F0EFFF'}},
                alignment:{horizontal:'right',vertical:'center'},
                numFmt:'"$"#,##0.00' };

  // ── CELL BUILDER ─────────────────────────────────────────────
  function c(v, s){ return {v, s, t: typeof v==='number'?'n': v instanceof Date?'d':'s'}; }

  // ── SHEET BUILDER ────────────────────────────────────────────
  function makeSheet(headers, rows, numColIdxs=[]){
    // headers: array of strings
    // rows: array of arrays (values)
    // numColIdxs: 0-based column indices that are currency
    const aoa = [];
    aoa.push(headers.map((h,i)=> c(h, numColIdxs.includes(i)?HR:H)));
    rows.forEach((row,ri)=>{
      const isAlt = ri%2===1;
      aoa.push(row.map((v,ci)=>{
        const isNum = numColIdxs.includes(ci) && typeof v==='number';
        if(isNum) return c(v, isAlt?DRA:DR);
        return c(v==null?'':v, isAlt?DA:D);
      }));
    });
    // Totals row
    if(numColIdxs.length){
      const totals = headers.map((_,ci)=>{
        if(numColIdxs.includes(ci)){
          const sum = rows.reduce((s,r)=>s+(typeof r[ci]==='number'?r[ci]:0),0);
          return c(fmtN(sum), TOT);
        }
        return c(ci===0?'TOTAL':'', {font:{name:'Arial',sz:10,bold:true},fill:{patternType:'solid',fgColor:{rgb:'F0EFFF'}}});
      });
      aoa.push(totals);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!rows'] = [{hpt:20},...rows.map(()=>({hpt:16}))];
    ws['!freeze'] = {xSplit:0, ySplit:1};
    ws['!cols']  = headers.map((_,i)=>({wch: Math.max(headers[i].length+4,14)}));
    return ws;
  }

  const wb = XLSX.utils.book_new();

  // ── CALCULATED TOTALS ────────────────────────────────────────
  const totalIncome   = data.income.reduce((s,i)=>s+getEffectiveIncome(i,new Date().getFullYear(),new Date().getMonth()),0);
  const totalExpenses = data.expenses.reduce((s,e)=>s+e.amount,0);
  const totalBills    = data.bills.reduce((s,b)=>s+b.amount,0);
  const totalDebt     = data.bills.filter(b=>b.btype==='creditcard'||b.btype==='loan').reduce((s,b)=>s+(b.balance||0),0);
  const totalAssets   = (data.assets||[]).reduce((s,a)=>s+a.value,0);
  const totalAccounts = (data.accounts||[]).reduce((s,a)=>s+a.balance,0);
  const netWorth      = totalAssets+totalAccounts-totalDebt;

  // ── SHEET 1: SUMMARY ─────────────────────────────────────────
  const summaryAOA = [
    [c('FinanceOS Export',{font:{name:'Arial',sz:14,bold:true,color:{rgb:'6C63FF'}}}), c(''),c('')],
    [c('Generated',{font:{name:'Arial',sz:10,bold:true}}), c(now.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}),D), c('')],
    [c(''),c(''),c('')],
    [c('INCOME & SPENDING',SEC),c('',SEC),c('',SEC)],
    [c('Total Income',D),              c(fmtN(totalIncome),DR),      c('')],
    [c('Total Expenses',DA),           c(fmtN(totalExpenses),DRA),   c('')],
    [c('Total Bills',D),               c(fmtN(totalBills),DR),       c('')],
    [c('Net Cash Flow',DA),            c(fmtN(totalIncome-totalExpenses-totalBills),DRA), c('')],
    [c(''),c(''),c('')],
    [c('NET WORTH',SEC),c('',SEC),c('',SEC)],
    [c('Account Balances',D),          c(fmtN(totalAccounts),DR),    c('')],
    [c('Total Assets',DA),             c(fmtN(totalAssets+totalAccounts),DRA), c('')],
    [c('Total Debt',D),                c(fmtN(totalDebt),DR),        c('')],
    [c('Net Worth',{font:{name:'Arial',sz:10,bold:true}}), c(fmtN(netWorth),TOT), c('')],
    [c(''),c(''),c('')],
    [c('DEBT BREAKDOWN',SEC),c('Amount Remaining',{...H,alignment:{horizontal:'right'}}),c('APR',H)],
    ...data.bills.filter(b=>b.btype==='creditcard'||b.btype==='loan').map((b,i)=>[
      c(b.name, i%2?DA:D),
      c(fmtN(b.balance), i%2?DRA:DR),
      c((b.apr||0).toFixed(2)+'%', i%2?DA:D),
    ]),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAOA);
  wsSummary['!cols'] = [{wch:30},{wch:22},{wch:12}];
  wsSummary['!rows'] = summaryAOA.map((_,i)=>({hpt:i===0?26:i===1?15:14}));
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // ── SHEET 2: INCOME ──────────────────────────────────────────
  const wsIncome = makeSheet(
    ['Source','Amount ($)','Frequency','Date','Actual Override ($)','Account'],
    data.income.map(i=>[
      i.source, fmtN(i.amount), i.frequency, fmtD(i.date),
      i.actualAmount?fmtN(i.actualAmount):null,
      (data.accounts||[]).find(a=>a.id===i.accountId)?.name||'',
    ]),
    [1,4]
  );
  wsIncome['!cols']=[{wch:28},{wch:14},{wch:14},{wch:16},{wch:20},{wch:20}];
  XLSX.utils.book_append_sheet(wb, wsIncome, 'Income');

  // ── SHEET 3: EXPENSES ────────────────────────────────────────
  const wsExp = makeSheet(
    ['Category','Description','Amount ($)','Frequency','Date','Account'],
    data.expenses.map(e=>[
      e.category, e.description||'', fmtN(e.amount),
      e.frequency||'', fmtD(e.date),
      (data.accounts||[]).find(a=>a.id===e.accountId)?.name||'',
    ]),
    [2]
  );
  wsExp['!cols']=[{wch:18},{wch:28},{wch:14},{wch:14},{wch:16},{wch:20}];
  XLSX.utils.book_append_sheet(wb, wsExp, 'Expenses');

  // ── SHEET 4: BILLS ───────────────────────────────────────────
  const wsBills = makeSheet(
    ['Name','Type','Min Payment ($)','Due Date','Recurring','Status','Balance ($)','APR (%)','Credit Limit ($)'],
    data.bills.map(b=>[
      b.name,
      b.btype==='creditcard'?'Credit Card':b.btype==='loan'?'Loan':'Bill',
      fmtN(b.amount), fmtD(b.dueDate), b.recurring||'', b.status||'',
      b.balance?fmtN(b.balance):null,
      b.apr?fmtN(b.apr):null,
      b.creditLimit?fmtN(b.creditLimit):null,
    ]),
    [2,6,7,8]
  );
  wsBills['!cols']=[{wch:24},{wch:14},{wch:16},{wch:14},{wch:12},{wch:12},{wch:14},{wch:10},{wch:16}];
  XLSX.utils.book_append_sheet(wb, wsBills, 'Bills');

  // ── SHEET 5: TRANSACTIONS ────────────────────────────────────
  const sorted=[...data.transactions].sort((a,b)=>b.date.localeCompare(a.date));
  const wsTxn = makeSheet(
    ['Date','Description','Type','Amount ($)','Category','Account','Card'],
    sorted.map(tx=>[
      fmtD(tx.date), tx.description, tx.type, fmtN(tx.amount),
      tx.category||'',
      tx.methodLabel||(data.accounts||[]).find(a=>a.id===tx.accountId)?.name||'',
      data.bills.find(b=>b.id===tx.cardId)?.name||'',
    ]),
    [3]
  );
  wsTxn['!cols']=[{wch:16},{wch:32},{wch:16},{wch:14},{wch:16},{wch:22},{wch:22}];
  XLSX.utils.book_append_sheet(wb, wsTxn, 'Transactions');

  // ── SHEET 6: NET WORTH ───────────────────────────────────────
  const accs   = (data.accounts||[]).map((a,i)=>[
    c(a.name,i%2?DA:D), c(a.type.charAt(0).toUpperCase()+a.type.slice(1),i%2?DA:D),
    c(fmtN(a.balance),i%2?DRA:DR), c(a.notes||'',i%2?DA:D)
  ]);
  const assets = (data.assets||[]).map((a,i)=>[
    c(a.name,i%2?DA:D), c(a.category.charAt(0).toUpperCase()+a.category.slice(1),i%2?DA:D),
    c(fmtN(a.value),i%2?DRA:DR), c(a.notes||'',i%2?DA:D)
  ]);
  const wsNW = XLSX.utils.aoa_to_sheet([
    [c('ACCOUNTS',SEC),c('',SEC),c('',SEC),c('',SEC)],
    [c('Name',H),c('Type',H),c('Balance ($)',HR),c('Notes',H)],
    ...accs,
    [c(''),c(''),c(''),c('')],
    [c('ASSETS',SEC),c('',SEC),c('',SEC),c('',SEC)],
    [c('Name',H),c('Category',H),c('Value ($)',HR),c('Notes',H)],
    ...assets,
    [c(''),c(''),c(''),c('')],
    [c('NET WORTH',{font:{name:'Arial',sz:11,bold:true}}),c(''),c(fmtN(netWorth),TOT),c('')],
  ]);
  wsNW['!cols']=[{wch:28},{wch:16},{wch:16},{wch:28}];
  XLSX.utils.book_append_sheet(wb, wsNW, 'Net Worth');

  // ── DOWNLOAD ─────────────────────────────────────────────────
  const filename=`FinanceOS-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast('Excel file downloaded!');
  markBackupDone();
}



// ── PROMO / 0% OFFER SYSTEM ───────────────────────────────────

let promoScenario = 'promo';

function setPromoScenario(s, btn){
  promoScenario = s;
  document.querySelectorAll('.promo-tab').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  // Reveal inputs on first tab click
  const inputs = $('promo-sim-inputs');
  if(inputs) inputs.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px';
  const actions = $('promo-sim-actions');
  if(actions) actions.style.display = 'block';
  // Clear previous result when switching tabs
  const res = $('promo-result'); if(res) res.innerHTML='';
  // Show/hide current APR field (transfer only)
  const wrap = $('promo-current-apr-wrap');
  if(wrap) wrap.style.display = s==='transfer' ? 'block' : 'none';
  const amtLabel = $('promo-amount-label');
  if(amtLabel) amtLabel.textContent = s==='transfer' ? 'Transfer Amount ($)' : 'Amount ($)';
  calcPromo();
}

function calcPromo(){
  const amount      = parseFloat($('promo-amount').value) || 0;
  const months      = parseInt($('promo-months').value)   || 0;
  const feeVal      = parseFloat($('promo-fee').value)    || 0;
  const feeType     = $('promo-fee-type').value;
  const regularApr  = parseFloat($('promo-regular-apr').value) || 0;
  const currentApr  = parseFloat($('promo-current-apr').value) || 0;
  const el          = $('promo-result');
  if(!el) return;

  if(!amount || !months){ el.innerHTML = ''; return; }

  // Fee calculation
  const feeCost = feeType==='percent' ? amount*(feeVal/100)
                : feeType==='fixed'   ? feeVal
                : 0;
  const totalOwed  = amount + feeCost;
  const monthlyNeeded = months > 0 ? totalOwed / months : totalOwed;

  // What if NOT paid off in time: interest on remaining at regularApr
  // Assume user pays monthlyNeeded - if they stop at month 0 (pays nothing)
  // Cost of carrying at regularApr for same period
  const regularRate = regularApr / 100 / 12;
  const interestIfKept = regularRate > 0
    ? amount * regularRate * (Math.pow(1+regularRate,months)-1) / (Math.pow(1+regularRate,months)) * months
    : 0;

  // For transfer: interest saved vs keeping debt at current APR
  let interestSaved = 0;
  if(promoScenario === 'transfer' && currentApr > 0){
    const curRate = currentApr / 100 / 12;
    const interestAtCurrentApr = curRate > 0
      ? amount * curRate * months
      : 0;
    interestSaved = Math.max(0, interestAtCurrentApr - feeCost);
  }

  // Verdict
  let verdict, verdictClass;
  if(promoScenario === 'transfer'){
    if(interestSaved > feeCost * 2){
      verdict = `Strong move - you save approximately ${usd(interestSaved)} in interest vs the ${usd(feeCost)} fee. Do it.`;
      verdictClass = 'go';
    } else if(interestSaved > 0){
      verdict = `Marginal - interest savings (${usd(interestSaved)}) barely exceed the fee (${usd(feeCost)}). Only worth it if you can pay it off.`;
      verdictClass = 'caution';
    } else {
      verdict = `Not recommended - the fee (${usd(feeCost)}) exceeds any interest savings at your current APR.`;
      verdictClass = 'nogo';
    }
  } else if(promoScenario === 'promo'){
    verdict = feeCost === 0
      ? `Free money if you pay ${usd(monthlyNeeded)}/mo and clear it by the end of the promo. Watch the expiry date!`
      : `Worth it if you pay ${usd(monthlyNeeded)}/mo to clear it in time. Fee is only ${usd(feeCost)}.`;
    verdictClass = feeCost < amount * 0.03 ? 'go' : 'caution';
  } else {
    verdict = feeCost === 0
      ? `Free - just pay ${usd(monthlyNeeded)}/mo to clear it in ${months} months.`
      : feeCost < amount * 0.05
      ? `Low cost - ${usd(feeCost)} fee to spread ${usd(amount)} over ${months} months. Pay ${usd(monthlyNeeded)}/mo.`
      : `High fee - ${usd(feeCost)} (${feeType==='percent'?feeVal+'%':'fixed'}) on ${usd(amount)}. Make sure you can pay ${usd(monthlyNeeded)}/mo.`;
    verdictClass = feeCost < amount*0.03 ? 'go' : feeCost < amount*0.06 ? 'caution' : 'nogo';
  }

  const items = [
    {label:'Fee Cost', val:usd(feeCost), color: feeCost===0?'var(--green)':feeCost<amount*0.05?'var(--yellow)':'var(--red)'},
    {label:'Total to Pay Back', val:usd(totalOwed), color:'var(--text)'},
    {label:'Monthly Needed', val:usd(monthlyNeeded)+'/mo', color:'var(--accent)'},
    {label: promoScenario==='transfer'?'Interest Saved':'Interest If Late', 
     val: promoScenario==='transfer'?usd(interestSaved):usd(interestIfKept),
     color: promoScenario==='transfer'?'var(--green)':'var(--red)'},
  ];

  el.innerHTML = `
    <div class="promo-result">
      <div class="promo-result-grid">
        ${items.map(i=>`
          <div class="promo-result-item">
            <div class="promo-result-label">${i.label}</div>
            <div class="promo-result-val" style="color:${i.color}">${i.val}</div>
          </div>`).join('')}
      </div>
      <div class="promo-verdict ${verdictClass}">${verdict}</div>
    </div>`;
}

function trackPromo(){
  const amount  = parseFloat($('promo-amount').value) || 0;
  const months  = parseInt($('promo-months').value) || 0;
  const feeVal  = parseFloat($('promo-fee').value) || 0;
  const feeType = $('promo-fee-type').value;
  const rapr    = parseFloat($('promo-regular-apr').value) || 0;
  if(!amount || !months){ showToast('Enter amount and months first','error'); return; }

  const feeCost       = feeType==='percent'?amount*(feeVal/100):feeType==='fixed'?feeVal:0;
  const totalOwed     = parseFloat((amount+feeCost).toFixed(2));
  const monthlyNeeded = parseFloat((totalOwed/months).toFixed(2));
  const endDate       = new Date(); endDate.setMonth(endDate.getMonth()+months);
  const endDateStr    = endDate.toISOString().split('T')[0];

  // Set modal title
  const titles = {promo:'🎁 Track Promo APR', transfer:'🔄 Track Balance Transfer'};
  const titleEl = $('promo-modal-title');
  if(titleEl) titleEl.textContent = titles[promoScenario]||'Track Promo';
  $('promo-modal-scenario').value = promoScenario;

  // Show/hide scenario sections
  $('promo-apr-fields').style.display      = promoScenario==='promo'    ?'block':'none';
  $('promo-transfer-fields').style.display = promoScenario==='transfer' ?'block':'none';

  const creditCards = data.bills.filter(b=>b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo');
  const accounts    = data.accounts||[];

  if(promoScenario==='promo'){
    // Card selector
    const cardSel = $('promo-apr-card');
    if(cardSel) cardSel.innerHTML =
      '<option value="">-- Select card --</option>'
      +'<option value="new">+ Create New Card</option>'
      + creditCards.map(b=>`<option value="${b.id}">${b.name} (${usd(b.balance)} @ ${b.apr}% APR)</option>`).join('');
    if($('promo-apr-new-fields')) $('promo-apr-new-fields').style.display='none';
    // Deposit account selector
    const destSel = $('promo-apr-dest');
    if(destSel) destSel.innerHTML =
      '<option value="">-- Select account --</option>'
      + accounts.map(a=>`<option value="${a.id}">${acTypeIcon[a.type]||''} ${a.name} (${usd(a.balance)})</option>`).join('');
    const defId = getDefaultAccountId();
    if(destSel && defId) destSel.value = defId;
    if($('promo-apr-draw-check')) $('promo-apr-draw-check').checked = false;
    if($('promo-apr-draw-dest-wrap')) $('promo-apr-draw-dest-wrap').style.display='none';
    const balLabel = $('promo-bal-label');
    if(balLabel) balLabel.textContent = 'Balance / Draw Amount ($)';
  }

  if(promoScenario==='transfer'){
    const srcWrap = $('promo-transfer-sources');
    if(srcWrap) srcWrap.innerHTML = creditCards.map(b=>`
      <div class="promo-card-toggle" id="ptog-${b.id}" onclick="togglePromoCard(${b.id})">
        <div class="pct-left">
          <div class="pct-check" id="ptog-check-${b.id}"></div>
          <div class="pct-info">
            <div class="pct-name">${b.name}</div>
            <div class="pct-sub">${b.apr}% APR</div>
          </div>
        </div>
        <div class="pct-bal">${usd(b.balance)}</div>
      </div>`).join('');
    // Reset selection state
    if(typeof _promoSelectedCards !== 'undefined') _promoSelectedCards = new Set();
    const destSel = $('promo-transfer-dest');
    if(destSel) destSel.innerHTML =
      '<option value="">-- Select or create new card --</option>'
      +'<option value="new">+ Create New Card</option>'
      + creditCards.map(b=>`<option value="${b.id}">${b.name} (${usd(b.balance)} balance)</option>`).join('');
    destSel.value='';
    $('promo-new-card-fields').style.display='none';
    const balLabel = $('promo-bal-label');
    if(balLabel) balLabel.textContent = 'Total Transfer Amount ($)';
  }

  // Pre-fill shared fields
  $('promo-id').value      = '';
  $('promo-bal').value     = totalOwed;
  $('promo-pay').value     = monthlyNeeded;
  $('promo-papr').value    = 0;
  $('promo-end').value     = endDateStr;
  $('promo-rapr').value    = rapr;
  $('promo-feepaid').value = feeCost>0 ? feeCost.toFixed(2) : '';
  const note = $('promo-summary-note'); if(note) note.style.display='none';
  $('modal-promo').classList.add('open');
}

function togglePromoDrawDest(){
  const checked = $('promo-apr-draw-check').checked;
  const wrap = $('promo-apr-draw-dest-wrap');
  if(wrap) wrap.style.display = checked ? 'block' : 'none';
}

function onPromoAprCardChange(){
  const val = $('promo-apr-card').value;
  if($('promo-apr-new-fields')) $('promo-apr-new-fields').style.display = val==='new'?'block':'none';
  if(val && val!=='new'){
    const b = data.bills.find(x=>x.id===parseInt(val));
    if(b){
      $('promo-bal').value  = b.balance||0;
      $('promo-rapr').value = b.regularApr||b.apr||0;
      const months = parseInt($('promo-months').value)||0;
      if(months && b.balance) $('promo-pay').value = parseFloat((b.balance/months).toFixed(2));
    }
  }
}

function onPromoTransferDestChange(){
  const val = $('promo-transfer-dest').value;
  $('promo-new-card-fields').style.display = val==='new'?'block':'none';
  updateTransferTotal();
}

// Legacy - kept for safety



let _promoSelectedCards = new Set();

function togglePromoCard(id){
  const tog = $('ptog-'+id);
  const chk = $('ptog-check-'+id);
  if(!tog) return;
  if(_promoSelectedCards.has(id)){
    _promoSelectedCards.delete(id);
    tog.classList.remove('selected');
    if(chk) chk.textContent = '';
  } else {
    _promoSelectedCards.add(id);
    tog.classList.add('selected');
    if(chk) chk.textContent = '✓';
  }
  updateTransferTotal();
}

function updateTransferTotal(){
  let total = 0;
  const names = [];
  _promoSelectedCards.forEach(id=>{
    const b = data.bills.find(x=>x.id===id);
    if(b){ total += b.balance||0; names.push(b.name); }
  });

  const feeVal  = parseFloat($('promo-fee').value)||0;
  const feeType = $('promo-fee-type').value;
  const fee     = feeType==='percent'?total*(feeVal/100):feeType==='fixed'?feeVal:0;
  const totalOwed = parseFloat((total+fee).toFixed(2));
  const months    = parseInt($('promo-months').value)||0;

  if(total>0){
    $('promo-bal').value = totalOwed;
    if(months) $('promo-pay').value = parseFloat((totalOwed/months).toFixed(2));
    const note = $('promo-summary-note');
    if(note){
      note.style.display='block';
      note.innerHTML=`Transferring <strong>${usd(total)}</strong> from ${names.join(', ')}${fee>0?' + <strong>'+usd(fee)+'</strong> fee':''} = <strong>${usd(totalOwed)}</strong> on destination card.`;
    }
  } else {
    const note = $('promo-summary-note'); if(note) note.style.display='none';
  }

  // ── Credit limit check ──────────────────────────────────────
  const warn = $('promo-limit-warn');
  if(!warn){ return; }
  const destVal = $('promo-transfer-dest').value;
  let limit = 0;
  if(destVal === 'new'){
    limit = parseFloat($('promo-new-card-limit').value)||0;
  } else if(destVal){
    const destCard = data.bills.find(b=>b.id===parseInt(destVal));
    limit = destCard ? (destCard.creditLimit||0) - (destCard.balance||0) : 0;
  }
  if(limit>0 && totalOwed>limit){
    warn.style.display = 'block';
    warn.textContent = `Total (${usd(totalOwed)}) exceeds available credit (${usd(limit)}) on destination card by ${usd(totalOwed-limit)}.`;
  } else {
    warn.style.display = 'none';
  }
}

function savePromoDebt(){
  const scenario = $('promo-modal-scenario').value;
  const bal      = parseFloat($('promo-bal').value)||0;
  const pay      = parseFloat($('promo-pay').value)||0;
  const papr     = parseFloat($('promo-papr').value)||0;
  const endDate  = $('promo-end').value;
  const rapr     = parseFloat($('promo-rapr').value)||0;
  const feePaid  = parseFloat($('promo-feepaid').value)||0;
  if(!bal)    { showToast('Enter a balance','error'); return; }
  if(!endDate){ showToast('Enter a promo end date','error'); return; }

  // ── PROMO APR (combined draw + intro) ────────────────────────
  if(scenario==='promo'){
    const cardVal = $('promo-apr-card').value;
    if(!cardVal){ showToast('Select or create a card','error'); return; }

    let card;
    if(cardVal==='new'){
      const nm  = ($('promo-apr-new-name').value||'').trim();
      const lim = parseFloat($('promo-apr-new-limit').value)||0;
      if(!nm){ showToast('Enter a name for the new card','error'); return; }
      const nextDue1=(()=>{const d=new Date();d.setMonth(d.getMonth()+1);return d.toISOString().split('T')[0];})();
      card = {
        id:Date.now(), name:nm, btype:'creditcard',
        balance:bal, amount:pay, dueDate:nextDue1,
        recurring:'Monthly', status:'Pending',
        apr:papr, creditLimit:lim,
        promoEndDate:endDate, regularApr:rapr,
        promoFee:feePaid, promoScenario:'promo',
        originalBalance:bal,
      };
      data.bills.push(card);
    } else {
      card = data.bills.find(b=>b.id===parseInt(cardVal));
      if(!card){ showToast('Card not found','error'); return; }
      // Store original APR before overwriting
      if(!card.regularApr) card.regularApr = card.apr;
      card.apr           = papr;
      card.promoEndDate  = endDate;
      card.regularApr    = rapr || card.regularApr || 0;
      card.promoFee      = feePaid;
      card.promoScenario = 'promo';
      card.amount        = pay || card.amount;
      // Add draw amount to card balance if it's a cash draw
      const isDraw = $('promo-apr-draw-check').checked;
      if(isDraw && bal > (card.balance||0)){
        card.balance = bal; // balance set to draw amount (already includes fee)
      }
      if(!card.originalBalance || card.balance > card.originalBalance)
        card.originalBalance = card.balance;
    }

    // Cash draw: deposit to account
    const isDraw = $('promo-apr-draw-check').checked;
    if(isDraw){
      const destId = parseInt($('promo-apr-dest').value)||0;
      if(!destId){ showToast('Select a deposit account','error'); return; }
      adjustAccountBalance(destId, bal - feePaid);
      data.transactions.push({
        id:Date.now(), description:'Cash draw - '+card.name,
        amount:bal-feePaid, type:'Withdrawal', date:today(),
        accountId:destId, methodLabel:card.name
      });
    }

    updateOriginalBalances();
    closeModal('promo'); saveData(); renderSections('bills','dashboard','debt','networth');
    showToast('Promo applied to '+card.name+'!'); return;
  }

  // ── BALANCE TRANSFER ─────────────────────────────────────────
  if(scenario==='transfer'){
    if(!_promoSelectedCards.size){ showToast('Select at least one source card','error'); return; }
    const checked = [..._promoSelectedCards].map(id=>({dataset:{id}}));
    const destVal = $('promo-transfer-dest').value;
    if(!destVal){ showToast('Select or create a destination card','error'); return; }

    let destCard;
    if(destVal==='new'){
      const nm  = ($('promo-new-card-name').value||'').trim();
      const lim = parseFloat($('promo-new-card-limit').value)||0;
      if(!nm){ showToast('Enter a name for the new card','error'); return; }
      const nextDue2=(()=>{const d=new Date();d.setMonth(d.getMonth()+1);return d.toISOString().split('T')[0];})();
      destCard = {
        id:Date.now(), name:nm, btype:'creditcard',
        balance:0, amount:pay, dueDate:nextDue2,
        recurring:'Monthly', status:'Pending',
        apr:papr, creditLimit:lim,
        promoEndDate:endDate, regularApr:rapr,
        promoFee:feePaid, promoScenario:'transfer',
        originalBalance:0,
      };
      data.bills.push(destCard);
    } else {
      destCard = data.bills.find(b=>b.id===parseInt(destVal));
      if(!destCard){ showToast('Destination card not found','error'); return; }
      if(!destCard.regularApr) destCard.regularApr = destCard.apr;
      destCard.apr           = papr;
      destCard.promoEndDate  = endDate;
      destCard.regularApr    = rapr || destCard.regularApr || 0;
      destCard.promoFee      = feePaid;
      destCard.promoScenario = 'transfer';
      destCard.amount        = pay || destCard.amount;
    }

    // Zero out source cards + move balances to destination
    let totalTransferred = 0;
    checked.forEach(cb=>{
      const src = data.bills.find(b=>b.id===(typeof cb==='number'?cb:parseInt(cb.dataset.id)));
      if(!src) return;
      totalTransferred += src.balance||0;
      data.transactions.push({
        id:Date.now()+Math.random(),
        description:'Balance transfer to '+destCard.name,
        amount:parseFloat((src.balance||0).toFixed(2)),
        type:'Debt Payment', date:today(),
        accountId:0, methodLabel:destCard.name
      });
      src.balance = 0; src.status = 'Paid';
      // Note: in reality transfer takes 3-7 days; balance zeroed immediately for tracking simplicity
    });

    destCard.balance = parseFloat((totalTransferred+feePaid).toFixed(2));
    if(!destCard.originalBalance || destCard.balance > destCard.originalBalance)
      destCard.originalBalance = destCard.balance;

    updateOriginalBalances();
    // Store transfer record for pending notification
    data._pendingTransfers = data._pendingTransfers||[];
    data._pendingTransfers.push({
      date: today(), destName: destCard.name,
      amount: totalTransferred, fee: feePaid,
      completionDate: (()=>{const d=new Date();d.setDate(d.getDate()+5);return d.toISOString().split('T')[0];})()
    });
    closeModal('promo'); saveData(); renderSections('bills','dashboard','debt','networth');
    showToast('Transfer initiated - '+usd(totalTransferred)+' moving to '+destCard.name+' (3-5 business days)');
    return;
  }
}


// ── AUTO EXPIRE PROMOS ────────────────────────────────────────
function autoExpirePromos(){
  const todayStr = today();
  let changed = false;
  data.bills.forEach(b=>{
    // Apply to any bill type that has a promoEndDate set
    if(!b.promoEndDate || b.promoEndDate > todayStr) return;
    if(b.regularApr == null || b.apr === b.regularApr) return; // already expired or no promo
    b.apr = b.regularApr;
    changed = true;
  });
  if(changed) saveData();
}

// ── PROMO BADGE HELPER ────────────────────────────────────────
function getPromoBadgeHtml(b){
  if(!b.promoEndDate || b.regularApr == null) return '';
  const daysLeft = Math.round((new Date(b.promoEndDate) - new Date()) / 86400000);
  const monthsLeft = Math.ceil(daysLeft / 30);
  const monthlyNeeded = monthsLeft > 0 ? b.balance / monthsLeft : b.balance;

  if(daysLeft < 0){
    return `<div class="promo-badge danger">🔴 Promo EXPIRED - now ${b.regularApr||0}% APR</div>`;
  }
  const badgeClass = daysLeft <= 30 ? 'danger' : daysLeft <= 60 ? 'warn' : '';
  const icon = daysLeft <= 30 ? '🚨' : daysLeft <= 60 ? '⚠️' : '🎁';
  return `
    <div class="promo-badge ${badgeClass}">${icon} 0% promo: ${daysLeft}d left (${b.regularApr||0}% after)</div>
    <div class="promo-needed">Pay ${usd(monthlyNeeded)}/mo to clear before expiry</div>`;
}



// ── PROMO PURCHASE TRACKER ────────────────────────────────────

let _promoType = 'deferred'; // 'deferred' | 'installment'

function togglePromoFields(){
  const check = $('pu-promo-check');
  const fields = $('pu-promo-fields');
  if(!check||!fields) return;
  // If called from row click, toggle the checkbox manually
  if(document.activeElement !== check) check.checked = !check.checked;
  fields.style.display = check.checked ? 'block' : 'none';
  if(check.checked) calcPromoRequired();
}

function setPromoType(type){
  _promoType = type;
  ['deferred','installment'].forEach(t=>{
    const btn = $('ptype-'+t);
    if(btn) btn.classList.toggle('active', t===type);
  });
  // Show/hide APR field (deferred only)
  const aprWrap = $('pu-deferred-apr-wrap');
  if(aprWrap) aprWrap.style.display = type==='deferred' ? 'block' : 'none';
  calcPromoRequired();
}

function calcPromoRequired(){
  const amt    = parseFloat($('pu-amount').value) || 0;
  const months = parseInt($('pu-promo-months').value) || 0;
  const apr    = parseFloat($('pu-promo-apr').value) || 0;
  const calc   = $('pu-promo-calc');
  if(!calc) return;
  if(!amt || !months){ calc.style.display='none'; return; }

  const monthly = parseFloat((amt/months).toFixed(2));
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth()+months);
  const endStr = endDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

  if(_promoType==='deferred'){
    const dailyRate = apr/100/365;
    const projectedInterest = parseFloat((amt * dailyRate * months * 30).toFixed(2));
    calc.style.display='block';
    calc.innerHTML = `Pay <strong>${usd(monthly)}/mo</strong> to clear by <strong>${endStr}</strong><br>`
      + (apr>0 ? `<span class="txt-red">Miss deadline = <strong>${usd(projectedInterest)}</strong> in deferred interest charged retroactively</span>` : '');
  } else {
    calc.style.display='block';
    calc.innerHTML = `Fixed <strong>${usd(monthly)}/mo</strong> for ${months} months &mdash; paid off by <strong>${endStr}</strong>`;
  }
}

// ── PROMO ITEM RENDERING IN BILLS ─────────────────────────────
function getPromoItemsForCard(cardId){
  if(!cardId) return [];
  return data.transactions.filter(tx=>
    tx.cardId===cardId && tx.promoType && tx.promoEnd
  );
}


function renderPromoItems(cardId){
  const items = getPromoItemsForCard(cardId);
  if(!items.length) return '';

  const todayStr = today();
  const rows = items.map(tx=>{
    const daysLeft = Math.round((new Date(tx.promoEnd)-new Date())/86400000);
    const monthsLeft = Math.max(1, Math.ceil(daysLeft/30));
    const paidToward = data.transactions
      .filter(t=>t.promoRef===tx.id)
      .reduce((s,t)=>s+t.amount,0);
    const remaining = Math.max(0, tx.amount - paidToward);
    const pct = tx.amount>0 ? Math.min(100, Math.round(paidToward/tx.amount*100)) : 0;
    const monthlyNeeded = monthsLeft>0 ? parseFloat((remaining/monthsLeft).toFixed(2)) : remaining;
    const isExpired = daysLeft < 0;
    const isDanger = daysLeft>=0 && daysLeft<=30;
    const isWarn = daysLeft>30 && daysLeft<=60;

    let rowClass = tx.promoType;
    if(isExpired||isDanger) rowClass+=' danger';

    let deadlineHtml='';
    if(isExpired){
      deadlineHtml=`<div class="pi-deadline" class="txt-red">EXPIRED ${Math.abs(daysLeft)}d ago</div>`;
      deadlineHtml += getDeferredInterestWarning(tx, remaining, daysLeft);
    } else if(isDanger){
      deadlineHtml=`<div class="pi-deadline" class="txt-red">&#128680; ${daysLeft}d left - pay ${usd(remaining)} now!</div>`;
      deadlineHtml += getDeferredInterestWarning(tx, remaining, daysLeft);
    } else if(isWarn){
      deadlineHtml += getDeferredInterestWarning(tx, remaining, daysLeft);
      deadlineHtml=`<div class="pi-deadline" class="txt-yellow">&#9888;&#65039; ${daysLeft}d left &mdash; ${usd(monthlyNeeded)}/mo needed</div>`;
    } else {
      const endFmt = new Date(tx.promoEnd).toLocaleDateString('en-US',{month:'short',year:'numeric'});
      deadlineHtml=`<div class="pi-deadline" class="txt-muted">${tx.promoType==='deferred'?'Pay in full by':'Last payment'}: ${endFmt}</div>`;
    }

    const barColor = isExpired||isDanger?'var(--red)':isWarn?'var(--yellow)':'var(--accent)';

    return `<div class="promo-item-row ${rowClass}">
      <div class="pi-left">
        <div class="pi-desc">${tx.promoType==='deferred'?'&#9888;&#65039;':'&#128197;'} ${tx.description}</div>
        <div class="pi-sub">${fmtDate(tx.date)} &bull; ${tx.promoType==='deferred'?'Deferred Interest':'Installment'} &bull; ${tx.promoMonths||0}mo</div>
        ${deadlineHtml}
        <div class="pi-progress"><div class="pi-progress-fill" style="width:${pct}%;background:${barColor}"></div></div>
      </div>
      <div class="pi-right">
        <div class="pi-amount" style="color:${remaining>0?'var(--text)':'var(--green)'}">${usd(remaining)}</div>
        <div class="pi-monthly">${remaining>0?usd(monthlyNeeded)+'/mo needed':'Paid off!'}</div>
        <div class="pi-monthly" class="txt-muted">${pct}% paid</div>
      </div>
    </div>`;
  }).join('');

  const totalRemaining = items.reduce((s,tx)=>{
    const paid = data.transactions.filter(t=>t.promoRef===tx.id).reduce((s2,t)=>s2+t.amount,0);
    return s + Math.max(0,tx.amount-paid);
  },0);

  const hasDanger=items.some(tx=>{
    const daysLeft=Math.round((new Date(tx.promoEnd)-new Date())/86400000);
    return daysLeft<0||daysLeft<=30;
  });

  // Collapsed by default unless there's a danger item
  const collapseId='promo-collapse-'+cardId;
  const isOpen=hasDanger; // danger items auto-expand

  return `<div class="promo-items-wrap">
    <button onclick="togglePromoCollapse('${collapseId}')" style="width:100%;background:none;border:none;display:flex;align-items:center;gap:8px;padding:0 0 6px;cursor:pointer;text-align:left">
      <span class="promo-items-header" style="margin:0;flex:1">🎁 ${items.length} promo${items.length>1?'s':''} · ${usd(totalRemaining)} remaining${hasDanger?' 🚨':''}</span>
      <span id="${collapseId}-chev" class="txt-muted-sm">${isOpen?'▴':'▾'}</span>
    </button>
    <div id="${collapseId}" style="display:${isOpen?'block':'none'}">
      ${rows}
    </div>
  </div>`;
}

function togglePromoCollapse(id){
  const el=$(id);
  const chev=$(id+'-chev');
  if(!el) return;
  const open=el.style.display==='block';
  el.style.display=open?'none':'block';
  if(chev) chev.textContent=open?'▾':'▴';
}
// confirmPurchase — promo logic merged into base function above




// ── SPLIT BALANCE HELPERS ─────────────────────────────────────

function getPromoBalance(billId){
  // Sum of active (unpaid) promo purchase amounts on this card
  return data.transactions
    .filter(tx => tx.cardId===billId && tx.promoType && tx.promoEnd && tx.amount>0)
    .reduce((s,tx)=>{
      const paid = data.transactions
        .filter(t=>t.promoRef===tx.id)
        .reduce((s2,t)=>s2+t.amount, 0);
      return s + Math.max(0, tx.amount - paid);
    }, 0);
}

function getRevolvingBalance(b){
  // revolvingBalance stored explicitly, or inferred
  if(b.revolvingBalance != null) return b.revolvingBalance;
  // Fallback: total minus promo
  const promoTotal = getPromoBalance(b.id);
  return Math.max(0, (b.balance||0) - promoTotal);
}

function migrateRevolvingBalance(b){
  // Called on load - set revolvingBalance if not yet set
  if(b.revolvingBalance == null){
    b.revolvingBalance = Math.max(0, (b.balance||0) - getPromoBalance(b.id));
  }
}

// ── OPEN PAY DEBT - ENHANCED ──────────────────────────────────
// openPayDebt — promo logic merged into base function above

function buildAllocRows(b){
  const revolving = getRevolvingBalance(b);
  const monthlyRate = (b.apr||0)/100/12;
  const revInterest = parseFloat((revolving * monthlyRate).toFixed(2));
  const revMinimum = revolving>0 ? parseFloat((revInterest + revolving*0.01).toFixed(2)) : 0;

  // Hint on revolving input
  if($('pd-alloc-revolving-hint'))
    $('pd-alloc-revolving-hint').textContent =
      revolving>0 ? `${usd(revolving)} balance - ${usd(revInterest)}/mo interest` : 'No revolving balance';

  if($('pd-alloc-revolving')) $('pd-alloc-revolving').value = revolving>0 ? revMinimum.toFixed(2) : '0';

  // Promo item rows sorted by soonest expiry
  const promoItems = data.transactions
    .filter(tx=>tx.cardId===b.id && tx.promoType && tx.promoEnd)
    .map(tx=>{
      const paid = data.transactions.filter(t=>t.promoRef===tx.id).reduce((s,t)=>s+t.amount,0);
      const remaining = Math.max(0, tx.amount-paid);
      const daysLeft = Math.round((new Date(tx.promoEnd)-new Date())/86400000);
      const monthsLeft = Math.max(1, Math.ceil(daysLeft/30));
      return {...tx, remaining, daysLeft, monthsLeft, monthlyNeeded: parseFloat((remaining/monthsLeft).toFixed(2))};
    })
    .filter(tx=>tx.remaining>0.01)
    .sort((a,b)=>a.daysLeft-b.daysLeft);

  const wrap = $('pd-alloc-promo-rows');
  if(!wrap) return;
  wrap.innerHTML = promoItems.map((tx,i)=>{
    const urgentClass = tx.daysLeft<=30?'urgent':'';
    const icon = tx.promoType==='deferred'?'&#9888;&#65039;':'&#128197;';
    return `<div class="alloc-row">
      <div class="alloc-label">
        <div class="alloc-promo-item ${urgentClass}">${icon} ${tx.description}</div>
        <div style="font-size:10px;color:${tx.daysLeft<=30?'var(--red)':'var(--muted)'}">
          ${tx.daysLeft>0?tx.daysLeft+'d left':'EXPIRED'} &bull; ${usd(tx.remaining)} remaining
        </div>
      </div>
      <input class="alloc-input" id="pd-alloc-promo-${tx.id}" type="number"
        inputmode="decimal" placeholder="0.00" data-promo-id="${tx.id}"
        value="${tx.monthlyNeeded.toFixed(2)}"
        oninput="onAllocInput('promo')"/>
    </div>`;
  }).join('');

  updateAllocTotal(b);
}

function onAllocInput(type){
  const id = _payDebtId;
  const b = data.bills.find(x=>x.id===id);
  if(!b) return;
  updateAllocTotal(b);
  // Sync total to pd-custom so existing payment flow works
  const total = getAllocTotal();
  if($('pd-custom')) $('pd-custom').value = total>0 ? total.toFixed(2) : '';
  selectPayAmount('custom');
}

function getAllocTotal(){
  const rev = parseFloat($('pd-alloc-revolving')?.value)||0;
  let promoSum = 0;
  document.querySelectorAll('[id^="pd-alloc-promo-"]').forEach(inp=>{
    promoSum += parseFloat(inp.value)||0;
  });
  return parseFloat((rev+promoSum).toFixed(2));
}

function updateAllocTotal(b){
  const total = getAllocTotal();
  const totalEl = $('pd-alloc-total');
  if(totalEl) totalEl.textContent = usd(total);

  const warn = $('pd-alloc-warn');
  if(!warn) return;
  if(total > (b.balance||0)){
    warn.style.display='block';
    warn.textContent = 'Total exceeds card balance by '+usd(total-(b.balance||0));
  } else {
    warn.style.display='none';
  }
}

// ── CONFIRM DEBT PAYMENT - ENHANCED ──────────────────────────
// confirmDebtPayment — promo logic merged into base function above
function getBalanceSplitHtml(b){
  const rev = getRevolvingBalance(b);
  const promo = Math.max(0,(b.balance||0)-rev);
  if(promo>0.01){
    return '<span class="txt-red">Revolving: '+usd(rev)+'</span>'
      +' &bull; <span class="txt-accent">Promo: '+usd(promo)+'</span>'
      +' &bull; Total: '+usd(b.balance)+(b.apr?' | APR: '+pct(b.apr):'');
  }
  return 'Balance: '+usd(b.balance)+(b.apr?' | APR: '+pct(b.apr):'');
}


// ── FEATURE 1: PROMO SORT EXPLANATION ────────────────────────
function getPromoSortNote(d){
  // d = item from calcDebtPlan - has promoEndDate if it came from a promo card
  const bill = data.bills.find(b=>b.id===d.id);
  if(!bill || !bill.promoEndDate) return '';
  const daysLeft = Math.round((new Date(bill.promoEndDate)-new Date())/86400000);
  if(daysLeft < 0){
    return `<div class="promo-sort-note">&#9888; Promo expired - now ${pct(bill.regularApr||0)} APR</div>`;
  }
  const endFmt = new Date(bill.promoEndDate).toLocaleDateString('en-US',{month:'short',year:'numeric'});
  return `<div class="promo-sort-note">&#127873; 0% promo - sorted last intentionally. Expires ${endFmt}, then ${pct(bill.regularApr||0)} APR</div>`;
}

// ── FEATURE 2: ACCOUNT BALANCE CORRECTION ────────────────────
function correctBalance(id){
  const inp = $('bal-correct-'+id);
  if(!inp) return;
  const newBal = parseFloat(inp.value);
  if(isNaN(newBal)){ showToast('Enter a valid balance','error'); return; }
  const acc = (data.accounts||[]).find(a=>a.id===id);
  if(!acc) return;
  const diff = parseFloat((newBal - acc.balance).toFixed(2));
  acc.balance = parseFloat(newBal.toFixed(2));
  saveData(); renderSections('dashboard','networth','bills','debt');
  const msg = diff===0 ? 'Balance unchanged'
    : diff>0 ? 'Balance corrected +'+usd(diff)
    : 'Balance corrected -'+usd(Math.abs(diff));
  showToast(msg);
}

// ── FEATURE 3: OVERLAP DETECTION ─────────────────────────────
// Returns true if two strings share at least one word of 4+ characters.
// This avoids false positives from short tokens like "net", "my", "gas".
function _sharesSignificantWord(a, b){
  const wordsOf = s => s.toLowerCase().trim().split(/\s+/).filter(w => w.length >= 4);
  const wb = new Set(wordsOf(b));
  return wordsOf(a).some(w => wb.has(w));
}

function checkBillExpenseOverlap(name, warnId){
  if(!name || name.length < 3) return false;
  const nameLower = name.toLowerCase().trim();
  const warn = $(warnId);
  if(!warn) return false;

  // Check expenses for similar description
  const matchingExp = data.expenses.find(e=>{
    const d = (e.description||'').toLowerCase();
    return d === nameLower || _sharesSignificantWord(e.description||'', name);
  });

  // Check bills for similar name
  const matchingBill = data.bills.find(b=>{
    const n = (b.name||'').toLowerCase();
    return n === nameLower || _sharesSignificantWord(b.name||'', name);
  });

  if(matchingExp && warnId==='bill-overlap-warn'){
    warn.style.display='block';
    warn.innerHTML='&#9888; Heads up: "'+matchingExp.description+'" already exists as an expense in Cash Flow. Adding this as a bill too will double-count it in your totals.';
    return true;
  }
  if(matchingBill && warnId==='expense-overlap-warn'){
    warn.style.display='block';
    warn.innerHTML='&#9888; Heads up: "'+matchingBill.name+'" already exists as a bill. Adding it as an expense too will double-count it in Cash Flow.';
    return true;
  }
  warn.style.display='none';
  return false;
}

function clearOverlapWarn(warnId){
  const warn = $(warnId);
  if(warn) warn.style.display='none';
}



// ── BI-WEEKLY PAYCHECK CALCULATOR ────────────────────────────

function onIncomeFreqChange(){
  const freq = $('i-freq').value;
  const wrap = $('i-lastpay-wrap');
  const actualWrap = $('i-actual-wrap');
  if(wrap) wrap.style.display = freq==='Bi-weekly' ? 'block' : 'none';
  if(actualWrap) actualWrap.style.display = (freq!=='One-time') ? 'block' : 'none';
}

function getPaycheckDates(income, year, month){
  // Returns array of Date objects for paychecks in the given year/month
  if(income.frequency !== 'Bi-weekly' || !income.lastPayDate) return null;

  const anchor = new Date(income.lastPayDate + 'T12:00:00');
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month+1, 0); // last day

  // Walk backward from anchor until we're before monthStart
  let d = new Date(anchor);
  while(d > monthEnd)   d.setDate(d.getDate() - 14);
  while(d < monthStart) d.setDate(d.getDate() + 14);

  // Collect all paychecks within the month
  const dates = [];
  while(d <= monthEnd){
    if(d >= monthStart) dates.push(new Date(d));
    d.setDate(d.getDate() + 14);
  }
  return dates;
}


let _paycheckCalOpen = true;

// ── #5 BILL RESET BANNER ─────────────────────────────────────
function checkBillResetNotify(){
  const raw = localStorage.getItem('financeOS_billResetNotify');
  if(!raw) return;
  try{
    const n = JSON.parse(raw);
    const banner = $('bill-reset-banner');
    const msg = $('bill-reset-msg');
    if(!banner||!msg) return;
    const monthFmt = new Date(n.month+'-15').toLocaleString('default',{month:'long',year:'numeric'});
    const nameList = n.names.join(', ')+(n.count>3?' +more':'');
    msg.textContent = n.count+' bill'+(n.count>1?'s':'')+' reset to Pending for '+monthFmt+': '+nameList+'. This happens automatically each month so you can track payments.';
    banner.style.display = 'block';
  } catch(e){}
}
function dismissBillResetBanner(){
  localStorage.removeItem('financeOS_billResetNotify');
  renderNotificationCenter();
}

// ── #4 TRANSFER PENDING BANNER ────────────────────────────────
function checkTransferBanner(){
  const transfers = data._pendingTransfers||[];
  const banner = $('transfer-banner');
  if(!banner) return;
  const pending = transfers.filter(t=>t.completionDate >= today());
  if(!pending.length){ banner.style.display='none'; return; }
  banner.style.display='block';
  banner.innerHTML = pending.map(t=>`
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span>&#8987; <strong>${usd(t.amount)}</strong> transfer to ${t.destName} - completes ~${fmtDate(t.completionDate)}</span>
      <button onclick="dismissTransfer('${t.date}')" style="background:none;border:none;color:var(--yellow);cursor:pointer;font-size:16px">&#x2715;</button>
    </div>`).join('');
}
function dismissTransfer(date){
  data._pendingTransfers=(data._pendingTransfers||[]).filter(t=>t.date!==date);
  saveData(); renderNotificationCenter();
}

// ── #7 PROMO PAYMENT GAP - simple card payment reduces promo items ──
// Hook into the NON-allocation payment path (original confirmDebtPayment)
// When hasPromo=false but card has promo items, apply payment to oldest promo first
function applyGeneralPaymentToPromos(billId, paymentAmount){
  const promoItems = data.transactions
    .filter(tx=>tx.cardId===billId && tx.promoType && tx.promoEnd && tx.amount>0)
    .map(tx=>{
      const paid = data.transactions.filter(t=>t.promoRef===tx.id).reduce((s,t)=>s+t.amount,0);
      return {...tx, remaining: Math.max(0, tx.amount-paid)};
    })
    .filter(tx=>tx.remaining>0.01)
    .sort((a,b)=>a.promoEnd.localeCompare(b.promoEnd)); // pay soonest-expiring first

  if(!promoItems.length) return 0;
  const b = data.bills.find(x=>x.id===billId);
  if(!b) return 0;
  migrateRevolvingBalance(b);

  let remaining = paymentAmount;
  let applied = 0;

  promoItems.forEach(tx=>{
    if(remaining <= 0) return;
    const toApply = Math.min(remaining, tx.remaining);
    if(toApply < 0.01) return;
    data.transactions.push({
      id: Date.now()+Math.random(),
      description: b.name+' - promo: '+tx.description,
      amount: parseFloat(toApply.toFixed(2)),
      type: 'Debt Payment', date: today(),
      accountId: 0, methodLabel: '', promoRef: tx.id
    });
    remaining -= toApply;
    applied += toApply;
  });
  return applied;
}

// ── #8 FIRST-TIME USER: no-accounts nudge in payment modals ──
function checkNoAccountsNudge(nudgeId){
  const nudge = $(nudgeId);
  if(!nudge) return;
  const hasAccounts = (data.accounts||[]).length > 0;
  nudge.style.display = hasAccounts ? 'none' : 'block';
}

// ── #9 INCOME EFFECTIVE MONTHLY IN CASH FLOW ─────────────────


// ── #10 CLEAR NW HISTORY ON RESET ────────────────────────────
// (wired into confirmReset below via patch)



// ══════════════════════════════════════════════════════════════
// FEATURE 12: DEFERRED INTEREST RETROACTIVE WARNING (enhanced)
// ══════════════════════════════════════════════════════════════

function calcDeferredInterest(tx, daysElapsed){
  // Deferred interest = full original amount x daily rate x days
  // (issuer charges interest on the ORIGINAL amount from day 1)
  if(tx.promoType !== 'deferred' || !tx.promoApr || tx.promoApr <= 0) return 0;
  const dailyRate = tx.promoApr / 100 / 365;
  return parseFloat((tx.amount * dailyRate * daysElapsed).toFixed(2));
}

function getDeferredInterestWarning(tx, remaining, daysLeft){
  if(tx.promoType !== 'deferred') return '';
  const apr = tx.promoApr || 0;
  if(!apr) return '';

  if(daysLeft < 0){
    // Already expired - show retroactive interest on unpaid portion
    const daysLate = Math.abs(daysLeft);
    // Interest accrues on whatever was unpaid at expiry
    const interest = calcDeferredInterest({...tx, amount: remaining + (tx.amount - tx.amount)}, 
      Math.abs(daysLeft) + (tx.promoMonths||6)*30);
    const retroInterest = parseFloat((tx.amount * (apr/100/365) * ((tx.promoMonths||6)*30)).toFixed(2));
    return `<div class="pi-interest-bomb">
      &#9888; Retroactive interest: ~${usd(retroInterest)} charged on original ${usd(tx.amount)} at ${apr}% APR from day 1
    </div>`;
  }

  if(daysLeft <= 30 && remaining > 0){
    // Approaching deadline - show what happens if not cleared
    const totalDays = (tx.promoMonths||6) * 30;
    const retroInterest = parseFloat((tx.amount * (apr/100/365) * totalDays).toFixed(2));
    return `<div class="pi-interest-bomb">
      &#128680; Miss deadline = ~${usd(retroInterest)} retroactive interest on ${usd(tx.amount)} at ${apr}% APR
    </div>`;
  }

  if(remaining > 0){
    // Show accumulating interest as a heads-up
    const totalDays = (tx.promoMonths||6) * 30;
    const retroInterest = parseFloat((tx.amount * (apr/100/365) * totalDays).toFixed(2));
    return `<div class="pi-interest-accruing">
      If unpaid by deadline: ~${usd(retroInterest)} interest will be charged retroactively
    </div>`;
  }
  return '';
}

// ══════════════════════════════════════════════════════════════
// FEATURE 5: BILL CALENDAR VIEW
// ══════════════════════════════════════════════════════════════

let _calMonth = null; // {year, month} object
let _billView = 'list';

function setBillView(view){
  _billView = view;
  const listEl = $('bill-list');
  const calEl  = $('bill-calendar');
  const sortBar = $('bill-sort-bar');
  const listBtn = $('bill-view-list');
  const calBtn  = $('bill-view-cal');

  if(view === 'calendar'){
    if(listEl) listEl.classList.add('calendar-mode');
    if(calEl)  calEl.classList.add('active');
    if(sortBar) sortBar.style.display = 'none';
    if(listBtn) listBtn.classList.remove('active');
    if(calBtn)  calBtn.classList.add('active');
    renderBillCalendar();
  } else {
    if(listEl) listEl.classList.remove('calendar-mode');
    if(calEl)  calEl.classList.remove('active');
    if(sortBar) sortBar.style.display = '';
    if(listBtn) listBtn.classList.add('active');
    if(calBtn)  calBtn.classList.remove('active');
  }
}

function shiftCalMonth(dir){
  if(!_calMonth){
    const now = new Date();
    _calMonth = {year: now.getFullYear(), month: now.getMonth()};
  }
  _calMonth.month += dir;
  if(_calMonth.month > 11){ _calMonth.month = 0; _calMonth.year++; }
  if(_calMonth.month < 0){  _calMonth.month = 11; _calMonth.year--; }
  renderBillCalendar();
}

// renderBillCalendar lives in render_bills.js

function openModal_goal(){
  $('goal-modal-title').textContent = 'Add Savings Goal';
  $('g-id').value=''; $('g-name').value=''; $('g-target').value='';
  $('g-date').value=''; $('g-notes').value=''; $('g-saved').value='0';
  const sel = $('g-account');
  if(sel){
    sel.innerHTML = '<option value="">-- No account linked --</option>'
      + (data.accounts||[]).map(a=>`<option value="${a.id}">${acTypeIcon[a.type]||''} ${a.name} (${usd(a.balance)})</option>`).join('');
  }
  $('modal-goal').classList.add('open');
}

function openEditGoal(id){
  const g = (data.goals||[]).find(x=>x.id===id); if(!g)return;
  $('goal-modal-title').textContent = 'Edit Goal';
  $('g-id').value=g.id; $('g-name').value=g.name; $('g-target').value=g.target;
  $('g-date').value=g.date||''; $('g-notes').value=g.notes||'';
  $('g-saved').value=g.saved||0;
  const sel = $('g-account');
  if(sel){
    sel.innerHTML = '<option value="">-- No account linked --</option>'
      + (data.accounts||[]).map(a=>`<option value="${a.id}">${acTypeIcon[a.type]||''} ${a.name} (${usd(a.balance)})</option>`).join('');
    sel.value = g.accountId||'';
  }
  $('modal-goal').classList.add('open');
}

function saveGoal(){
  const name   = $('g-name').value.trim();
  const target = parseFloat($('g-target').value)||0;
  const date   = $('g-date').value;
  const notes  = $('g-notes').value.trim();
  const acId   = parseInt($('g-account').value)||0;
  const saved  = parseFloat($('g-saved').value)||0;
  if(!name||!target){ showToast('Enter a name and target amount','error'); return; }

  if(!data.goals) data.goals=[];
  const eid = parseInt($('g-id').value);
  const item = {id:eid||Date.now(), name, target, date, notes, accountId:acId, saved, createdAt:eid?undefined:today()};
  if(eid) item.createdAt = (data.goals.find(g=>g.id===eid)||{}).createdAt;
  data.goals = eid ? data.goals.map(g=>g.id===eid?item:g) : [...data.goals, item];
  closeModal('goal'); saveData(); renderSections('networth');
  showToast(eid?'Goal updated!':'Goal added!');
}


function renderSpendingTrends(){
  const el = $('trends-wrap');
  if(!el) return;

  const months = parseInt($('chart-months')?$('chart-months').value:6)||6;

  // All categories from transactions + expenses
  const allCats = [...new Set([
    ...data.transactions.filter(t=>t.category&&t.type==='Purchase').map(t=>t.category),
    ...data.expenses.map(e=>e.category).filter(Boolean)
  ])].sort();

  if(!allCats.length){
    el.innerHTML = '<div style="font-size:13px;color:var(--muted);text-align:center;padding:20px">No categorized spending found. Add categories to your transactions.</div>';
    return;
  }

  if(!_trendCat || !allCats.includes(_trendCat)) _trendCat = allCats[0];

  // Build month buckets for primary + optional compare category
  const now = new Date();
  const buckets = [];
  for(let i=months-1; i>=0; i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const yr = d.getFullYear(), mo = d.getMonth();
    const label = d.toLocaleString('default',{month:'short', year:'2-digit'});
    const monthStr = `${yr}-${String(mo+1).padStart(2,'0')}`;
    const total1 = getCategoryTotal(_trendCat, monthStr);
    const total2 = _trendCat2 ? getCategoryTotal(_trendCat2, monthStr) : null;
    buckets.push({label, total:total1, total2, monthStr});
  }

  const vals1   = buckets.map(b=>b.total);
  const vals2   = _trendCat2 ? buckets.map(b=>b.total2||0) : [];
  const maxVal  = Math.max(...vals1, ...vals2, 1);
  const avg1    = parseFloat((vals1.reduce((s,v)=>s+v,0)/vals1.length).toFixed(2));
  const avg2    = _trendCat2 ? parseFloat((vals2.reduce((s,v)=>s+v,0)/vals2.length).toFixed(2)) : null;
  const highest = buckets.reduce((a,b)=>b.total>a.total?b:a);

  // Month-over-month change for most recent month
  const lastTotal  = vals1[vals1.length-1];
  const prevTotal  = vals1[vals1.length-2]||0;
  const momChange  = prevTotal>0 ? parseFloat(((lastTotal-prevTotal)/prevTotal*100).toFixed(1)) : null;
  const momBadge   = momChange===null ? ''
    : momChange===0 ? `<span class="trend-change-badge trend-change-flat">Flat</span>`
    : momChange>0   ? `<span class="trend-change-badge trend-change-up">+${momChange}% vs prev mo</span>`
    :                 `<span class="trend-change-badge trend-change-down">${momChange}% vs prev mo</span>`;

  // Category pills - primary
  const catPills = allCats.map(c=>`
    <button class="trend-cat-btn${c===_trendCat?' active':''}"
      onclick="_trendCat='${c}';renderSpendingTrends()">
      ${c}
    </button>`).join('');

  // Compare select
  const compareOpts = ['<option value="">-- Compare with --</option>']
    .concat(allCats.filter(c=>c!==_trendCat).map(c=>
      `<option value="${c}"${c===_trendCat2?' selected':''}>${c}</option>`
    )).join('');

  // Bar rows
  const bars = buckets.map((b,i)=>{
    const w1 = maxVal>0 ? Math.round(b.total/maxVal*100) : 0;
    const w2 = (_trendCat2&&maxVal>0) ? Math.round((b.total2||0)/maxVal*100) : 0;
    const isHighest = b.total===highest.total && b.total>0;
    const barColor = isHighest?'var(--red)':b.total>avg1?'var(--yellow)':'var(--accent)';

    // MoM badge on bars
    const prevB = buckets[i-1];
    const barMom = (prevB&&prevB.total>0&&b.total>0)
      ? parseFloat(((b.total-prevB.total)/prevB.total*100).toFixed(0)) : null;
    const barMomStr = barMom===null?''
      : `<span style="font-size:9px;color:${barMom>0?'var(--red)':'var(--green)'};margin-left:4px">${barMom>0?'+':''}${barMom}%</span>`;

    return `<div class="trend-bar-row">
      <div class="trend-bar-label">${b.label}</div>
      <div style="flex:1">
        <div class="trend-bar-bg">
          <div class="trend-bar-fill" style="width:${w1}%;background:${barColor}">
            ${w1>20?`<div class="trend-bar-val">${usd(b.total)}</div>`:''}
          </div>
          ${w1<=20&&b.total>0?`<span style="font-size:11px;color:var(--muted);margin-left:${w1+1}%">${usd(b.total)}${barMomStr}</span>`:''}
          ${b.total===0?`<span style="font-size:11px;color:var(--border2);padding-left:8px">$0</span>`:''}
        </div>
        ${_trendCat2&&b.total2>0?`<div class="trend-bar-compare" style="width:${w2}%;background:rgba(59,130,246,.6);max-width:100%"></div>`:''}
      </div>
      ${w1>20?barMomStr:''}
    </div>`;
  }).join('');

  // Summary stats
  const trendDir = vals1[vals1.length-1] > vals1[0] ? 'up' : 'down';
  const trendPct = vals1[0]>0 ? parseFloat(((vals1[vals1.length-1]-vals1[0])/vals1[0]*100).toFixed(1)) : null;

  el.innerHTML = `
    <div style="margin-bottom:12px">
      <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;
        letter-spacing:.5px;margin-bottom:6px">Primary Category ${momBadge}</div>
      <div class="trends-cat-select">${catPills}</div>
    </div>
    <div class="trend-compare-row">
      <span class="trend-compare-label">Compare with:</span>
      <select style="background:var(--surface);border:1px solid var(--border2);border-radius:8px;
        padding:5px 10px;color:var(--text);font-size:12px;flex:1"
        onchange="_trendCat2=this.value||null;renderSpendingTrends()">
        ${compareOpts}
      </select>
      ${_trendCat2?`<span style="display:inline-block;width:16px;height:4px;background:rgba(59,130,246,.6);border-radius:2px"></span> ${_trendCat2}`:''}
    </div>
    <div style="margin-bottom:10px">${bars}</div>
    <div class="trend-avg-line">
      <span class="txt-muted-sm">Avg: <strong>${usd(avg1)}/mo</strong>${_trendCat2?` &nbsp;|&nbsp; ${_trendCat2} avg: <strong>${usd(avg2)}/mo</strong>`:''}</span>
    </div>
    <div class="trend-summary">
      <div class="trend-stat">
        <div class="trend-stat-label">Avg / month</div>
        <div class="trend-stat-val">${usd(avg1)}</div>
      </div>
      <div class="trend-stat">
        <div class="trend-stat-label">Highest</div>
        <div class="trend-stat-val" class="txt-red">${usd(highest.total)}<div style="font-size:9px;color:var(--muted)">${highest.label}</div></div>
      </div>
      <div class="trend-stat">
        <div class="trend-stat-label">${months}-mo trend</div>
        <div class="trend-stat-val" style="color:${trendDir==='up'?'var(--red)':'var(--green)'}">
          ${trendPct!==null?(trendDir==='up'?'+':'')+trendPct+'%':'N/A'}
        </div>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// FEATURE 8: NOTES & TAGS - ENHANCED
// ══════════════════════════════════════════════════════════════

let _activeTxnTagFilter = null;



function getAllTagsForMonth(monthStr){
  return [...new Set(
    data.transactions
      .filter(t=>t.tags&&t.tags.length&&t.date&&t.date.slice(0,7)===monthStr)
      .flatMap(t=>t.tags)
  )].sort();
}


function renderCashFlow(){
  // Set sidebar version
  const vEl=$('sidebar-version');
  if(vEl) vEl.textContent=APP_VERSION;
  // Draw chart
  const cfMonths=parseInt($('cf-chart-months')?$('cf-chart-months').value:3)||3;
  const cfPts=getCashFlowMonths(cfMonths);
  setTimeout(()=>drawCashFlowChart(cfPts),60);

  const el=$('cashflow-content');
  if(!el) return;
  const now=new Date();
  const yr=now.getFullYear(), mo=now.getMonth();
  const monthName=now.toLocaleString('default',{month:'long',year:'numeric'});

  // ── Money In ──────────────────────────────────
  const incomeRows=data.income.map(i=>{
    const amt=getEffectiveIncome(i,yr,mo);
    const freqLabel=i.frequency!=='One-time'?' · '+i.frequency:'';
    return{label:i.source,sub:freqLabel,amt,color:'var(--green)'};
  });
  const totalIn=incomeRows.reduce((s,r)=>s+r.amt,0);

  // ── Money Out ─────────────────────────────────
  const expenseRows=data.expenses.map(e=>({
    label:e.description||e.category,
    sub:' · '+e.category+(e.frequency&&e.frequency!=='One-time'?' · '+e.frequency:''),
    amt:e.amount, color:'var(--red)'
  }));
  const billRows=data.bills.filter(b=>{
    if(b.amount<=0) return false;
    if(b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo') return b.balance>0;
    return true;
  }).map(b=>({
    label:b.name,
    sub:' · '+(b.btype==='creditcard'?'Credit Card':b.btype==='loan'?'Loan':'Bill')+(b.recurring&&b.recurring!=='No'?' · '+b.recurring:''),
    amt:b.scheduledAmount||b.amount, color:'var(--red)'
  }));
  const outRows=[...expenseRows,...billRows];
  const totalOut=outRows.reduce((s,r)=>s+r.amt,0);
  const net=totalIn-totalOut;
  const netColor=net>=0?'var(--green)':'var(--red)';

  function rowHtml(r){
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">'
      +'<div style="min-width:0;flex:1;padding-right:12px">'
      +'<div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+r.label+'</div>'
      +(r.sub?'<div class="txt-muted-sm">'+r.sub+'</div>':'')
      +'</div>'
      +'<div style="font-size:14px;font-weight:700;color:'+r.color+';white-space:nowrap">'+usd(r.amt)+'</div>'
      +'</div>';
  }

  function sectionHtml(title, rows, total, totalColor){
    return '<div class="mb-16">'
      +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:6px">'+title+'</div>'
      +(rows.length
        ? rows.map(rowHtml).join('')
        : '<div style="font-size:13px;color:var(--muted);padding:8px 0;border-bottom:1px solid var(--border)">None added yet</div>')
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;margin-top:2px">'
      +'<div style="font-size:12px;font-weight:700;color:var(--muted)">TOTAL</div>'
      +'<div style="font-size:15px;font-weight:800;color:'+totalColor+'">'+usd(total)+'</div>'
      +'</div></div>';
  }

  el.innerHTML='<div class="card">'
    +'<div style="font-size:13px;font-weight:700;color:var(--muted);margin-bottom:16px;text-transform:uppercase;letter-spacing:.5px">'+monthName+'</div>'
    +sectionHtml('Money In', incomeRows, totalIn, 'var(--green)')
    +sectionHtml('Money Out', outRows, totalOut, 'var(--red)')
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-top:2px solid var(--border2);margin-top:4px">'
    +'<div style="font-size:13px;font-weight:800;color:var(--text)">NET</div>'
    +'<div style="font-size:18px;font-weight:800;color:'+netColor+'">'+(net>=0?'+':'')+usd(net)+'</div>'
    +'</div>'
    +'</div>';
}

// ── TARGETED RENDERING ───────────────────────────────────────
// Call renderSections() after data mutations instead of renderAll().
// Only re-renders sections whose data actually changed.

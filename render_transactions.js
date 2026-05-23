// ── RENDER/TRANSACTIONS.JS ───────────────────────────────────────────────────
// Renders the Quick Update tab: transaction log, tag filter strip.
// Depends on: state.js (data), utils.js ($, usd, today, fmtDate, t, emptyState)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';


function renderTxns(){
  initTxnMonth();
  const [y,m]=txnMonth.split('-').map(Number);
  const now=new Date();
  const isCurrentMonth=y===now.getFullYear()&&m-1===now.getMonth();

  // Update month label
  const lbl=$('txn-month-label');
  if(lbl) lbl.textContent=new Date(y,m-1,1).toLocaleString('default',{month:'long',year:'numeric'});

  // Disable next if already at current month
  const nextBtn=$('txn-month-next');
  if(nextBtn){
    nextBtn.style.opacity=isCurrentMonth?'0.3':'1';
    nextBtn.style.pointerEvents=isCurrentMonth?'none':'auto';
  }

  const excluded=['Bill Payment','Debt Payment','Reconciliation'];

  // All transactions for selected month (or all-time if toggle active)
  const monthAll=[...data.transactions].filter(tx=>{
    if(excluded.includes(tx.type)||!tx.date)return false;
    if(txnAllMonths) return true;
    return tx.date.slice(0,7)===txnMonth;
  }).sort((a,b)=>b.date.localeCompare(a.date));

  // Apply type filter
  let filtered=txnFilter==='All'?monthAll:monthAll.filter(tx=>tx.type===txnFilter);

  // Apply search
  if(txnSearch){
    filtered=filtered.filter(tx=>{
      const method=tx.methodLabel||'';
      return (tx.description||'').toLowerCase().includes(txnSearch)
        ||(tx.category||'').toLowerCase().includes(txnSearch)
        ||method.toLowerCase().includes(txnSearch)
        ||(tx.note||'').toLowerCase().includes(txnSearch)
        ||(tx.tags||[]).some(tag=>('#'+tag).includes(txnSearch)||tag.includes(txnSearch.replace('#','')));
    });
  }
  // Apply tag filter
  if(_activeTxnTagFilter){
    filtered=filtered.filter(tx=>(tx.tags||[]).includes(_activeTxnTagFilter));
  }
  renderTagFilterStrip();

  // Monthly summary bar
  const sumEl=$('txn-summary');
  if(sumEl){
    if(monthAll.length){
      const spendingTxns=monthAll.filter(tx=>tx.type!=='Transfer');
      const totalSpent=spendingTxns.reduce((s,tx)=>s+tx.amount,0);
      const purchaseCt=monthAll.filter(tx=>tx.type==='Purchase').length;
      const withdrawCt=monthAll.filter(tx=>tx.type==='Withdrawal').length;
      sumEl.innerHTML=`<div class="txn-stats-grid">
        <div class="txn-stat-card">
          <div class="txn-stat-label">Total Spent</div>
          <div class="txn-stat-val" class="txt-red">-${usd(totalSpent)}</div>
          <div class="txn-stat-sub">${spendingTxns.length} transaction${spendingTxns.length===1?'':'s'}</div>
        </div>
        <div class="txn-stat-card">
          <div class="txn-stat-label">Purchases</div>
          <div class="txn-stat-val" class="txt-yellow">${purchaseCt}</div>
          <div class="txn-stat-sub">-${usd(monthAll.filter(tx=>tx.type==='Purchase').reduce((s,tx)=>s+tx.amount,0))}</div>
        </div>
        <div class="txn-stat-card">
          <div class="txn-stat-label">Withdrawals</div>
          <div class="txn-stat-val" class="txt-accent">${withdrawCt}</div>
          <div class="txn-stat-sub">-${usd(monthAll.filter(tx=>tx.type==='Withdrawal').reduce((s,tx)=>s+tx.amount,0))}</div>
        </div>
        <div class="txn-stat-card">
          <div class="txn-stat-label">Avg / Transaction</div>
          <div class="txn-stat-val" class="txt-muted">${spendingTxns.length?usd(parseFloat((totalSpent/spendingTxns.length).toFixed(2))):usd(0)}</div>
          <div class="txn-stat-sub">${new Date(y,m-1,1).toLocaleString('default',{month:'short',year:'numeric'})}</div>
        </div>
      </div>`;
    } else {
      sumEl.innerHTML='';
    }
  }

  const typeColor={'Withdrawal':'var(--red)','Purchase':'var(--yellow)','Bill Payment':'var(--blue)','Debt Payment':'var(--accent2)','Transfer':'var(--green)'};
  const typeIcon={'Withdrawal':'💵','Purchase':'🛒','Bill Payment':'📋','Debt Payment':'💳','Transfer':'🔁'};

  if(!filtered.length){
    const noData=!data.transactions.length;
    const noMonth=data.transactions.length>0&&!monthAll.length;
    $('txn-list').innerHTML=noData
      ? emptyState('⚡','Log your first transaction','Tap Cash Withdrawal or New Purchase above to start tracking your spending.','','')
      : noMonth
        ? emptyState('📅','No transactions this month','Use the arrows to browse other months, or log a new transaction above.','','')
        : '<div class="empty-state"><div class="es-icon">🔍</div><div class="es-title">No results</div><div class="es-desc">No transactions match your search.</div></div>';
    return;
  }

  $('txn-list').innerHTML=filtered.map(tx=>{
    const color=typeColor[tx.type]||'var(--muted)';
    const icon=typeIcon[tx.type]||'📝';
    const method=tx.methodLabel||(tx.accountId?(data.accounts||[]).find(a=>a.id===tx.accountId)?.name:'');
    const catLabel=tx.category?catIcon(tx.category)+tx.category:'';
    const sub=[fmtDate(tx.date),tx.type,method,catLabel].filter(Boolean).join(' - ');
    const rowHtml=`<div class="row" style="margin-bottom:0;border-radius:12px${tx.type==='Transfer'?';background:rgba(34,197,94,.05);border:1px solid rgba(34,197,94,.12)':''}">
      <div>
        <div class="row-label">${tx.description}</div>
        <div class="row-sub">${sub}</div>
        ${tx.note?`<div class="txn-note-wrap" onclick="event.stopPropagation();this.nextElementSibling&&this.nextElementSibling.classList.toggle('open');this.querySelector('.txn-note-preview').style.display=this.nextElementSibling.classList.contains('open')?'none':''" title="${tx.note.replace(/"/g,'&quot;')}">
          <span class="txn-note-icon">📝</span>
          <span class="txn-note-preview">${tx.note}</span>
        </div>
        <div class="txn-note-full">${tx.note}</div>`:''}
        ${tx.tags&&tx.tags.length?`<div class="txn-tags">${tx.tags.map(g=>`<span class="txn-tag${_activeTxnTagFilter===g?' active-filter':''}" onclick="setTagFilter(_activeTxnTagFilter==='${g}'?null:'${g}')">#${g}</span>`).join('')}</div>`:''}
      </div>
      <div class="row-actions">
        <span style="color:${color};font-weight:600">${tx.type==='Transfer'?'→ ':'- '}${usd(tx.amount)}</span>
        <button class="btn btn-secondary btn-sm show-desktop" onclick="openEditTxn(${tx.id})">✏️</button>
        <button class="btn btn-danger btn-sm show-desktop" onclick="deleteItem('transactions',${tx.id})">✕</button>
      </div>
    </div>`;
    return wrapSwipeable(rowHtml,'transactions',tx.id,`openEditTxn(${tx.id})`);
  }).join('');
  setTimeout(attachSwipes,50);
}

function setInsightsTab(tab){
  insightsTab=tab;
  const cats=$('tab-categories'),cards=$('tab-cards'),trends=$('tab-trends');
  if(cats) cats.classList.toggle('active',tab==='categories');
  if(cards) cards.classList.toggle('active',tab==='cards');
  if(trends) trends.classList.toggle('active',tab==='trends');
  renderInsights();
}

function openAddTarget(){
  $('target-modal-title').textContent='Set Budget Target';
  $('tg-id').value='';$('tg-type').value='category';$('tg-cat').value='Food';$('tg-amount').value='';
  // Populate card dropdown
  const debtCards=data.bills.filter(b=>b.btype==='creditcard');
  $('tg-card').innerHTML=debtCards.length
    ? debtCards.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')
    : '<option value="">No debt cards found</option>';
  toggleTargetType();
  $('modal-target').classList.add('open');
}

function toggleTargetType(){
  const isCard=$('tg-type').value==='card';
  $('tg-cat-wrap').style.display=isCard?'none':'block';
  $('tg-card-wrap').style.display=isCard?'block':'none';
}


function renderTagFilterStrip(){
  const strip = $('tag-filter-strip');
  if(!strip) return;
  const tags = getAllTagsForMonth(txnMonth);
  if(!tags.length){ strip.style.display='none'; return; }
  strip.style.display='flex';
  strip.innerHTML = `<span style="font-size:10px;color:var(--muted);padding:4px 2px;flex-shrink:0">Filter:</span>`
    + tags.map(tag=>`
    <button class="tag-filter-chip${_activeTxnTagFilter===tag?' active':''}"
      onclick="setTagFilter('${tag}')">
      #${tag}
    </button>`).join('')
    + (_activeTxnTagFilter?`<button class="tag-filter-chip" style="border-color:var(--red);color:var(--red)"
      onclick="setTagFilter(null)">&#x2715; Clear</button>`:'');
}

function setTagFilter(tag){
  _activeTxnTagFilter = tag;
  renderTxns();
}



// ══════════════════════════════════════════════════════════════
// RECURRING AUTO-LOG
// ══════════════════════════════════════════════════════════════

// AUTO_LOG_KEY lives in state.js

function toggleAutoLogExpense(){
  const chk = $('e-autolog');
  const wrap = $('autolog-account-wrap');
  if(!chk||!wrap) return;
  if(document.activeElement !== chk) chk.checked = !chk.checked;
  wrap.style.display = chk.checked ? 'block' : 'none';
  if(chk.checked) populateAutoLogAccountSelect('e-autolog-account');
}

function toggleAutoLogBill(){
  const chk = $('b-autolog');
  const wrap = $('b-autolog-account-wrap');
  if(!chk||!wrap) return;
  if(document.activeElement !== chk) chk.checked = !chk.checked;
  wrap.style.display = chk.checked ? 'block' : 'none';
  if(chk.checked) populateAutoLogAccountSelect('b-autolog-account');
}

function onBillRecurChange(){
  const rec = $('b-recur').value;
  const wrap = $('b-autolog-wrap');
  if(wrap) wrap.style.display = (rec && rec!=='No') ? 'block' : 'none';
}

function populateAutoLogAccountSelect(selId){
  const sel = $(selId);
  if(!sel) return;
  const accs = data.accounts||[];
  sel.innerHTML = '<option value="">-- Select account --</option>'
    + accs.map(a=>`<option value="${a.id}"${a.isDefault?' selected':''}>${acTypeIcon[a.type]||''} ${a.name} (${usd(a.balance)})</option>`).join('');
}

// ── Wire auto-log fields into openModal for expense ──────────
// Reset auto-log fields when expense modal opens (handled in openModal patch below)












// ── MAIN AUTO-LOG RUNNER ──────────────────────────────────────
function resetStaleExpensePaid(){
  const thisMonth=today().slice(0,7);
  data.expenses.forEach(e=>{ if(e.paidMonth&&e.paidMonth!==thisMonth) e.paidMonth=null; });
}

function runAutoLog(){
  const currentMonth = today().slice(0,7);
  const lastRun = localStorage.getItem(AUTO_LOG_KEY);
  if(lastRun === currentMonth) return; // Already ran this month

  const logged = [];
  const now = new Date();

  // ── Auto-log recurring expenses ──────────────────────────
  (data.expenses||[]).forEach(e=>{
    if(!e.autoLog || !e.autoLogAccountId) return;
    if(!e.frequency || e.frequency==='One-time') return;

    // Check if already logged this month
    const alreadyLogged = data.transactions.some(tx=>
      tx.autoLogRef === e.id &&
      tx.date && tx.date.slice(0,7) === currentMonth
    );
    if(alreadyLogged) return;

    const amt = parseFloat(e.amount)||0;
    if(!amt) return;

    // Deduct from account
    adjustAccountBalance(e.autoLogAccountId, -amt);

    // Log transaction
    data.transactions.push({
      id: Date.now()+Math.random(),
      description: e.description || e.category,
      amount: amt,
      type: 'Bill Payment',
      date: today(),
      accountId: e.autoLogAccountId,
      category: e.category,
      methodLabel: (data.accounts||[]).find(a=>a.id===e.autoLogAccountId)?.name||'',
      autoLogRef: e.id,
      note: 'Auto-logged'
    });

    logged.push({ name: e.description||e.category, amount: amt, type:'expense' });
  });

  // ── Auto-log recurring bills (non-debt only) ──────────────
  (data.bills||[]).forEach(b=>{
    if(!b.autoLog || !b.autoLogAccountId) return;
    if(b.recurring==='No' || !b.recurring) return;
    if(b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo') return;

    // Check if already logged this month
    const alreadyLogged = data.transactions.some(tx=>
      tx.autoLogRef === b.id &&
      tx.date && tx.date.slice(0,7) === currentMonth
    );
    if(alreadyLogged) return;

    const amt = parseFloat(b.amount)||0;
    if(!amt) return;

    // Deduct from account
    adjustAccountBalance(b.autoLogAccountId, -amt);

    // Mark bill as Paid and advance due date for next cycle
    b.status = 'Paid';
    if(b.dueDate && b.recurring && b.recurring!=='One-time'){
      const dd=new Date(b.dueDate+'T12:00:00');
      if(b.recurring==='Monthly')   dd.setMonth(dd.getMonth()+1);
      else if(b.recurring==='Weekly')    dd.setDate(dd.getDate()+7);
      else if(b.recurring==='Bi-weekly') dd.setDate(dd.getDate()+14);
      else if(b.recurring==='Quarterly') dd.setMonth(dd.getMonth()+3);
      else if(b.recurring==='Annually')  dd.setFullYear(dd.getFullYear()+1);
      b.dueDate = dd.toISOString().split('T')[0];
    }

    // Log transaction
    data.transactions.push({
      id: Date.now()+Math.random(),
      description: b.name+' payment',
      amount: amt,
      type: 'Bill Payment',
      date: today(),
      accountId: b.autoLogAccountId,
      methodLabel: (data.accounts||[]).find(a=>a.id===b.autoLogAccountId)?.name||'',
      autoLogRef: b.id,
      note: 'Auto-logged'
    });

    logged.push({ name: b.name, amount: amt, type:'bill' });
  });

  if(logged.length){
    // Store notification for dashboard
    const total = logged.reduce((s,l)=>s+l.amount,0);
    localStorage.setItem('financeOS_autoLogNotify', JSON.stringify({
      month: currentMonth,
      count: logged.length,
      total,
      items: logged.slice(0,5).map(l=>l.name)
    }));
    saveData();
  }

  localStorage.setItem(AUTO_LOG_KEY, currentMonth);
}

// ── AUTO-LOG DASHBOARD BANNER ─────────────────────────────────
function checkAutoLogBanner(){
  const raw = localStorage.getItem('financeOS_autoLogNotify');
  if(!raw) return;
  try{
    const n = JSON.parse(raw);
    const banner = $('autolog-banner');
    if(!banner) return;
    const monthFmt = new Date(n.month+'-15').toLocaleString('default',{month:'long',year:'numeric'});
    banner.style.display = 'block';
    banner.innerHTML = `
      <button onclick="dismissAutoLogBanner()" style="float:right;background:none;border:none;color:var(--green);cursor:pointer;font-size:16px">&#x2715;</button>
      <div style="font-weight:700;margin-bottom:4px">&#128259; Auto-logged ${n.count} payment${n.count>1?'s':''} for ${monthFmt}</div>
      <div class="txt-muted-xs">${n.items.join(', ')}${n.count>5?' +more':''} &mdash; Total: ${usd(n.total)}</div>`;
  }catch(e){}
}

function dismissAutoLogBanner(){
  localStorage.removeItem('financeOS_autoLogNotify');
  renderNotificationCenter();
}


// ══════════════════════════════════════════════════════════════
// NOTIFICATION CENTER
// ══════════════════════════════════════════════════════════════

function buildNotifications(){
  const notifs=[];
  const navTarget={
    bills:"show('bills',document.querySelector('[data-section=bills]'))",
    debt:"show('debt',document.querySelector('[data-section=debt]'))",
    cards:"show('cards',document.querySelector('[data-section=cards]'))",
    insights:"show('insights',document.querySelector('[data-section=insights]'))",
  };

  // ── Alerts from buildAlerts() ─────────────────────────────
  buildAlerts().forEach((a,i)=>{
    notifs.push({
      id:'alert-'+i,
      group: a.color==='#ef4444'?'urgent':'warning',
      icon:a.icon, color:a.color, msg:a.msg,
      action: navTarget[a.section]||'',
      dismissable:false
    });
  });

  // ── Auto-processed payments ────────────────────────────────
  try{
    const raw=localStorage.getItem('financeOS_autoProcessNotify');
    if(raw){
      const n=JSON.parse(raw);
      notifs.push({
        id:'autoprocess', group:'info',
        icon:'✅', color:'var(--green)',
        msg:n.count+' payment'+(n.count>1?'s':'')+' auto-processed today',
        sub:'Tap Bills & Payments to review',
        action:navTarget.bills,
        dismissable:true, dismissFn:"dismissAutoProcess()"
      });
    }
  }catch(e){}

  // ── Bill reset ─────────────────────────────────────────────
  try{
    const raw=localStorage.getItem('financeOS_billResetNotify');
    if(raw){
      const n=JSON.parse(raw);
      const mo=new Date(n.month+'-15').toLocaleString('default',{month:'long',year:'numeric'});
      notifs.push({
        id:'billreset', group:'info',
        icon:'📅', color:'var(--blue)',
        msg:n.count+' bill'+(n.count>1?'s':'')+' reset to Pending for '+mo,
        sub:n.names.join(', ')+(n.count>3?' +more':''),
        action:navTarget.bills,
        dismissable:true, dismissFn:"dismissBillResetBanner()"
      });
    }
  }catch(e){}

  // ── Auto-log ───────────────────────────────────────────────
  try{
    const raw=localStorage.getItem('financeOS_autoLogNotify');
    if(raw){
      const n=JSON.parse(raw);
      const mo=new Date(n.month+'-15').toLocaleString('default',{month:'long',year:'numeric'});
      notifs.push({
        id:'autolog', group:'info',
        icon:'🔄', color:'var(--green)',
        msg:'Auto-logged '+n.count+' payment'+(n.count>1?'s':'')+' for '+mo,
        sub:n.items.join(', ')+(n.count>5?' +more':'')+'  —  Total: '+usd(n.total),
        action:navTarget.bills,
        dismissable:true, dismissFn:"dismissAutoLogBanner()"
      });
    }
  }catch(e){}

  // ── Pending transfers ──────────────────────────────────────
  (data._pendingTransfers||[]).filter(t=>t.completionDate>=today()).forEach(t=>{
    notifs.push({
      id:'transfer-'+t.date, group:'info',
      icon:'⏳', color:'var(--yellow)',
      msg:usd(t.amount)+' transfer to '+t.destName,
      sub:'Completes ~'+fmtDate(t.completionDate),
      action:'',
      dismissable:true, dismissFn:`dismissTransfer('${t.date}')`
    });
  });

  return notifs;
}


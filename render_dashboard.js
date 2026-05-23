// ── RENDER/DASHBOARD.JS ──────────────────────────────────────────────────────
// Renders the Dashboard tab: hero card, stat cards, 7-day timeline.
// Depends on: state.js (data), utils.js ($, usd, today, fmtDate, daysUntil, t)
// External helpers used: statusColor, acTypeIcon, getEffectiveIncome,
//                        renderNotificationCenter
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

function renderDashboard(){
  renderNotificationCenter();

  // Show skeleton if no data yet (fresh install feel)
  const hasData=(data.income||[]).length||(data.bills||[]).length||(data.expenses||[]).length;
  if(!hasData){
    const tl=$('d-timeline');
    if(tl&&!tl.querySelector('.skeleton')){
      tl.innerHTML=`<div class="skeleton skel-card"></div><div class="skeleton skel-card"></div><div class="skeleton skel-line" style="width:60%"></div>`;
    }
  }

  // Stat calculations
  const ti=data.income.reduce((s,i)=>s+getEffectiveIncome(i,new Date().getFullYear(),new Date().getMonth()),0);
  const te=data.expenses.reduce((s,e)=>s+e.amount,0);
  const td=data.bills.filter(b=>b.btype==='creditcard'||b.btype==='loan').reduce((s,b)=>s+(b.balance||0),0);
  const tt=data.transactions.filter(t=>!t.promoRef).reduce((s,t)=>s+t.amount,0);
  // Money Out = expenses + active bill payments + spending transactions (no bill payments — already in bills)
  const tb=data.bills.filter(b=>{
    if((b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo')&&!(b.balance>0)) return false;
    return (b.amount||0)>0;
  }).reduce((s,b)=>s+(b.scheduledAmount||b.amount||0),0);
  const tw=data.transactions.filter(t=>!t.promoRef&&t.type!=='Transfer'&&t.type!=='Bill Payment'&&t.type!=='Debt Payment').reduce((s,t)=>s+t.amount,0);
  const totalOut=te+tb+tw;
  const net=ti-te-tt;
  const defaultAcct=(data.accounts||[]).find(a=>a.isDefault)||(data.accounts||[]).find(a=>a.type==='checking')||(data.accounts||[])[0]||{};
  const totalAccounts=defaultAcct.balance||0;
  const acctNameEl=$('d-projected-acct');
  if(acctNameEl){
    const defaultAcct2=(data.accounts||[]).find(a=>a.isDefault);
    acctNameEl.textContent=defaultAcct2?defaultAcct2.name:((data.accounts||[]).length>1?'All accounts':'');
  }

  // Hero card — Net Balance
  const balEl=$('d-balance');
  if(balEl){
    balEl.textContent=usd(net);
    balEl.style.color=net>=0?'var(--green)':'var(--red)';
  }

  // Projected Balance = account balances − unpaid bills/expenses due this month
  const projEl=$('d-projected');
  const projSub=$('d-projected-sub');
  if(projEl){
    const todayStr=today();
    const monthStr=todayStr.slice(0,7);
    const unpaidBills=data.bills.filter(b=>{
      if(b.status==='Paid') return false;
      if((b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo')&&!(b.balance>0)) return false;
      return b.dueDate && b.dueDate.slice(0,7)===monthStr;
    }).reduce((s,b)=>s+(b.scheduledAmount||b.amount||0),0);
    const unpaidExp=data.expenses.filter(e=>{
      if(e.paidMonth===monthStr) return false;
      return e.date && e.date.slice(0,7)===monthStr;
    }).reduce((s,e)=>s+e.amount,0);
    const projected=totalAccounts-unpaidBills-unpaidExp;
    projEl.textContent=usd(projected);
    projEl.style.color=projected>=0?'var(--green)':'var(--red)';
    if(projSub){
      const billCount=data.bills.filter(b=>{
        if(b.status==='Paid') return false;
        if((b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo')&&!(b.balance>0)) return false;
        return b.dueDate && b.dueDate.slice(0,7)===monthStr;
      }).length;
      const expCount=data.expenses.filter(e=>{
        if(e.paidMonth===monthStr) return false;
        return e.date && e.date.slice(0,7)===monthStr;
      }).length;
      const totalCount=billCount+expCount;
      projSub.textContent=`after ${totalCount} item${totalCount===1?'':'s'}`;  
    }
  }

  // Contextual summary line
  const summaryEl=$('d-summary-line');
  if(summaryEl){
    const overdueBills=(data.bills||[]).filter(b=>b.status==='Overdue').length;
    const dueSoon=(data.bills||[]).filter(b=>{
      if(b.status==='Paid'||b.status==='Overdue') return false;
      const d=daysUntil(b.dueDate);
      return d>=0&&d<=7;
    }).length;
    const parts=[];
    if(overdueBills>0) parts.push(`<span class="txt-red">${overdueBills} overdue bill${overdueBills>1?'s':''}</span>`);
    if(dueSoon>0) parts.push(`<span class="txt-yellow">${dueSoon} due this week</span>`);
    if(net>0&&!overdueBills&&!dueSoon) parts.push(`<span class="txt-green">↑ Looking good this month</span>`);
    if(net<0) parts.push(`<span class="txt-red">↓ Spending exceeds income</span>`);
    summaryEl.innerHTML=parts.join(' &nbsp;·&nbsp; ')||'&nbsp;';
  }

  // Supporting stat cards
  $('d-income').textContent=usd(ti);
  $('d-expenses').textContent=usd(totalOut);
  $('d-debt').textContent=usd(td);
  const acctTotalEl=$('d-acct-total');
  if(acctTotalEl) acctTotalEl.textContent=usd(totalAccounts);

  // Account chip strip
  const accs=data.accounts||[];
  const wrap=$('d-accounts-wrap'),grid=$('d-accounts');
  if(wrap&&grid){
    wrap.style.display=accs.length?'block':'none';
    grid.innerHTML=accs.map(a=>`
      <div class="stat-card">
        <div class="stat-label">${acTypeIcon[a.type]||''} ${a.name}</div>
        <div class="stat-value" style="color:${a.balance>=0?'var(--green)':'var(--red)'};">${usd(a.balance)}</div>
      </div>`).join('');
  }

  // ── 7-DAY TIMELINE ────────────────────────────
  const todayStr=today();
  function dtOffset(days){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().split('T')[0]; }
  const past7=dtOffset(-7), next7=dtOffset(7);

  const upcomingBills=data.bills.filter(b=>{
    if(b.status==='Paid') return false;
    if((b.btype==='creditcard'||b.btype==='loan')&&!(b.balance>0)) return false;
    const d=b.dueDate;
    if(!d) return false;
    return d>=past7&&d<=next7||(b.status==='Overdue')||daysUntil(d)<0;
  });

  const recentTxns=data.transactions.filter(tx=>tx.date&&tx.date>=past7&&tx.date<=todayStr);

  const items=[];

  upcomingBills.forEach(b=>{
    const d=daysUntil(b.dueDate);
    const eff=b.status!=='Paid'&&b.status!=='Scheduled'&&d<0?'Overdue':b.status;
    const isPast=d<0;
    const isToday=b.dueDate===todayStr;
    items.push({
      date:b.dueDate, sortKey:b.dueDate, future:!isPast, isToday, isOverdue:eff==='Overdue',
      render:()=>{
        const sc=statusColor(eff);
        const icon=b.btype==='creditcard'?'💳':b.btype==='loan'?'🏦':'📋';
        const label=isToday?t('Due TODAY'):isPast?`${Math.abs(d)} ${t('days overdue')}`:`${t('Due in')} ${d} ${d===1?t('day'):t('days')}`;
        return`<div class="row" style="border-left:3px solid ${sc};padding-left:10px;margin-left:-10px">
          <div>
            <div class="row-label">${icon} ${b.name}</div>
            <div class="row-sub" style="color:${sc}">${label} · ${fmtDate(b.dueDate)}</div>
            ${b.scheduledAmount?`<div class="row-sub" style="color:var(--blue)">Scheduled: ${usd(b.scheduledAmount)}</div>`:''}
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;color:${sc}">${usd(b.scheduledAmount||b.amount)}</div>
            ${b.scheduledAmount?`<div style="font-size:10px;color:var(--muted)">min ${usd(b.amount)}</div>`:''}
            <div class="badge" style="background:${sc}22;color:${sc};font-size:12px">${eff}</div>
          </div>
        </div>`;
      }
    });
  });

  const typeIcon={'Withdrawal':'💵','Purchase':'🛒','Bill Payment':'📋','Debt Payment':'💳','Transfer':'🔁'};
  recentTxns.forEach(tx=>{
    const isToday=tx.date===todayStr;
    const method=tx.methodLabel||(tx.accountId?(data.accounts||[]).find(a=>a.id===tx.accountId)?.name:'');
    items.push({
      date:tx.date, sortKey:tx.date, future:false, isToday, isOverdue:false,
      render:()=>`<div class="row">
        <div>
          <div class="row-label">${typeIcon[tx.type]||'📝'} ${tx.description}</div>
          <div class="row-sub">${fmtDate(tx.date)}${method?' · '+method:''}${tx.category?' · '+tx.category:''}</div>
        </div>
        <div style="color:var(--red);font-weight:600">-${usd(tx.amount)}</div>
      </div>`
    });
  });

  if(!items.length){
    $('d-timeline').innerHTML=emptyState('📅','All clear this week','No upcoming bills or recent transactions in the past 7 days.','','');
    return;
  }

  // Split into overdue, upcoming, past
  const overdue=items.filter(i=>i.isOverdue).sort((a,b)=>a.sortKey.localeCompare(b.sortKey));
  const upcoming=items.filter(i=>i.future&&!i.isOverdue).sort((a,b)=>a.sortKey.localeCompare(b.sortKey));
  const past=items.filter(i=>!i.future&&!i.isToday&&!i.isOverdue).sort((a,b)=>b.sortKey.localeCompare(a.sortKey));

  let html='';

  // Overdue group
  if(overdue.length){
    html+=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--red)">⚠ Overdue</div>
      <div style="background:var(--red);color:#fff;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700">${overdue.length}</div>
    </div>`;
    html+=overdue.map(i=>i.render()).join('');
    html+=`<div style="height:1px;background:var(--border);margin:12px 0"></div>`;
  }

  // Upcoming group
  if(upcoming.length){
    html+=`<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--accent2);margin-bottom:8px">Upcoming</div>`;
    html+=upcoming.map(i=>i.render()).join('');
  }

  // TODAY divider — only render when there is content above (upcoming/overdue) or below (past)
  const hasAbove=overdue.length||upcoming.length;
  const hasBelow=past.length;
  if(hasAbove||hasBelow){
    html+=`<div style="display:flex;align-items:center;gap:10px;margin:12px 0"><div style="flex:1;height:1px;background:var(--accent);opacity:.3"></div><div style="font-size:11px;font-weight:700;color:var(--accent);letter-spacing:1px">${t('TODAY')}</div><div style="flex:1;height:1px;background:var(--accent);opacity:.3"></div></div>`;
  }

  // Past/recent group
  if(past.length){
    html+=`<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);margin-bottom:8px">Recent</div>`;
    html+=past.map(i=>i.render()).join('');
  }

  $('d-timeline').innerHTML=html;
}

function toggleDashAccounts(){
  const grid=$('d-accounts');
  const chev=$('d-acct-chevron');
  if(!grid) return;
  const open=grid.style.display==='grid';
  grid.style.display=open?'none':'grid';
  if(chev) chev.textContent=open?'▾':'▴';
}


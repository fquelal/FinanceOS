// ── RENDER/BILLS.JS ──────────────────────────────────────────────────────────
// Renders the Money tab: bill list, income cards, bills management, calendar,
// and the monthly summary cards strip.
// Depends on: state.js (data), utils.js ($, usd, today, fmtDate, daysUntil,
//             t, emptyState, showConfirm, showToast),
//             render_dashboard.js indirectly via renderAll
// External helpers used: statusColor, incomeStatusColor, getEffectiveIncome,
//   getIncomeOccurrences, attachSwipes, renderProjection, renderMoneySummaryCards
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

function renderIncomeCard(income, occ, idx, total){
  const cid='inc'+income.id+'d'+occ.date.replace(/-/g,'');
  const status=getIncomeOccurrenceStatus(income,occ.date);
  const sc=incomeStatusColor(status);
  const isFirst=idx===0;
  const isRecurring=income.frequency==='Weekly'||income.frequency==='Bi-weekly';
  const occLabel=income.frequency==='Weekly'?'Week':'Paycheck';
  const hasOccOverride=(income.occurrenceOverrides||{})[occ.date]!=null;
  const subLine=isRecurring
    ?(fmtDate(occ.date)+' \u00b7 '+occLabel+' '+(idx+1)+' of '+total)
    :(fmtDate(occ.date)+' \u00b7 '+income.frequency);
  const amtStr=hasOccOverride
    ?('<span style="color:var(--muted);text-decoration:line-through;font-size:11px">'+usd(income.amount)+'</span>'
      +' <span style="font-weight:700;color:var(--accent2)">'+usd(occ.amount)+'</span>')
    :('<span style="font-weight:700;color:var(--green)">'+usd(occ.amount)+'</span>');
  const statusBadge='<span style="font-size:12px;font-weight:700;padding:2px 8px;border-radius:20px;'
    +'background:'+sc+'22;color:'+sc+'">'+status+'</span>';
  const _btn='flex:1;padding:8px 4px;font-size:11px;font-weight:700;justify-content:center;text-align:center;min-width:0';
  let actionBtns='';
  if(status==='Received'){
    actionBtns='<button class="btn btn-sm" style="'+_btn+';background:rgba(34,197,94,.15);color:var(--green)"'
      +' onclick="event.stopPropagation();setIncomeOccurrenceStatus('+income.id+',\''+occ.date+'\',\'Expected\')">'
      +'&#x2713; Received</button>'
      +'<button class="btn btn-sm" style="'+_btn+';background:rgba(239,68,68,.1);color:var(--red)"'
      +' onclick="event.stopPropagation();setIncomeOccurrenceStatus('+income.id+',\''+occ.date+'\',\'Missed\')">'
      +'&#x2715; Missed</button>';
  } else if(status==='Missed'){
    actionBtns='<button class="btn btn-sm" style="'+_btn+';background:rgba(34,197,94,.15);color:var(--green)"'
      +' onclick="event.stopPropagation();setIncomeOccurrenceStatus('+income.id+',\''+occ.date+'\',\'Received\')">'
      +'&#x2713; Received</button>'
      +'<button class="btn btn-sm" style="'+_btn+';background:rgba(255,255,255,.06);color:var(--muted)"'
      +' onclick="event.stopPropagation();setIncomeOccurrenceStatus('+income.id+',\''+occ.date+'\',\'Expected\')">'
      +'Undo</button>';
  } else {
    actionBtns='<button class="btn btn-sm" style="'+_btn+';background:rgba(34,197,94,.15);color:var(--green)"'
      +' onclick="event.stopPropagation();setIncomeOccurrenceStatus('+income.id+',\''+occ.date+'\',\'Received\')">'
      +'&#x2713; Received</button>'
      +'<button class="btn btn-sm" style="'+_btn+';background:rgba(239,68,68,.1);color:var(--red)"'
      +' onclick="event.stopPropagation();setIncomeOccurrenceStatus('+income.id+',\''+occ.date+'\',\'Missed\')">'
      +'&#x2715; Missed</button>';
  }
  actionBtns+='<button class="btn btn-sm"'
    +' style="'+_btn+';background:rgba(80,112,240,.12);color:var(--accent2);border:1px solid rgba(80,112,240,.25)"'
    +' onclick="event.stopPropagation();openOccurrenceModal('+income.id+',\''+occ.date+'\','+income.amount+')">$ Update</button>';
  if(isFirst){
    actionBtns+='<button class="btn btn-sm"'
      +' style="'+_btn+';background:rgba(255,255,255,.08);color:var(--text);border:1px solid var(--border2)"'
      +' onclick="event.stopPropagation();openEditIncome('+income.id+')">✏️ Edit</button>';
  }
  return '<div class="card" style="margin-bottom:8px;border-left:3px solid #22c55e;border-radius:4px 12px 12px 4px;cursor:pointer"'
    +' onclick="toggleCardExpand(\''+cid+'\')">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
    +'<div style="min-width:0;flex:1">'
    +(isFirst&&income.frequency&&income.frequency!=='One-time'?'<div style="margin-bottom:3px;display:flex;gap:4px;flex-wrap:wrap">'+recurBadge(income.frequency)+'</div>':'')
    +'<div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+income.source+'</div>'
    +'<div class="txt-muted-sm">'+subLine+'</div>'
    +'</div>'
    +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">'
    +statusBadge
    +'<div style="display:flex;align-items:center;gap:6px">'
    +amtStr
    +'<span id="cchev-'+cid+'" style="color:var(--muted);font-size:11px">&#9662;</span>'
    +'</div></div></div>'
    +'<div id="cact-'+cid+'"'
    +' style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);flex-wrap:nowrap;gap:4px">'
    +actionBtns+'</div>'
    +'</div>';
}

function renderMoneySummaryCards(){
  const el=$('money-summary-cards');
  if(!el) return;
  const now=new Date();
  const yr=now.getFullYear(), mo=now.getMonth();
  const monthName=now.toLocaleString('default',{month:'long'});
  const todayStr=today();

  // Expected Income — sum of all income sources for current month
  const expectedIncome=data.income.reduce((s,i)=>s+getEffectiveIncome(i,yr,mo),0);

  // Available Now — total account balances
  const accounts=data.accounts||[];
  const defaultAcct2=(accounts||[]).find(a=>a.isDefault)||(accounts||[]).find(a=>a.type==='checking')||(accounts||[])[0]||{};
  const availableNow=defaultAcct2.balance||0;
  const acctCount=accounts.length;
  const acctSub=acctCount>0?acctCount+' account'+(acctCount===1?'':'s'):'No accounts linked';

  // ── Monthly Health ─────────────────────────────
  const overdue=data.bills.filter(b=>{
    if(b.status==='Paid'||b.status==='Scheduled') return false;
    if(!b.dueDate) return false;
    if((b.btype==='creditcard'||b.btype==='loan')&&!b.balance&&!b.amount) return false;
    return b.dueDate<todayStr;
  });
  const in7=new Date(now); in7.setDate(in7.getDate()+7);
  const in7Str=in7.toISOString().slice(0,10);
  const dueSoon=data.bills.filter(b=>{
    if(b.status==='Paid'||b.status==='Scheduled') return false;
    if(!b.dueDate) return false;
    return b.dueDate>=todayStr&&b.dueDate<=in7Str;
  });
  const totalBillsOut=data.bills.filter(b=>b.amount>0&&!((b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo')&&!(b.balance>0))).reduce((s,b)=>s+(b.scheduledAmount||b.amount),0);
  const netMonth=expectedIncome-totalBillsOut-data.expenses.reduce((s,e)=>s+e.amount,0);
  const overdueAmt=overdue.reduce((s,b)=>s+b.amount,0);

  // Health verdict
  let healthStatus, healthColor, healthIcon, healthMsg;
  if(overdue.length===0&&netMonth>=0&&availableNow>=totalBillsOut*0.5){
    healthStatus='Healthy'; healthColor='var(--green)'; healthIcon='✅';
    healthMsg=dueSoon.length
      ?dueSoon.length+' bill'+(dueSoon.length>1?'s':'')+' due this week totaling '+usd(dueSoon.reduce((s,b)=>s+b.amount,0))+'. You are on track.'
      :'No overdue bills and positive cash flow. Looking good this month.';
  } else if(overdue.length<=2&&netMonth>=-200){
    healthStatus='Caution'; healthColor='var(--yellow)'; healthIcon='⚠️';
    healthMsg=overdue.length
      ?overdue.length+' overdue bill'+(overdue.length>1?'s':'')+' totaling '+usd(overdueAmt)+'. Take care of '+(overdue.length>1?'these':'this')+' soon.'
      :'Cash flow is tight this month. Watch your spending.';
  } else {
    healthStatus='At Risk'; healthColor='var(--red)'; healthIcon='🔴';
    healthMsg=overdue.length
      ?overdue.length+' overdue bill'+(overdue.length>1?'s':'')+' totaling '+usd(overdueAmt)+'. Immediate attention needed.'
      :'Spending exceeds income this month. Review your bills and expenses.';
  }

  // Money Left calculation
  const thisMonthStr=todayStr.slice(0,7);
  const pendingBillAmt=data.bills.filter(b=>{
    if(b.status==='Paid') return false;
    if((b.btype==='creditcard'||b.btype==='loan')&&!(b.balance>0)) return false;
    return true;
  }).reduce((s,b)=>s+(b.scheduledAmount||b.amount||0),0);
  const pendingExpAmt=data.expenses.filter(e=>!e.paidMonth||e.paidMonth!==thisMonthStr).reduce((s,e)=>s+(e.amount||0),0);
  const moneyLeft=availableNow-pendingBillAmt-pendingExpAmt;

  // Paid Progress calculation
  const billsDue=data.bills.filter(b=>{
    if((b.btype==='creditcard'||b.btype==='loan')&&!(b.balance>0)) return false;
    return b.dueDate&&b.dueDate.slice(0,7)===thisMonthStr;
  });
  const expsDue=data.expenses.filter(e=>e.date&&e.date.slice(0,7)===thisMonthStr);
  const totalItems=billsDue.length+expsDue.length;
  const paidItems=billsDue.filter(b=>b.status==='Paid'||b.status==='Scheduled').length
    +expsDue.filter(e=>e.paidMonth===thisMonthStr).length;
  const progressPct=totalItems>0?Math.round(paidItems/totalItems*100):0;
  const progressCol=progressPct===100?'var(--green)':progressPct>=50?'var(--blue)':'var(--yellow)';

  const statPill=(label,val,col)=>
    '<div style="flex:1;text-align:center;padding:8px 4px;background:rgba(255,255,255,.03);border-radius:8px">'
    +'<div style="font-size:16px;font-weight:800;color:'+col+'">'+val+'</div>'
    +'<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-top:2px">'+label+'</div>'
    +'</div>';

  const progressPill=
    '<div style="flex:1;text-align:center;padding:8px 4px;background:rgba(255,255,255,.03);border-radius:8px">'
    +'<div style="font-size:16px;font-weight:800;color:'+progressCol+'">'+paidItems+'/'+totalItems+'</div>'
    +'<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-top:2px">Paid</div>'
    +'<div style="height:3px;border-radius:2px;background:rgba(255,255,255,.08);margin-top:5px;overflow:hidden">'
    +'<div style="height:100%;width:'+progressPct+'%;background:'+progressCol+';border-radius:2px;transition:width .4s"></div>'
    +'</div></div>';

  el.innerHTML=
    // Health card full width
    '<div style="background:var(--surface);border:1px solid '+healthColor+'44;border-radius:14px;padding:14px 16px;position:relative;overflow:hidden">'
    +'<div style="position:absolute;inset:0;background:linear-gradient(135deg,'+healthColor+'08,transparent);pointer-events:none"></div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
    +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:'+healthColor+'">Monthly Health</div>'
    +'<div style="font-size:11px;font-weight:800;color:'+healthColor+';background:'+healthColor+'18;border:1px solid '+healthColor+'33;border-radius:20px;padding:2px 10px">'+healthIcon+' '+healthStatus+'</div>'
    +'</div>'
    +'<div style="display:flex;gap:6px;margin-bottom:10px">'
    +statPill('Money Left',(moneyLeft>=0?'':'-')+usd(Math.abs(moneyLeft)),moneyLeft>=0?'var(--green)':'var(--red)')
    +progressPill
    +statPill('Net Month',(netMonth>=0?'+':'')+usd(netMonth),netMonth>=0?'var(--green)':'var(--red)')
    +'</div>'
    +'<div style="font-size:12px;color:var(--muted);line-height:1.5;border-top:1px solid var(--border);padding-top:8px">'+healthMsg+'</div>'
    +'</div>';
}


function renderBills(){
  autoProcessScheduledBillsWithNotify();
  renderMoneySummaryCards();

  const now=new Date();
  const yr=now.getFullYear(), mo=now.getMonth();
  const nxtMo=mo===11?0:mo+1, nxtYr=mo===11?yr+1:yr;

  // Build income occurrence items for current month + next month
  const incomeItems=[];
  data.income.forEach(inc=>{
    const occs=getIncomeOccurrences(inc,yr,mo);
    occs.forEach((occ,idx)=>{
      incomeItems.push({
        _kind:'income', income:inc, occ, idx, total:occs.length,
        _date:occ.date, _amount:occ.amount,
        _status:getIncomeOccurrenceStatus(inc,occ.date)
      });
    });
    const nextOccs=getIncomeOccurrences(inc,nxtYr,nxtMo);
    nextOccs.forEach((occ,idx)=>{
      incomeItems.push({
        _kind:'income', income:inc, occ, idx, total:nextOccs.length,
        _date:occ.date, _amount:occ.amount,
        _status:getIncomeOccurrenceStatus(inc,occ.date)
      });
    });
  });

  if(!data.bills.length && !incomeItems.length){
    $('bill-list').innerHTML=emptyState('📋','No bills or income yet','Add bills, loans, credit cards, and income to track everything in one place.',"+ Add a Bill","openModal('bill')");
    return;
  }

  // Helper: render a bill card (Option B - tap to expand)
  function renderBillCard(b, isFirst){
    const cid='bill'+b.id;
    const d=daysUntil(b.dueDate);
    const isDebt=b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo';
    let eff=b.status;
    const isZeroBalance=isDebt&&!(b.balance>0);
    if(eff!=='Paid'&&eff!=='Scheduled'&&d<0&&!isZeroBalance) eff='Overdue';
    const sc=statusColor(eff);
    // Left border color by type
    const typeColor=b.btype==='creditcard'?'#ef4444':b.btype==='loan'?'#3b82f6':'#f59e0b';
    // Sub line
    const subLine='Due: '+fmtDate(b.dueDate)+(b.recurring&&b.recurring!=='No'?' \u00b7 '+b.recurring:'');
    // Type badge
    const typeBadge=b.btype==='creditcard'?'<span style="font-size:12px;font-weight:700;padding:2px 7px;border-radius:6px;background:rgba(239,68,68,.15);color:#ef4444;flex-shrink:0">Card</span>'
      :b.btype==='loan'?'<span style="font-size:12px;font-weight:700;padding:2px 7px;border-radius:6px;background:rgba(59,130,246,.15);color:#3b82f6;flex-shrink:0">Loan</span>'
      :b.btype==='bill'?'<span style="font-size:12px;font-weight:700;padding:2px 7px;border-radius:6px;background:rgba(245,158,11,.15);color:#f59e0b;flex-shrink:0">Bill</span>':'';
    const scheduledAmt=b.scheduledAmount?' \u00b7 '+usd(b.scheduledAmount):'';
    const statusBadge='<span style="font-size:12px;font-weight:700;padding:2px 8px;border-radius:20px;background:'+sc+'22;color:'+sc+'">'+eff+'</span>';
    // Action buttons
    let actionBtns='';
    if(eff==='Paid'){
      actionBtns='<span style="font-size:12px;color:var(--green);font-weight:700">&#x2713; Paid'+scheduledAmt+'</span>';
    } else if(eff==='Scheduled'){
      actionBtns='<button class="btn btn-sm" style="background:rgba(59,130,246,.15);color:var(--blue)"'
        +' onclick="event.stopPropagation();openPayDebt('+b.id+')">Edit Payment</button>'
        +'<button class="btn btn-sm" style="background:rgba(255,255,255,.06);color:var(--muted)"'
        +' onclick="event.stopPropagation();revertToPending('+b.id+')">Cancel</button>';
    } else if(isZeroBalance){
      actionBtns='<span class="txt-muted-xs">No balance</span>';
    } else {
      const schedLabel=eff==='Overdue'?'Schedule Now':'Schedule';
      actionBtns='<button class="btn btn-sm" style="background:rgba(59,130,246,.15);color:var(--blue)"'
        +' onclick="event.stopPropagation();'+(isDebt?'openPayDebt('+b.id+')':'openScheduleBill('+b.id+')')+'">'
        +schedLabel+'</button>';
    }
    if(b.btype==='creditcard'&&eff==='Pending'){
      actionBtns+='<button class="btn btn-sm" style="background:rgba(59,130,246,.15);color:var(--blue);font-size:11px;font-weight:700;"'
        +' onclick="event.stopPropagation();quickUpdateCardBalance('+b.id+')">$ Update Balance</button>';
    }
    const utilBar=(()=>{
      if(b.btype!=='creditcard'||!b.creditLimit||!b.balance) return '';
      const util=Math.min(100,Math.round(b.balance/b.creditLimit*100));
      const uc=util<30?'var(--green)':util<50?'var(--yellow)':'var(--red)';
      return '<div style="height:3px;background:var(--border);border-radius:2px;margin-top:7px">'
        +'<div style="height:3px;width:'+util+'%;background:'+uc+';border-radius:2px"></div></div>';
    })();

    return '<div class="card" data-bill-id="'+b.id+'" style="margin-bottom:8px;border-left:3px solid '+typeColor+';border-radius:4px 12px 12px 4px;cursor:pointer"'
      +' onclick="toggleCardExpand(\''+cid+'\')">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
      +'<div style="min-width:0;flex:1">'
      +((b.autoLog||typeBadge)?'<div style="margin-bottom:3px;display:flex;gap:4px;flex-wrap:wrap">'
        +(b.autoLog?'<span class="autolog-badge">&#128259; Auto</span>':'')+typeBadge+'</div>':'')
      +'<div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+b.name+'</div>'
      +'<div class="txt-muted-sm">'+subLine+'</div>'
      +(isDebt&&b.balance?'<div class="txt-muted-sm">'+getBalanceSplitHtml(b)+'</div>':'')
      +'</div>'
      +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">'
      +statusBadge
      +'<div style="display:flex;align-items:center;gap:6px">'
      +'<span style="font-weight:700;font-size:15px">'+usd(b.scheduledAmount||b.amount)+'</span>'
      +'<span id="cchev-'+cid+'" style="color:var(--muted);font-size:11px">&#9662;</span>'
      +'</div>'
      +(b.scheduledAmount?'<div style="font-size:11px;color:var(--muted)">min '+usd(b.amount)+'</div>':'')
      +'</div></div>'
      +utilBar
      +(isDebt?renderPromoItems(b.id):'')
    +'<div id="cact-'+cid+'"'
      +' style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);flex-wrap:wrap;gap:6px">'
      +actionBtns+'</div>'
      +'</div>';
  }

  // Helper: section divider
  function sectionDiv(label, idx){
    return '<div style="display:flex;align-items:center;gap:10px;margin:'+(idx===0?'0':'18px')+' 0 12px">'
      +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--accent2);white-space:nowrap">'+label+'</div>'
      +'<div style="flex:1;height:1px;background:linear-gradient(to right,var(--border2),transparent)"></div></div>';
  }

  let html='';
  const currentMonth=today().slice(0,7);

  // Helper: render an expense card
  function renderExpenseCard(e){
    const ecid='exp'+e.id;
    const isPaid=e.paidMonth===currentMonth;
    const d=daysUntil(e.date);
    const eff=isPaid?'Paid':(e.frequency&&e.frequency!=='One-time'&&d<0?'Overdue':'Pending');
    const sc=statusColor(eff);
    const statusBadge='<span style="font-size:12px;font-weight:700;padding:2px 8px;border-radius:20px;background:'+sc+'22;color:'+sc+'">'+eff+'</span>';
    const subLine=(e.date?'Due: '+fmtDate(e.date):'')+(e.frequency&&e.frequency!=='One-time'?' · '+e.frequency:'')+(e.category?' · '+e.category:'');
    let actionBtns='';
    if(!e.autoLog){
      if(eff==='Paid'){
        actionBtns='<button class="btn btn-sm" style="background:rgba(255,255,255,.06);color:var(--muted)"'
          +' onclick="event.stopPropagation();undoExpensePaid('+e.id+')">Undo</button>';
      } else {
        actionBtns='<button class="btn btn-sm" style="background:rgba(59,130,246,.15);color:var(--blue)"'
          +' onclick="event.stopPropagation();openScheduleExpense('+e.id+')">Schedule</button>';
      }
    }
    const hasActions=!!actionBtns;
    const chevron=hasActions?'<span id="cchev-'+ecid+'" style="color:var(--muted);font-size:11px">&#9662;</span>':'';
    const cardClick=hasActions?' onclick="toggleCardExpand(\''+ecid+'\')">':'>';
    return '<div class="card"'+(hasActions?' onclick="toggleCardExpand(\''+ecid+'\')"':'')+' style="margin-bottom:8px;border-left:3px solid #a855f7;border-radius:4px 12px 12px 4px'+(hasActions?';cursor:pointer':'')+'">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
      +'<div style="min-width:0;flex:1">'
      +'<div style="margin-bottom:3px;display:flex;gap:4px;flex-wrap:wrap">'
      +(e.autoLog?'<span class="autolog-badge">&#128259; Auto</span>':'')
      +'<span style="font-size:12px;font-weight:700;padding:2px 7px;border-radius:6px;background:rgba(168,85,247,.15);color:#a855f7;flex-shrink:0">Expense</span>'
      +'</div>'
      +'<div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escHtml(e.description||e.category)+'</div>'
      +'<div class="txt-muted-sm">'+subLine+'</div>'
      +'</div>'
      +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">'
      +statusBadge
      +'<div style="display:flex;align-items:center;gap:4px">'
      +'<span style="font-weight:700;font-size:15px">'+usd(e.amount)+'</span>'
      +chevron
      +'</div></div></div>'
      +(hasActions?'<div id="cact-'+ecid+'" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);flex-wrap:wrap;gap:6px">'+actionBtns+'</div>':'')
      +'</div>';
  }

  if(billSort==='type'){
    // ── GROUP BY TYPE ──────────────────────────────
    const incomeCards  = incomeItems.map(it=>renderIncomeCard(it.income,it.occ,it.idx,it.total));
    const billCards    = data.bills.filter(b=>b.btype==='bill').map((b,i)=>renderBillCard(b,i===0));
    const expenseCards = data.expenses.filter(e=>e.amount>0).map(e=>renderExpenseCard(e));
    const loanCards    = data.bills.filter(b=>(b.btype==='loan'||b.btype==='promo')&&b.balance>0).map((b,i)=>renderBillCard(b,i===0));
    const cardCards    = data.bills.filter(b=>b.btype==='creditcard'&&b.balance>0).map((b,i)=>renderBillCard(b,i===0));

    if(incomeCards.length){
      html+=sectionDiv('💰 Income',0);
      html+=incomeCards.join('<div class="mb-8"></div>');
    }
    if(billCards.length){
      html+=sectionDiv('📋 Bills',incomeCards.length?1:0);
      html+=billCards.join('<div class="mb-8"></div>');
    }
    if(expenseCards.length){
      html+=sectionDiv('💸 Expenses',incomeCards.length+billCards.length?1:0);
      html+=expenseCards.join('<div class="mb-8"></div>');
    }
    if(loanCards.length){
      html+=sectionDiv('🏦 Loans',1);
      html+=loanCards.join('<div class="mb-8"></div>');
    }
    if(cardCards.length){
      html+=sectionDiv('💳 Credit Cards',1);
      html+=cardCards.join('<div class="mb-8"></div>');
    }

  } else {
    // ── SORTED COMBINED LIST ───────────────────────
    const statusOrder={'Overdue':0,'Missed':0,'Pending':1,'Expected':1,'Scheduled':2,'Paid':3,'Received':3};

    // Normalise all items to sortable shape
    const allItems=[
      ...data.bills
        .filter(b=>{
          const isDebt=b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo';
          return !isDebt||(b.balance>0);
        })
        .map(b=>{
        const d=daysUntil(b.dueDate);
        const isDebt=b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo';
        const isZeroBalance=isDebt&&!(b.balance>0);
        let eff=b.status;
        if(eff!=='Paid'&&eff!=='Scheduled'&&d<0&&!isZeroBalance) eff='Overdue';
        return{_kind:'bill',bill:b,_date:b.dueDate||'',_amount:b.amount,_status:eff};
      }),
      ...data.expenses.filter(e=>e.amount>0).map(e=>{
        const isPaid=e.paidMonth===currentMonth;
        const d=daysUntil(e.date);
        const eff=isPaid?'Paid':(e.frequency&&e.frequency!=='One-time'&&d<0?'Overdue':'Pending');
        return{_kind:'expense',expense:e,_date:e.date||'',_amount:e.amount,_status:eff};
      }),
      ...incomeItems
    ];

    if(billSort==='date') allItems.sort((a,b)=>new Date(a._date||'9999')-new Date(b._date||'9999'));
    else if(billSort==='amount') allItems.sort((a,b)=>b._amount-a._amount);
    else if(billSort==='status') allItems.sort((a,b)=>(statusOrder[a._status]??9)-(statusOrder[b._status]??9));

    let lastMonthKey='';
    const unpaidItems = allItems.filter(i => i._status !== 'Paid' && i._status !== 'Received');
    const paidItems   = allItems.filter(i => i._status === 'Paid'  || i._status === 'Received');

    unpaidItems.forEach((item,idx)=>{
      if(billSort==='date'){
        const monthKey=item._date?item._date.slice(0,7):'';
        if(monthKey&&monthKey!==lastMonthKey){
          lastMonthKey=monthKey;
          const label=item._date?new Date(item._date+'T12:00:00').toLocaleDateString('en-US',{month:'long',year:'numeric'}):'';
          html+=sectionDiv(label,idx);
        }
      }
      if(item._kind==='bill') html+=renderBillCard(item.bill,false);
      else if(item._kind==='expense') html+=renderExpenseCard(item.expense);
      else html+=renderIncomeCard(item.income,item.occ,item.idx,item.total);
      html+='<div class="mb-8"></div>';
    });

    if(paidItems.length){
      html+=sectionDiv('✅ Paid / Received', unpaidItems.length ? 1 : 0);
      paidItems.forEach(item=>{
        if(item._kind==='bill') html+=renderBillCard(item.bill,false);
        else if(item._kind==='expense') html+=renderExpenseCard(item.expense);
        else html+=renderIncomeCard(item.income,item.occ,item.idx,item.total);
        html+='<div class="mb-8"></div>';
      });
    }
  }

  $('bill-list').innerHTML=html||emptyState('📋','Nothing here yet','Add bills, loans, credit cards, and income to get started.',"+ Add a Bill","openModal('bill')");
}



function renderBillsManage(){
  // Bills list
  const bl=$('bills-manage-list');
  if(bl){
    {
      const typeColor={creditcard:'#ef4444',loan:'#3b82f6',bill:'#f59e0b',promo:'#8b5cf6'};
      const typeLabel={creditcard:'Card',loan:'Loan',bill:'Bill',promo:'Promo'};
      const billsOnly=data.bills.filter(b=>b.btype==='bill');
      if(!billsOnly.length){ bl.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px 0">No bills added yet.</div>'; }
      else bl.innerHTML=billsOnly.map(b=>{
        const tc=typeColor[b.btype]||'#888';
        const tl=typeLabel[b.btype]||'Bill';
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="min-width:0;flex:1">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
              <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:5px;background:${tc}22;color:${tc};flex-shrink:0">${tl}</span>
              <span style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(b.name)}</span>
            </div>
            <div style="font-size:12px;color:var(--muted)">${b.dueDate?'Due: '+fmtDate(b.dueDate)+' · ':''}${usd(b.amount)}${b.balance?' · Bal: '+usd(b.balance):''}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn btn-secondary btn-sm" onclick="openEditBill(${b.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteBillFromModal(${b.id})">&#x2715;</button>
          </div>
        </div>`;
      }).join('');
    }
  }
  // Expenses list
  const el=$('expenses-manage-list');
  if(el){
    if(!data.expenses.length){
      el.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px 0">No expenses added yet.</div>';
    } else {
      el.innerHTML=data.expenses.map(e=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="min-width:0;flex:1">
          <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px">${escHtml(e.description||e.category)}</div>
          <div style="font-size:12px;color:var(--muted)">${e.date?'Due: '+fmtDate(e.date)+' · ':''}${usd(e.amount)}${e.frequency&&e.frequency!=='One-time'?' · '+e.frequency:''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-secondary btn-sm" onclick="openEditExpense(${e.id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('expenses',${e.id});renderBillsManage()">&#x2715;</button>
        </div>
      </div>`).join('');
    }
  }
}

function renderBillCalendar(){
  const grid = $('cal-grid');
  const label = $('cal-month-label');
  if(!grid) return;

  const now = new Date();
  if(!_calMonth) _calMonth = {year: now.getFullYear(), month: now.getMonth()};
  const {year, month} = _calMonth;

  if(label) label.textContent = new Date(year, month, 1)
    .toLocaleString('default', {month:'long', year:'numeric'});

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const todayStr = today();

  // Day headers
  const dayHeaders = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    .map(d=>`<div class="cal-day-header">${d}</div>`).join('');

  // Build day cells
  let cells = '';
  // Leading empty cells
  for(let i=0; i<firstDay; i++){
    cells += '<div class="cal-day other-month"></div>';
  }

  // Build income occurrence map for this month
  const incomeByDate = {};
  data.income.forEach(inc => {
    const occs = getIncomeOccurrences(inc, year, month);
    occs.forEach((occ, idx) => {
      if(!incomeByDate[occ.date]) incomeByDate[occ.date] = [];
      incomeByDate[occ.date].push({ inc, occ, idx, total: occs.length });
    });
  });

  // Day cells with bills + income
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const bills = data.bills.filter(b=>b.dueDate===dateStr);

    const billDots = bills.map(b=>{
      let eff = b.status;
      if(eff!=='Paid'&&eff!=='Scheduled'&&b.dueDate<todayStr) eff='Overdue';
      const sc = {Paid:'#22c55e',Scheduled:'#3b82f6',Pending:'#f59e0b',Overdue:'#ef4444'}[eff]||'#888';
      const typeIcon = b.btype==='creditcard'?'$ ':b.btype==='loan'?'$ ':'';
      const name = b.name.length>9?b.name.slice(0,8)+'…':b.name;
      return '<div class="cal-bill-dot" style="background:'+sc+'28;color:'+sc+';border:1.5px solid '+sc+'55"'
        +' title="'+b.name+' - '+usd(b.amount)+' · '+eff+'"'
        +' onclick="event.stopPropagation();setBillView(\'list\');setTimeout(()=>setBillSort(\'date\'),50)">'
        +name+'</div>';
    }).join('');

    const incomeDots = (incomeByDate[dateStr]||[]).map(({inc, occ, idx, total})=>{
      const status = getIncomeOccurrenceStatus(inc, dateStr);
      const sc = incomeStatusColor(status);
      const isRecurring = inc.frequency==='Weekly'||inc.frequency==='Bi-weekly';
      const occLabel = isRecurring ? ' ('+(idx+1)+'/'+total+')' : '';
      const label = (inc.source.length>8?inc.source.slice(0,7)+'…':inc.source)+occLabel;
      return '<div class="cal-bill-dot" style="background:'+sc+'28;color:'+sc+';border:1.5px solid '+sc+'66;font-weight:800"'
        +' title="Income: '+inc.source+' '+usd(occ.amount)+' · '+status+'"'
        +' onclick="event.stopPropagation();setBillView(\'list\');setTimeout(()=>setBillSort(\'date\'),50)">'
        +'$ '+label+'</div>';
    }).join('');

    cells += `<div class="cal-day${isToday?' today':''}">
      <div class="cal-day-num">${d}</div>
      ${incomeDots}${billDots}
    </div>`;
  }

  // Trailing empty cells to complete grid
  const total = firstDay + daysInMonth;
  const trailing = total%7===0 ? 0 : 7-(total%7);
  for(let i=0; i<trailing; i++){
    cells += '<div class="cal-day other-month"></div>';
  }

  grid.innerHTML = dayHeaders + cells;
}

// ══════════════════════════════════════════════════════════════
// FEATURE 6: SAVINGS GOALS
// ══════════════════════════════════════════════════════════════


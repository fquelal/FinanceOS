// ── RENDER/ACCOUNTS.JS ───────────────────────────────────────────────────────
// Renders the Accounts tab: net worth, cards, loans, savings goals.
// Depends on: state.js (data), utils.js ($, usd, today, fmtDate, t, emptyState)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';


function renderNetWorth(){
  if(!$('nw-assets'))return;
  renderGoals();
  const assets=data.assets||[];
  const accs=data.accounts||[];
  const totalAccounts=accs.reduce((s,a)=>s+a.balance,0);
  const totalAssets=assets.reduce((s,a)=>s+a.value,0)+totalAccounts;
  const totalDebt=data.bills.filter(b=>b.btype==='creditcard'||b.btype==='loan').reduce((s,b)=>s+(b.balance||0),0);
  const netWorth=totalAssets-totalDebt;
  if($('nw-accounts')) $('nw-accounts').textContent=usd(totalAccounts);
  $('nw-assets').textContent=usd(totalAssets);
  $('nw-debts').textContent=usd(totalDebt);
  const nwEl=$('nw-total');
  if(nwEl){nwEl.textContent=usd(netWorth);snapshotNetWorth(netWorth);drawNWHistoryChart();nwEl.style.color=netWorth>=0?'var(--green)':'var(--red)';}
  // Render accounts in Net Worth section
  const acList=$('account-list');
  if(acList){
    const acTypeColor={checking:'#5070f0',savings:'#1aa8d8',cash:'#22c55e'};
    acList.innerHTML=accs.length?accs.map(a=>{
      const ac=acTypeColor[a.type]||'#5070f0';
      const defaultBadge=a.isDefault?'<span style="margin-left:7px;font-size:10px;font-weight:700;background:rgba(80,112,240,.18);color:var(--accent);border-radius:5px;padding:2px 7px;vertical-align:middle">DEFAULT</span>':'';
      const reconHtml=a.lastReconciled?'<div class="recon-badge">&#10003; Reconciled '+fmtDate(a.lastReconciled)+'</div><div class="recon-history">Bank: '+usd(a.lastReconciledBal||0)+' confirmed</div>':'';
      const apyHtml=a.apy>0?'<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding:7px 10px;background:rgba(34,197,94,.07);border-radius:8px;border:1px solid rgba(34,197,94,.15)"><span style="font-size:11px;font-weight:700;color:var(--green)">APY '+a.apy.toFixed(2)+'%</span><span class="txt-muted-sm">· ~'+usd(parseFloat((a.balance*a.apy/100).toFixed(2)))+' / yr</span></div>':'';
      const urlHtml=a.url?'<button class="btn btn-secondary btn-sm" style="margin-top:8px;width:100%;justify-content:flex-start;gap:8px;padding:8px 12px;border:1px solid rgba(80,112,240,.2);background:rgba(80,112,240,.07)" onclick="openLink(this.dataset.url)" data-url="'+a.url+'"><span>🌐</span><span style="font-size:12px;color:var(--accent2)">'+linkHost(a.url)+'</span><span style="margin-left:auto;color:var(--muted);font-size:13px">›</span></button>':'';
      const acctId='acct'+a.id;
      const cardHtml='<div class="card" style="margin-bottom:0;border-left:3px solid '+ac+';border-radius:4px 12px 12px 4px;cursor:pointer" onclick="toggleCardExpand(\''+acctId+'\')">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">'
        +'<div><div style="font-size:15px;font-weight:600;margin-bottom:3px">'+(acTypeIcon[a.type]||'🏦')+' '+a.name+defaultBadge+'</div>'
        +'<div class="txt-muted-xs">'+(acTypeLabel[a.type]||a.type)+(a.notes?' - '+a.notes:'')+'</div></div>'
        +'<div style="display:flex;align-items:center;gap:8px">'
        +'<span style="font-family:var(--font-d);font-size:22px;color:'+(a.balance>=0?'var(--green)':'var(--red)')+'">'+usd(a.balance)+'</span>'
        +'<span id="cchev-'+acctId+'" style="color:var(--muted);font-size:11px">&#9662;</span>'
        +'</div></div>'
        +reconHtml+apyHtml+urlHtml
        +'<div id="cact-'+acctId+'" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);flex-wrap:wrap;gap:6px">'
        +'<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();openReconcile('+a.id+')" title="Reconcile">&#x2696;&#xFE0F; Reconcile</button>'
        +'<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();openEditAccount('+a.id+')">Edit</button>'
        +'<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteItem(\'accounts\','+a.id+')">&#x2715;</button>'
        +'</div>'
        +'</div>';
      return '<div style="margin-bottom:11px">'+cardHtml+'</div>';
    }).join('')
    :emptyState('🏦','No accounts yet','Add your checking, savings, and cash accounts to track live balances.','+ Add Account',"openModal('account')");
  }
  const catIcon={cash:'💵',invest:'📈',property:'🏠',vehicle:'🚗'};
  const catLabel={cash:'Savings / Cash',invest:'Investments',property:'Property',vehicle:'Vehicle'};
  const aList=$('asset-list');
  if(aList) aList.innerHTML=assets.length?assets.map(a=>{
    // Depreciation estimate
    let deprHtml='';
    if((a.category==='vehicle')&&a.originalValue>0&&a.purchaseDate&&a.depreciationRate>0){
      const years=(Date.now()-new Date(a.purchaseDate))/(365.25*24*3600*1000);
      const estimated=parseFloat((a.originalValue*Math.pow(1-a.depreciationRate/100,years)).toFixed(2));
      const lost=a.originalValue-estimated;
      deprHtml=`<div class="txt-muted-sm-top">
        Purchased ${fmtDate(a.purchaseDate)} · Est. depreciated: <span class="txt-red">${usd(Math.max(0,estimated))}</span>
        <span style="color:var(--muted);margin-left:4px">(~${usd(lost)} lost)</span>
      </div>`;
    }
    if((a.category==='property')&&a.originalValue>0&&a.purchaseDate){
      const years=(Date.now()-new Date(a.purchaseDate))/(365.25*24*3600*1000);
      deprHtml=`<div class="txt-muted-sm-top">
        Purchased ${fmtDate(a.purchaseDate)} · ${years.toFixed(1)} yr${years>=2?'s':''} ago · Original: ${usd(a.originalValue)}
      </div>`;
    }
    // Home equity
    let equityHtml='';
    if(a.category==='property'&&a.linkedBillId){
      const loan=data.bills.find(b=>b.id===a.linkedBillId);
      if(loan){
        const equity=a.value-(loan.balance||0);
        equityHtml=`<div style="display:flex;gap:16px;margin-top:6px;padding:6px 10px;background:rgba(255,255,255,.04);border-radius:8px;flex-wrap:wrap">
          <span class="txt-muted-sm">🏠 Value: <strong style="color:var(--text)">${usd(a.value)}</strong></span>
          <span class="txt-muted-sm">🏦 Mortgage: <strong class="txt-red">${usd(loan.balance||0)}</strong></span>
          <span class="txt-muted-sm">💰 Equity: <strong style="color:${equity>=0?'var(--green)':'var(--red)'}">${usd(equity)}</strong></span>
        </div>`;
      }
    }
    const assetColor={cash:'#1aa8d8',invest:'#5070f0',property:'#f59e0b',vehicle:'#fb923c'};
    const ac2=assetColor[a.category]||'#5070f0';
    const assetId='asst'+a.id;
    const innerHtml='<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleCardExpand(\''+assetId+'\')">'
      +'<div><div class="row-label">'+(catIcon[a.category]||'💼')+' '+a.name+'</div>'
      +'<div class="row-sub">'+(catLabel[a.category]||a.category)+(a.notes?' · '+a.notes:'')+'</div></div>'
      +'<div class="row-actions" style="gap:8px">'
      +'<span style="color:var(--green);font-weight:600">'+usd(a.value)+'</span>'
      +'<span id="cchev-'+assetId+'" style="color:var(--muted);font-size:11px">&#9662;</span>'
      +'</div></div>'
      +deprHtml+equityHtml
      +'<div id="cact-'+assetId+'" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);flex-wrap:wrap;gap:6px">'
      +'<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();openEditAsset('+a.id+')">Edit</button>'
      +'<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteItem(\'assets\','+a.id+')">&#x2715;</button>'
      +'</div>';
    const assetCard='<div class="card" style="margin-bottom:0;border-left:3px solid '+ac2+';border-radius:4px 12px 12px 4px;">'+innerHtml+'</div>';
    return '<div style="margin-bottom:11px">'+assetCard+'</div>';
  }).join(''):emptyState('📈','No assets yet','Add investments, property, and vehicles to see your full net worth.','+ Add Asset',"openModal('asset')");
  // Dashboard accounts widget
  const wrap=$('d-accounts-wrap'),grid=$('d-accounts');
  if(wrap&&grid){
    wrap.style.display=accs.length?'block':'none';
    grid.innerHTML=accs.map(a=>`
      <div class="stat-card">
        <div class="stat-label">${acTypeIcon[a.type]||''} ${a.name}</div>
        <div class="stat-value" style="color:${a.balance>=0?'var(--green)':'var(--red)'}">${usd(a.balance)}</div>
      </div>`).join('');
  }
}

function checkPinOnLoad(){
  const pin=localStorage.getItem(PIN_KEY);
  if(pin){$('pin-screen').classList.add('show');$('lock-nav-btn').style.display='flex';}
}
function lockApp(){
  const pin=localStorage.getItem(PIN_KEY);
  if(!pin){showToast('No PIN set - go to Settings');return;}
  pinBuffer='';updatePinDots();$('pin-error').textContent='';
  $('pin-screen').classList.add('show');closeSidebar();
}
function pinKey(k){
  if(pinBuffer.length>=4)return;
  pinBuffer+=k;updatePinDots();
  if(pinBuffer.length===4)setTimeout(checkPin,120);
}
function pinDel(){pinBuffer=pinBuffer.slice(0,-1);updatePinDots();}
function pinClear(){pinBuffer='';updatePinDots();}
function updatePinDots(){
  for(let i=0;i<4;i++)$('pd'+i).classList.toggle('filled',i<pinBuffer.length);
}
function checkPin(){
  const stored=localStorage.getItem(PIN_KEY);
  if(pinBuffer===stored){
    $('pin-screen').classList.remove('show');
    pinBuffer='';updatePinDots();$('pin-error').textContent='';
  }else{
    $('pin-error').textContent='Incorrect PIN. Try again.';
    pinBuffer='';updatePinDots();
  }
}
function openPinSetup(){
  const existing=localStorage.getItem(PIN_KEY);
  $('pinsetup-title').textContent=existing?'Change PIN':'Set Up PIN';
  $('pinsetup-desc').textContent=existing?'Enter a new 4-digit PIN.':'Choose a 4-digit PIN to lock the app on startup.';
  $('pin-remove-btn').style.display=existing?'block':'none';
  $('pin-new').value='';$('pin-confirm').value='';$('pinsetup-error').textContent='';
  $('modal-pinsetup').classList.add('open');
}
function savePinSetup(){
  const n=$('pin-new').value.trim(),c=$('pin-confirm').value.trim();
  if(!/^\d{4}$/.test(n)){$('pinsetup-error').textContent='PIN must be exactly 4 digits.';return;}
  if(n!==c){$('pinsetup-error').textContent='PINs do not match.';return;}
  localStorage.setItem(PIN_KEY,n);
  $('lock-nav-btn').style.display='flex';
  closeModal('pinsetup');closeModal('settings');
  showToast(t('PIN saved!'));
}
function removePin(){
  showConfirm({
    icon:'🔓', title:'Remove PIN lock?',
    msg:'The app will no longer lock on startup.',
    okLabel:'Remove PIN', okStyle:'background:var(--red);color:#fff',
    onOk:()=>{
      localStorage.removeItem(PIN_KEY);
      $('lock-nav-btn').style.display='none';
      closeModal('pinsetup');showToast(t('PIN removed.'));
    }
  });
}

// ── ASSETS ───────────────────────────────────────
function toggleAssetFields(){
  const cat=$('a-cat').value;
  const showDepr=cat==='vehicle'||cat==='property';
  const showMortgage=cat==='property';
  const showDeprRate=cat==='vehicle'; // property appreciates, so hide rate for it
  if($('a-depreciation-wrap')) $('a-depreciation-wrap').style.display=showDepr?'block':'none';
  if($('a-mortgage-wrap')) $('a-mortgage-wrap').style.display=showMortgage?'block':'none';
  if($('a-depr-rate-wrap')) $('a-depr-rate-wrap').style.display=showDeprRate?'block':'none';
  if(showMortgage){
    const loans=data.bills.filter(b=>b.btype==='loan'&&b.balance>0);
    const curVal=$('a-linked-bill').value;
    $('a-linked-bill').innerHTML='<option value="">-- None --</option>'+
      loans.map(b=>`<option value="${b.id}">${b.name} (${usd(b.balance)} remaining)</option>`).join('');
    if(curVal) $('a-linked-bill').value=curVal;
  }
}

function openEditAsset(id){
  const a=data.assets.find(x=>x.id===id);if(!a)return;
  $('asset-modal-title').textContent='Edit Asset';
  $('a-id').value=a.id;$('a-name').value=a.name;$('a-cat').value=a.category;
  $('a-value').value=a.value;$('a-notes').value=a.notes||'';
  $('a-purchase-date').value=a.purchaseDate||'';
  $('a-original-value').value=a.originalValue||'';
  $('a-depr-rate').value=a.depreciationRate||'';
  toggleAssetFields();
  if($('a-linked-bill')) $('a-linked-bill').value=a.linkedBillId||'';
  $('asset-delete-wrap').style.display='block';
  $('modal-asset').classList.add('open');
}

function saveAsset(){
  const name=$('a-name').value.trim(),cat=$('a-cat').value,val=parseFloat($('a-value').value),notes=$('a-notes').value.trim();
  if(!name||!val)return;
  const purchaseDate=$('a-purchase-date').value||null;
  const originalValue=parseFloat($('a-original-value').value)||0;
  const depreciationRate=parseFloat($('a-depr-rate').value)||0;
  const linkedBillId=(cat==='property'&&$('a-linked-bill').value)?parseInt($('a-linked-bill').value):0;
  const eid=parseInt($('a-id').value);
  const item={id:eid||Date.now(),name,category:cat,value:val,notes,purchaseDate,originalValue,depreciationRate,linkedBillId};
  data.assets=eid?data.assets.map(a=>a.id===eid?item:a):[...data.assets,item];
  $('a-name').value='';$('a-value').value='';$('a-notes').value='';
  $('a-purchase-date').value='';$('a-original-value').value='';$('a-depr-rate').value='';$('a-id').value='';
  $('asset-delete-wrap').style.display='none';
  closeModal('asset');saveData();renderSections('networth');
}

function deleteAssetFromModal(){
  const id=parseInt($('a-id').value);
  if(!id)return;
  closeModal('asset');
  deleteItem('assets',id);
}

// ── BUDGET TARGETS ────────────────────────────────
function saveTarget(){
  const ttype=$('tg-type').value;
  const amt=parseFloat($('tg-amount').value);
  if(!amt)return;
  if(!data.targets)data.targets=[];
  const eid=parseInt($('tg-id').value);
  let item;
  if(ttype==='card'){
    const cardId=parseInt($('tg-card').value);
    if(!cardId)return;
    item={id:eid||Date.now(),type:'card',cardId,amount:amt};
  } else {
    const cat=$('tg-cat').value;
    if(!cat)return;
    item={id:eid||Date.now(),type:'category',category:cat,amount:amt};
  }
  data.targets=eid?data.targets.map(t=>t.id===eid?item:t):[...data.targets,item];
  $('tg-amount').value='';$('tg-id').value='';
  closeModal('target');saveData();renderSections('insights');
}

// ── CHART ─────────────────────────────────────────
function getMonthlyExpenses(months){
  const result=[];
  for(let i=months-1;i>=0;i--){
    const d=new Date();d.setMonth(d.getMonth()-i);
    const yr=d.getFullYear(),mo=d.getMonth();
    const label=d.toLocaleString('default',{month:'short',year:'2-digit'});
    const expenses=data.expenses.filter(e=>{
      if(!e.date)return false;
      const ed=new Date(e.date);
      return ed.getFullYear()===yr&&ed.getMonth()===mo;
    }).reduce((s,e)=>s+e.amount,0);
    const txns=data.transactions.filter(tx=>{
      if(!tx.date||tx.type==='Transfer'||tx.type==='Bill Payment'||tx.type==='Debt Payment'||tx.type==='Reconciliation')return false;
      const td=new Date(tx.date);
      return td.getFullYear()===yr&&td.getMonth()===mo;
    }).reduce((s,tx)=>s+tx.amount,0);
    result.push({label,total:expenses+txns,expenses,txns});
  }
  return result;
}
function drawChart(pts){
  const canvas=$('spending-chart');if(!canvas)return;
  const W=canvas.parentElement.offsetWidth||0;
  if(W===0){setTimeout(()=>drawChart(pts),150);return;}
  const ctx=canvas.getContext('2d');
  const H=220;
  canvas.width=W;canvas.height=H;
  ctx.clearRect(0,0,W,H);
  const pad={t:28,r:20,b:36,l:56};
  const cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
  const maxVal=Math.max(...pts.map(p=>p.total),1);
  const xStep=cw/(pts.length-1||1);

  // Store pts on canvas for touch lookup
  canvas._chartPts=pts;canvas._chartPad=pad;canvas._chartH=H;

  // Legend
  ctx.font='10px -apple-system,sans-serif';
  ctx.fillStyle='#5070f0';ctx.fillRect(pad.l,6,10,8);
  ctx.fillStyle='#777777';ctx.textAlign='left';ctx.fillText('Expenses',pad.l+13,14);
  ctx.fillStyle='#f59e0b';ctx.fillRect(pad.l+80,6,10,8);
  ctx.fillStyle='#777777';ctx.fillText('Purchases & Withdrawals',pad.l+93,14);

  // Grid
  ctx.strokeStyle='#2a2a2a';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad.t+ch-(ch*i/4);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+cw,y);ctx.stroke();
    ctx.fillStyle='#777777';ctx.font='11px -apple-system,sans-serif';ctx.textAlign='right';
    ctx.fillText('$'+(maxVal*i/4).toFixed(0),pad.l-6,y+4);
  }

  // Fill gradient under total line
  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ch);
  grad.addColorStop(0,'rgba(80,112,240,0.2)');grad.addColorStop(1,'rgba(80,112,240,0.02)');
  ctx.beginPath();
  pts.forEach((p,i)=>{const x=pad.l+i*xStep,y=pad.t+ch-(ch*p.total/maxVal);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
  ctx.lineTo(pad.l+(pts.length-1)*xStep,pad.t+ch);ctx.lineTo(pad.l,pad.t+ch);
  ctx.closePath();ctx.fillStyle=grad;ctx.fill();

  // Expenses line (purple)
  ctx.beginPath();ctx.strokeStyle='#5070f0';ctx.lineWidth=2.5;ctx.lineJoin='round';
  pts.forEach((p,i)=>{const x=pad.l+i*xStep,y=pad.t+ch-(ch*(p.expenses||0)/maxVal);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
  ctx.stroke();
  pts.forEach((p,i)=>{
    const x=pad.l+i*xStep,y=pad.t+ch-(ch*(p.expenses||0)/maxVal);
    ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);
    ctx.fillStyle='#5070f0';ctx.fill();ctx.strokeStyle='#111111';ctx.lineWidth=1.5;ctx.stroke();
  });

  // Transactions line (orange) — only if there's txn data
  const hasTxns=pts.some(p=>(p.txns||0)>0);
  if(hasTxns){
    ctx.beginPath();ctx.strokeStyle='#f59e0b';ctx.lineWidth=2;ctx.lineJoin='round';
    ctx.setLineDash([4,3]);
    pts.forEach((p,i)=>{const x=pad.l+i*xStep,y=pad.t+ch-(ch*(p.txns||0)/maxVal);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.stroke();ctx.setLineDash([]);
    pts.forEach((p,i)=>{
      const x=pad.l+i*xStep,y=pad.t+ch-(ch*(p.txns||0)/maxVal);
      ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);
      ctx.fillStyle='#f59e0b';ctx.fill();ctx.strokeStyle='#111111';ctx.lineWidth=1.5;ctx.stroke();
    });
  }

  // X labels
  pts.forEach((p,i)=>{
    const x=pad.l+i*xStep;
    ctx.fillStyle='#777777';ctx.font='10px -apple-system,sans-serif';ctx.textAlign='center';
    ctx.fillText(p.label,x,H-8);
  });

  // Wire touch tooltip (once)
  if(!canvas._touchBound){
    canvas._touchBound=true;
    canvas.addEventListener('touchstart',e=>{
      e.preventDefault();
      const rect=canvas.getBoundingClientRect();
      const tx=e.touches[0].clientX-rect.left;
      chartShowTooltip(canvas,tx);
    },{passive:false});
    canvas.addEventListener('click',e=>{
      const rect=canvas.getBoundingClientRect();
      chartShowTooltip(canvas,e.clientX-rect.left);
    });
  }
}

function chartShowTooltip(canvas,tapX){
  const pts=canvas._chartPts;
  const pad=canvas._chartPad;
  if(!pts||pts.length<2)return;
  const cw=canvas.width-pad.l-pad.r;
  const xStep=cw/(pts.length-1);
  // Find nearest point
  let nearest=0,minDist=Infinity;
  pts.forEach((p,i)=>{
    const x=pad.l+i*xStep;
    const d=Math.abs(tapX-x);
    if(d<minDist){minDist=d;nearest=i;}
  });
  const p=pts[nearest];
  // Show tooltip div
  let tip=$('chart-tooltip');
  if(!tip){
    tip=document.createElement('div');
    tip.id='chart-tooltip';
    tip.style.cssText='position:absolute;background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:8px 12px;font-size:12px;pointer-events:none;z-index:10;box-shadow:0 4px 16px rgba(0,0,0,.3);min-width:130px;';
    canvas.parentElement.style.position='relative';
    canvas.parentElement.appendChild(tip);
  }
  tip.innerHTML=`<div style="font-weight:700;color:var(--text);margin-bottom:4px">${p.label}</div>
    <div style="color:#5070f0">Expenses: <strong>${usd(p.expenses||0)}</strong></div>
    ${(p.txns||0)>0?`<div style="color:#f59e0b">Purchases: <strong>${usd(p.txns)}</strong></div>`:''}`;
  // Position tooltip
  const xPos=pad.l+(nearest*cw/(pts.length-1));
  const left=Math.min(xPos-65,canvas.width-150);
  tip.style.left=Math.max(4,left)+'px';
  tip.style.top='28px';
  tip.style.display='block';
  // Auto-hide after 2.5s
  clearTimeout(canvas._tipTimer);
  canvas._tipTimer=setTimeout(()=>{tip.style.display='none';},2500);
}

const PAGE_ORDER=['dashboard','bills','networth','insights','advisor'];
const TAB_MAP={dashboard:'dashboard',bills:'bills',quick:'bills',networth:'networth',cards:'networth',loans:'networth',insights:'insights',debt:'insights',cashflow:'insights',advisor:'advisor'};
let _currentSec='dashboard';
let _swipeDir=null;
let _touchStartX=0,_touchStartY=0,_touchLocked=false;

function showSub(sec,parentSec){
  _swipeDir=null;
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  $(sec).classList.add('active');
  _currentSec=parentSec;
  document.querySelectorAll('.mtab').forEach(t=>t.classList.remove('active'));
  const mt=$('mtab-'+(TAB_MAP[parentSec]||parentSec));
  if(mt) mt.classList.add('active');
  renderAlerts();
  if(sec==='bills') renderBills();
  else if(sec==='dashboard') renderDashboard();
  else if(sec==='networth') renderNetWorth();
  else if(sec==='debt') renderDebt();
  else if(sec==='insights') renderInsights();
  if(sec==='cards') setTimeout(()=>renderCards(),50);
  if(sec==='loans') setTimeout(()=>renderLoans(),50);
  if(sec==='quick') setTimeout(()=>renderTxns(),50);
  if(sec==='bills-manage') setTimeout(()=>renderBillsManage(),50);
}

function _initSwipe(){
  const el=$('content');
  if(!el)return;
  el.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    _touchStartX=e.touches[0].clientX;
    _touchStartY=e.touches[0].clientY;
    _touchLocked=false;
  },{passive:true});
  el.addEventListener('touchmove',e=>{
    if(_touchLocked||e.touches.length!==1)return;
    const dx=e.touches[0].clientX-_touchStartX;
    const dy=e.touches[0].clientY-_touchStartY;
    if(Math.abs(dx)<8&&Math.abs(dy)<8)return;
    // Lock to vertical if mostly vertical — let normal scroll happen
    if(Math.abs(dy)>Math.abs(dx)){_touchLocked=true;}
  },{passive:true});
  el.addEventListener('touchend',e=>{
    if(_touchLocked)return;
    if(window.innerWidth>680)return; // desktop — don't intercept
    if(e.target.closest('.swipe-wrap'))return; // item swipe in progress — don't navigate
    const dx=e.changedTouches[0].clientX-_touchStartX;
    const dy=e.changedTouches[0].clientY-_touchStartY;
    if(Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.4)return;
    // Sidebar open + swipe left → close sidebar
    if(dx<0&&$('sidebar').classList.contains('open')){
      haptic('light');
      closeSidebar();
      return;
    }
    const idx=PAGE_ORDER.indexOf(_currentSec);
    if(dx<0&&idx<PAGE_ORDER.length-1){
      _swipeDir='right';
      haptic('light');
      show(PAGE_ORDER[idx+1],null);
    } else if(dx>0&&idx>0){
      _swipeDir='left';
      haptic('light');
      show(PAGE_ORDER[idx-1],null);
    } else if(dx>0&&idx===0){
      // Swipe right from Dashboard → open sidebar (Menu)
      haptic('light');
      $('sidebar').classList.add('open');
    }
  },{passive:true});
}
function show(sec,btn){
  if(sec==='networth') setTimeout(drawNWHistoryChart,80);
  // Collapse simulator when leaving debt section
  if(sec!=='debt'){
    const inputs=$('promo-sim-inputs'); if(inputs) inputs.style.display='none';
    const actions=$('promo-sim-actions'); if(actions) actions.style.display='none';
    const res=$('promo-result'); if(res) res.innerHTML='';
    document.querySelectorAll('.promo-tab').forEach(b=>b.classList.remove('active'));
    promoScenario='promo';
  }
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  // Determine swipe direction for animation
  const dir=_swipeDir||'right';
  _swipeDir=null;
  const el=$(sec);
  el.classList.add('active');
  if(window.innerWidth<=680){
    el.classList.add(dir==='right'?'swipe-in-right':'swipe-in-left');
    setTimeout(()=>el.classList.remove('swipe-in-right','swipe-in-left'),280);
  }
  if(btn) btn.classList.add('active');
  // Sync mobile tab strip using TAB_MAP
  document.querySelectorAll('.mtab').forEach(t=>t.classList.remove('active'));
  const activeTab=$('mtab-'+(TAB_MAP[sec]||sec));
  if(activeTab){
    activeTab.classList.add('active');
    const strip=$('mobile-tabs');
    if(strip){
      const tabCenter=activeTab.offsetLeft+activeTab.offsetWidth/2;
      strip.scrollTo({left:tabCenter-strip.offsetWidth/2,behavior:'smooth'});
    }
  }
  _currentSec=PAGE_ORDER.includes(sec)?sec:(
    sec==='quick'?'quick':sec==='cards'?'networth':sec==='debt'?'insights':sec
  );
  closeSidebar();
  renderAlerts();
  if(sec==='dashboard') renderDashboard();
  else if(sec==='bills') renderBills();
  else if(sec==='networth') renderNetWorth();
  else if(sec==='debt') renderDebt();
  else if(sec==='cashflow') renderCashFlow();
  else if(sec==='insights') renderInsights();
  // Force re-render sections that depend on visibility (chart width, etc.)
  if(sec==='insights'){
    const months=parseInt($('chart-months')?$('chart-months').value:3)||3;
    setTimeout(()=>drawChart(getMonthlyExpenses(months)),80);
  }
  if(sec==='cards') setTimeout(()=>renderCards(),50);
  if(sec==='loans') setTimeout(()=>renderLoans(),50);
  if(sec==='quick') setTimeout(()=>renderTxns(),50);
  if(sec==='bills-manage') setTimeout(()=>renderBillsManage(),50);
  if(sec==='advisor') setTimeout(()=>renderAdvisor(),50);
}

// ── MODALS ───────────────────────────────────────
function openModal(type,extra){
  if(type==='goal'){openModal_goal();return;}
  if(type==='income'){$('i-id').value='';$('i-source').value='';$('i-amount').value='';$('i-date').value=today();$('i-freq').value='Monthly';$('i-account').value='';const n=$('i-update-note');if(n)n.style.display='none';if($('i-lastpay'))$('i-lastpay').value='';if($('i-lastpay-wrap'))$('i-lastpay-wrap').style.display='none';populateAccountSelects();}
  if(type==='expense'){clearOverlapWarn('expense-overlap-warn');$('expense-modal-title').textContent='Add Expense';$('e-id').value='';$('e-cat').value='';$('e-desc').value='';if($('e-autolog'))$('e-autolog').checked=false;if($('autolog-account-wrap'))$('autolog-account-wrap').style.display='none';$('e-amount').value='';$('e-date').value=today();$('e-freq').value='One-time';populateAccountSelects();}
  if(type==='bill'){clearOverlapWarn('bill-overlap-warn');$('bill-modal-title').textContent='Add Bill / Debt';$('b-id').value='';$('b-name').value='';if($('b-autolog'))$('b-autolog').checked=false;if($('b-autolog-wrap'))$('b-autolog-wrap').style.display='none';if($('b-autolog-account-wrap'))$('b-autolog-account-wrap').style.display='none';$('b-amount').value='';$('b-date').value='';$('b-recur').value='No';$('b-type').value='bill';$('b-balance').value='';$('b-apr').value='';$('b-limit').value='';$('b-original').value='';if($('b-url'))$('b-url').value='';
  // Collapse More options on fresh add
  if($('b-more-fields'))$('b-more-fields').style.display='none';
  if($('b-more-chevron'))$('b-more-chevron').textContent='▾';
  toggleDebtFields();$('bill-delete-wrap').style.display='none';}
  if(type==='account'){$('account-modal-title').textContent='Add Account';$('ac-id').value='';$('ac-name').value='';$('ac-type').value='checking';$('ac-balance').value='';$('ac-notes').value='';$('ac-apy').value='';if($('ac-url'))$('ac-url').value='';$('ac-default').checked=false;$('account-delete-wrap').style.display='none';toggleAcApyField();}
  if(type==='purchase'){openPurchaseModal();return;}
  if(type==='txn'){openWithdrawal();return;}
  if(type==='goal'){openModal_goal();return;}
  if(type==='asset'){$('asset-modal-title').textContent='Add Asset';$('a-id').value='';$('a-name').value='';$('a-cat').value='cash';$('a-value').value='';$('a-notes').value='';$('a-purchase-date').value='';$('a-original-value').value='';$('a-depr-rate').value='';$('a-linked-bill').value='';$('asset-delete-wrap').style.display='none';toggleAssetFields();}
  if(type==='target'){openAddTarget();return;}
  if(type==='settings'){
    const pin=localStorage.getItem(PIN_KEY);
    $('pin-status-text').textContent=t(pin?'PIN is active. App locks on startup.':'No PIN set. Add a PIN to lock the app on startup.');
    $('pin-setup-btn').textContent=t(pin?'Change PIN':'Set Up PIN');
    // Highlight active language
    ['en','es'].forEach(l=>{
      const btn=$('lang-'+l);
      if(btn) btn.style.background=appLang===l?'var(--accent)':'rgba(255,255,255,.06)';
      if(btn) btn.style.color=appLang===l?'#fff':'var(--text)';
    });
    updateThemeButtons();
  }
  $('modal-'+type).classList.add('open');
  setTimeout(()=>{const f=$('modal-'+type).querySelector('input:not([type=hidden])');if(f)f.focus();},260);
}
function closeModal(type){$('modal-'+type).classList.remove('open');}
document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));

function toggleDebtFields(){
  const t=$('b-type').value;
  const isDebt=t==='creditcard'||t==='loan';
  $('debt-fields').style.display=isDebt?'block':'none';
  $('b-limit-wrap').style.display=t==='creditcard'?'block':'none';
  $('b-original-wrap').style.display=t==='loan'?'block':'none';
  // Auto-expand More options when credit card or loan is selected
  if(isDebt) expandBillMore();
}

function toggleBillMore(){
  const fields=$('b-more-fields');
  const chev=$('b-more-chevron');
  const open=fields.style.display==='block';
  fields.style.display=open?'none':'block';
  if(chev) chev.textContent=open?'▾':'▴';
}

function expandBillMore(){
  const fields=$('b-more-fields');
  const chev=$('b-more-chevron');
  if(fields&&fields.style.display!=='block'){
    fields.style.display='block';
    if(chev) chev.textContent='▴';
  }
}

// ── EDIT OPENERS ─────────────────────────────────
function openEditIncome(id){
  const i=data.income.find(x=>x.id===id);if(!i)return;
  $('income-modal-title').textContent='Edit Income';
  $('i-id').value=i.id;$('i-source').value=i.source;$('i-amount').value=i.amount;
  $('i-date').value=i.date||'';$('i-freq').value=i.frequency;
  onIncomeFreqChange();
  if($('i-lastpay')) $('i-lastpay').value=i.lastPayDate||'';
  populateAccountSelects();
  $('i-account').value=i.accountId||'';
  // Show actual override field only for recurring income
  const isRecurring=i.frequency!=='One-time';
  const note=$('i-update-note');
  if(note) note.style.display=isRecurring?'block':'none';
  $('modal-income').classList.add('open');
}
function openEditBill(id){
  const b=data.bills.find(x=>x.id===id);if(!b)return;
  $('bill-modal-title').textContent='Edit Bill / Debt';
  $('b-id').value=b.id;$('b-name').value=b.name;$('b-amount').value=b.amount;$('b-date').value=b.dueDate;$('b-recur').value=b.recurring;
  $('b-type').value=b.btype||'bill';$('b-balance').value=b.balance||'';$('b-apr').value=b.apr||'';$('b-limit').value=b.creditLimit||'';$('b-original').value=b.originalLoanAmount||'';
  if($('b-url'))$('b-url').value=b.url||'';
  toggleDebtFields();
  // Always expand More options on edit so existing data is visible
  expandBillMore();
  $('bill-delete-wrap').style.display='block';
  // Wire auto-log fields
  const wrap=$('b-autolog-wrap'); const chk=$('b-autolog'); const aWrap=$('b-autolog-account-wrap');
  if(wrap) wrap.style.display=(b.recurring&&b.recurring!=='No')?'block':'none';
  if(chk) chk.checked=!!b.autoLog;
  if(aWrap) aWrap.style.display=b.autoLog?'block':'none';
  if(b.autoLog) populateAutoLogAccountSelect('b-autolog-account');
  const sel=$('b-autolog-account'); if(sel&&b.autoLogAccountId) sel.value=b.autoLogAccountId;
  $('modal-bill').classList.add('open');
}
function deleteBillFromModal(inlineId){
  const id=inlineId||parseInt($('b-id').value);
  const b=data.bills.find(x=>x.id===id);
  if(!b)return;
  if(!inlineId) closeModal('bill');
  deleteItem('bills',id);
}
function openEditTxn(id){
  const t=data.transactions.find(x=>x.id===id);if(!t)return;
  // Route to dedicated modals by type
  if(t.type==='Transfer'){
    openEditTransfer(id);
    return;
  }
  if(t.type==='Purchase'){
    openEditPurchase(id);
    return;
  }
  currentTxnType=t.type;
  $('txn-title').textContent='Edit: '+t.type;
  $('t-id').value=t.id;$('t-desc').value=t.description;$('t-amount').value=t.amount;$('t-date').value=t.date||today();
  $('t-note').value=t.note||'';
  $('t-overdraft-warn').style.display='none';
  populateAccountSelects();
  $('t-account').value=t.accountId||'';
  $('modal-txn').classList.add('open');
}

function openEditTransfer(id){
  const t=data.transactions.find(x=>x.id===id);if(!t)return;
  const accs=data.accounts||[];
  if(accs.length<2){showToast('Need at least 2 accounts to edit a transfer.','error');return;}
  const opts=accs.map(a=>`<option value="${a.id}">${acTypeIcon[a.type]||'🏦'} ${a.name} (${usd(a.balance)})</option>`).join('');
  $('tr-from').innerHTML='<option value="">-- Select account --</option>'+opts;
  $('tr-to').innerHTML='<option value="">-- Select account --</option>'+opts;
  $('tr-from').value=t.accountId||'';
  $('tr-to').value=t.toAccountId||'';
  $('tr-amount').value=t.amount;
  $('tr-date').value=t.date||today();
  $('tr-note').value=t.note||'';
  $('tr-overdraft-warn').style.display='none';
  // Store original tx id so saveTransfer knows it's an edit
  $('modal-transfer').dataset.editId=id;
  $('modal-transfer').classList.add('open');
  setTimeout(()=>$('tr-amount').focus(),260);
}

// ── SAVE FUNCTIONS ───────────────────────────────
function saveIncome(){
  const src=$('i-source').value.trim(),amt=sanitizeNum($('i-amount').value),freq=$('i-freq').value,dt=$('i-date').value,acId=parseInt($('i-account').value)||0;
  const lastPayDate=freq==='Bi-weekly'&&$('i-lastpay')?$('i-lastpay').value:null;
  if(!src||!amt)return;
  const eid=parseInt($('i-id').value);
  const prev=eid?data.income.find(i=>i.id===eid):null;
  // If base amount changed, clear occurrenceOverrides so new amount reflects on all cards
  const amountChanged=prev&&prev.amount!==amt;
  const occurrenceOverrides=amountChanged?{}:(prev&&prev.occurrenceOverrides?prev.occurrenceOverrides:{});
  // Reverse previous account credit if editing
  if(prev&&prev.accountId) adjustAccountBalance(prev.accountId,-prev.amount);
  // Auto-mark as Received if the logged date is today or in the past
  // One-time: mark that specific date
  // Recurring: mark only the initial date entry (user manages future occurrences manually)
  const existingOverrides=prev&&prev.incomeStatusOverrides?{...prev.incomeStatusOverrides}:{};
  if(dt&&dt<=today()&&!existingOverrides[dt]){
    existingOverrides[dt]='Received';
  }
  const item={id:eid||Date.now(),source:src,amount:amt,frequency:freq,date:dt,accountId:acId,
    actualAmount:null,actualMonth:null,
    lastPayDate:lastPayDate||null,
    occurrenceOverrides,
    incomeStatusOverrides:existingOverrides};
  data.income=eid?data.income.map(i=>i.id===eid?item:i):[...data.income,item];
  if(acId) adjustAccountBalance(acId,amt);
  closeModal('income');saveData();renderSections('alerts','bills','dashboard','insights');
}

// ── OCCURRENCE OVERRIDE ───────────────────────────────────────
function openOccurrenceModal(incomeId, date, scheduledAmount){
  const i=data.income.find(x=>x.id===incomeId);
  if(!i) return;
  $('occ-income-id').value=incomeId;
  $('occ-date').value=date;
  $('occ-source-label').textContent=i.source;
  $('occ-date-label').textContent=fmtDate(date);
  $('occ-scheduled').textContent=usd(scheduledAmount);
  const existing=(i.occurrenceOverrides||{})[date];
  $('occ-amount').value=existing!=null?existing:'';
  $('modal-occurrence').classList.add('open');
}
function saveOccurrenceOverride(){
  const id=parseInt($('occ-income-id').value);
  const date=$('occ-date').value;
  const raw=$('occ-amount').value.trim();
  const val=parseFloat(raw);
  const i=data.income.find(x=>x.id===id);
  if(!i) return;
  if(!i.occurrenceOverrides) i.occurrenceOverrides={};
  if(raw===''||isNaN(val)||val<0){
    delete i.occurrenceOverrides[date];
  } else {
    i.occurrenceOverrides[date]=parseFloat(val.toFixed(2));
  }
  saveData();closeModal('occurrence');renderSections('bills','dashboard','insights');
  showToast('Payment updated');
}
function clearOccurrenceOverride(){
  const id=parseInt($('occ-income-id').value);
  const date=$('occ-date').value;
  const i=data.income.find(x=>x.id===id);
  if(i&&i.occurrenceOverrides) delete i.occurrenceOverrides[date];
  saveData();closeModal('occurrence');renderSections('bills','dashboard','insights');
  showToast('Override cleared');
}



// ── TAP TO EXPAND CARDS ───────────────────────────────────────
function toggleCardExpand(id){
  const panel=$('cact-'+id);
  const chev=$('cchev-'+id);
  if(!panel) return;
  const open=panel.style.display==='flex';
  panel.style.display=open?'none':'flex';
  if(chev) chev.innerHTML=open?'&#9662;':'&#9652;';
}

// ── INCOME STATUS (in Bills view) ────────────────────────────
function getIncomeOccurrenceStatus(income, date){
  return (income.incomeStatusOverrides||{})[date]||'Expected';
}
function setIncomeOccurrenceStatus(incomeId, date, status){
  const i=data.income.find(x=>x.id===incomeId);
  if(!i) return;
  if(!i.incomeStatusOverrides) i.incomeStatusOverrides={};
  if(status==='Expected') delete i.incomeStatusOverrides[date];
  else i.incomeStatusOverrides[date]=status;
  saveData(); renderSections('alerts','bills','dashboard');
}
function incomeStatusColor(s){
  return{Expected:'#f59e0b',Received:'#22c55e',Missed:'#ef4444'}[s]||'#888';
}

// renderIncomeCard lives in render_bills.js

function openEditExpense(id){
  const e=data.expenses.find(x=>x.id===id); if(!e) return;
  openModal('expense');
  $('expense-modal-title').textContent='Edit Expense';
  $('e-id').value=e.id;
  $('e-cat').value=e.category||'';
  $('e-desc').value=e.description||'';
  $('e-amount').value=e.amount||'';
  $('e-date').value=e.date||today();
  $('e-freq').value=e.frequency||'One-time';
  if($('e-autolog')){
    $('e-autolog').checked=!!e.autoLog;
    const wrap=$('autolog-account-wrap');
    if(wrap) wrap.style.display=e.autoLog?'block':'none';
  }
  if(e.autoLog) populateAutoLogAccountSelect('e-autolog-account');
  if($('e-autolog-account')&&e.autoLogAccountId) $('e-autolog-account').value=e.autoLogAccountId;
  populateAccountSelects();
}

function saveExpense(){
  const autoLog = $('e-autolog') ? $('e-autolog').checked : false;
  const autoLogAccountId = parseInt($('e-autolog-account')?.value)||0;
  const cat=$('e-cat').value,desc=$('e-desc').value.trim(),amt=sanitizeNum($('e-amount').value),dt=$('e-date').value,freq=$('e-freq').value,acId=0;
  if(!cat||!amt)return;
  const eid=parseInt($('e-id').value);
  const prev=eid?data.expenses.find(e=>e.id===eid):null;
  const _doSaveExpense=()=>{
    // Reverse previous account debit if editing
    if(prev&&prev.accountId) adjustAccountBalance(prev.accountId,prev.amount);
    const item={id:eid||Date.now(),category:cat,description:desc,amount:amt,date:dt,frequency:freq,accountId:acId,autoLog,autoLogAccountId};
    data.expenses=eid?data.expenses.map(e=>e.id===eid?item:e):[...data.expenses,item];
    if(acId) adjustAccountBalance(acId,-amt);
    closeModal('expense');saveData();renderSections('alerts','bills','dashboard','insights','debt');
  };
  if(acId){
    const bal=getAccountBalance(acId);
    if(bal!==null&&amt>bal){
      showConfirm({
        icon:'⚠️', title:'Overdraft warning',
        msg:'This expense of '+usd(amt)+' would overdraw this account by '+usd(amt-bal)+'. Continue anyway?',
        okLabel:'Continue', okStyle:'background:var(--yellow);color:#000',
        onOk:_doSaveExpense
      });
      return;
    }
  }
  _doSaveExpense();
}
// sanitizeNum lives in utils.js

// BILLER_URLS, linkHost, normUrl, suggestBillerUrl live in utils.js

function openLink(url){
  if(!url)return;
  window.open(normUrl(url),'_blank','noopener,noreferrer');
}

function saveBill(){
  const autoLog = $('b-autolog') ? $('b-autolog').checked : false;
  const autoLogAccountId = sanitizeNum($('b-autolog-account')?.value);
  const name=$('b-name').value.trim(),amt=sanitizeNum($('b-amount').value),dt=$('b-date').value,rec=$('b-recur').value,btype=$('b-type').value;
  const balance=sanitizeNum($('b-balance').value);
  const apr=sanitizeNum($('b-apr').value);
  const creditLimit=btype==='creditcard'?sanitizeNum($('b-limit').value):0;
  const originalLoanAmount=btype==='loan'?(sanitizeNum($('b-original').value)||0):0;
  const rawUrl=($('b-url')&&$('b-url').value.trim())||'';
  const billUrl=rawUrl?normUrl(rawUrl):'';
  if(!name || (!amt && btype !== 'creditcard' && btype !== 'loan'))return;
  // Validate original loan amount
  if(btype==='loan' && originalLoanAmount>0 && originalLoanAmount<balance){
    showToast('Original loan amount can\'t be less than current balance.','error');
    return;
  }
  const eid=parseInt($('b-id').value);
  const prev=eid?data.bills.find(b=>b.id===eid):null;
  const isDebt=btype==='creditcard'||btype==='loan';
  // For loans: use user-entered original amount as originalBalance anchor; for cards: preserve prev or default to balance
  const computedOriginalBalance = btype==='loan' && originalLoanAmount>0
    ? originalLoanAmount
    : (prev&&prev.originalBalance ? Math.max(prev.originalBalance, balance) : balance);
  const item={id:eid||Date.now(),name,amount:amt,dueDate:dt,recurring:rec,
    status: autoLog && (!prev || prev.status==='Pending') ? 'Scheduled' : (prev?prev.status:'Pending'),btype,
    balance:isDebt?balance:0,apr:isDebt?apr:0,creditLimit,
    originalLoanAmount:btype==='loan'?originalLoanAmount:0,
    originalBalance:isDebt?computedOriginalBalance:0,
    autoLog,autoLogAccountId,
    scheduledAmount:prev?prev.scheduledAmount:null,
    scheduledAccountId:prev?prev.scheduledAccountId:null,
    url:billUrl||undefined
  };
  data.bills=eid?data.bills.map(b=>b.id===eid?item:b):[...data.bills,item];
  closeModal('bill');updateOriginalBalances();saveData();renderSections('alerts','bills','dashboard','debt','networth','insights');
}

function onBillUrlInput(val){
  // Auto-suggest a URL when the bill name field drives input, or user types in url field
  const urlField=$('b-url');
  if(!urlField||urlField.value.trim())return; // don't overwrite if user already typed something
  const suggested=suggestBillerUrl(val);
  if(suggested) urlField.value=suggested;
}

function autofillBillUrl(){
  // Called when bill name changes — try to auto-fill url if empty
  const nameVal=$('b-name')&&$('b-name').value.trim();
  const urlField=$('b-url');
  if(!urlField||!nameVal||urlField.value.trim())return;
  const suggested=suggestBillerUrl(nameVal);
  if(suggested) urlField.value=suggested;
}

function saveCard(){
  const name=$('c-name').value.trim(),last4=$('c-last4').value.trim(),days=parseInt($('c-days').value),notes=$('c-notes').value.trim();
  if(!name)return;
  const next=new Date();next.setDate(next.getDate()+days);
  data.cards.push({id:Date.now(),name,last4,reminderDays:days,nextReminder:next.toISOString().split('T')[0],notes});
  $('c-name').value='';$('c-last4').value='';$('c-notes').value='';
  closeModal('card');saveData();renderSections('cards');
}
function openWithdrawal(){
  currentTxnType='Withdrawal'; 
  $('txn-title').textContent='Cash Withdrawal';
  $('t-id').value='';$('t-desc').value='';$('t-amount').value='';$('t-date').value=today();
  $('t-overdraft-warn').style.display='none';
  populateAccountSelects();
  $('t-account').value=getDefaultAccountId()||'';
  $('modal-txn').classList.add('open');
  setTimeout(()=>$('t-desc').focus(),260);
}
function checkWithdrawalOverdraft(){
  const acId=$('t-account').value;
  const amt=parseFloat($('t-amount').value)||0;
  const warn=$('t-overdraft-warn');
  if(!acId||!amt){warn.style.display='none';return;}
  const bal=getAccountBalance(acId);
  if(bal!==null&&amt>bal){
    warn.style.display='block';
    warn.textContent='Warning: this withdrawal of '+usd(amt)+' would overdraw this account by '+usd(amt-bal)+'.';
  } else { warn.style.display='none'; }
}
function saveTxn(){
  const desc=$('t-desc').value.trim(),amt=parseFloat($('t-amount').value),dt=$('t-date').value||today();
  const acId=parseInt($('t-account').value)||0;
  const note=$('t-note')?$('t-note').value.trim():'';
  if(!desc||!amt)return;
  if(!acId){showToast(t('Please select a Pay From account'),'error');return;}
  const _doSaveTxn=()=>{
    const eid=parseInt($('t-id').value);
    if(eid){
      const prev=data.transactions.find(t=>t.id===eid);
      if(prev&&prev.accountId) adjustAccountBalance(prev.accountId,prev.amount);
    }
    const item={id:eid||Date.now(),description:desc,amount:amt,type:'Withdrawal',date:dt,accountId:acId,note};
    data.transactions=eid?data.transactions.map(t=>t.id===eid?item:t):[...data.transactions,item];
    if(acId) adjustAccountBalance(acId,-amt);
    closeModal('txn');saveData();renderSections('dashboard','txns','insights','cards');
  };
  if(acId){
    const bal=getAccountBalance(acId);
    if(bal!==null&&amt>bal){
      showConfirm({
        icon:'⚠️', title:'Overdraft warning',
        msg:'This withdrawal of '+usd(amt)+' would overdraw this account by '+usd(amt-bal)+'. Continue anyway?',
        okLabel:'Continue', okStyle:'background:var(--yellow);color:#000',
        onOk:_doSaveTxn
      });
      return;
    }
  }
  _doSaveTxn();
}

// ── SWIPE TO DELETE ────────────────────────────────
function initSwipe(wrap, onDeleteFn, onEditFn){
  const inner=wrap.firstElementChild;
  const twoBtn=!!onEditFn;
  const snapDist=twoBtn?160:80;
  const swipedClass=twoBtn?'swiped-2':'swiped';
  let startX=0,startY=0,dx=0,swiped=false,locked=false,_swipeFired=false;
  wrap.addEventListener('touchstart',e=>{
    startX=e.touches[0].clientX;startY=e.touches[0].clientY;
    dx=0;locked=false;inner.style.transition='none';
  },{passive:true});
  wrap.addEventListener('touchmove',e=>{
    const diffX=e.touches[0].clientX-startX,diffY=e.touches[0].clientY-startY;
    if(!locked){
      if(Math.abs(diffX)<8&&Math.abs(diffY)<8)return;
      if(Math.abs(diffY)>Math.abs(diffX)){locked=true;return;}
    }
    if(locked)return;
    dx=Math.min(0,diffX);
    inner.style.transform='translateX('+Math.max(dx,-snapDist)+'px)';
    e.preventDefault();
    e.stopPropagation();
  },{passive:false});
  wrap.addEventListener('touchend',e=>{
    inner.style.transition='';
    if(dx<-50){inner.style.transform='translateX(-'+snapDist+'px)';wrap.classList.add(swipedClass);swiped=true;_swipeFired=true;e.stopPropagation();setTimeout(()=>{_swipeFired=false;},350);}
    else{inner.style.transform='';wrap.classList.remove(swipedClass);swiped=false;}
    dx=0;
  });
  wrap.addEventListener('click',e=>{
    if(_swipeFired) return;
    if(swiped&&!e.target.closest('.swipe-actions')){
      inner.style.transform='';wrap.classList.remove(swipedClass);swiped=false;
    }
  });
  if(twoBtn){
    const actions=wrap.querySelector('.swipe-actions');
    if(actions){
      const delBtn=actions.querySelector('.swipe-action-del');
      const editBtn=actions.querySelector('.swipe-action-edit');
      if(delBtn) delBtn.addEventListener('click',()=>onDeleteFn());
      if(editBtn) editBtn.addEventListener('click',()=>onEditFn());
    }
  }
}

function wrapSwipeable(html, key, id, editAction){
  return '<div class="swipe-wrap">'+html
    +'<div class="swipe-actions" data-key="'+key+'" data-id="'+id+'" data-edit="'+editAction+'">'
    +'<div class="swipe-action-edit"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></div>'
    +'<div class="swipe-action-del"><svg viewBox="0 0 24 24"><path d="M9 3h6l1 1h4v2H4V4h4zm-4 5h14l-1 13H6zm5 2v9h1v-9zm4 0v9h1v-9z"/></svg></div>'
    +'</div></div>';
}

function attachSwipes(){
  document.querySelectorAll('.swipe-wrap').forEach(wrap=>{
    if(wrap._swipeInited) return;
    wrap._swipeInited=true;
    const actions=wrap.querySelector('.swipe-actions');
    if(!actions) return;
    const key=actions.getAttribute('data-key');
    const id=parseInt(actions.getAttribute('data-id'));
    const editFnName=actions.getAttribute('data-edit');
    const onDelete=()=>{ if(key&&id) deleteItem(key,id); };
    const onEdit=()=>{ if(editFnName) eval(editFnName); };
    initSwipe(wrap, onDelete, onEdit);
  });
}

// ── BILL SORT ─────────────────────────────────────────
function setBillSort(s){
  billSort=s;
  ['date','status','amount','type'].forEach(k=>{
    const b=$('bs-'+k);if(b)b.classList.toggle('active',k===s);
  });
  renderBills();
}

// ── TRANSACTION SEARCH ──────────────────────────────
function setTxnSearch(val){
  txnSearch=val.trim().toLowerCase();
  const clr=$('txn-clear');if(clr)clr.style.display=txnSearch?'block':'none';
  // Auto-enable all-months when searching so results aren't hidden by month filter
  if(txnSearch && !txnAllMonths){ txnAllMonths=true; _updateAllMonthsBtn(); }
  renderTxns();
}
function clearTxnSearch(){
  txnSearch='';
  const inp=$('txn-search');if(inp)inp.value='';
  const clr=$('txn-clear');if(clr)clr.style.display='none';
  // Reset all-months when search is cleared
  if(txnAllMonths){ txnAllMonths=false; _updateAllMonthsBtn(); }
  renderTxns();
}
function toggleTxnAllMonths(){
  txnAllMonths=!txnAllMonths;
  _updateAllMonthsBtn();
  renderTxns();
}
function _updateAllMonthsBtn(){
  const btn=$('txn-all-months-btn');
  if(!btn)return;
  btn.style.background=txnAllMonths?'var(--accent)':'rgba(255,255,255,.06)';
  btn.style.color=txnAllMonths?'#fff':'var(--muted)';
  btn.style.borderColor=txnAllMonths?'var(--accent)':'var(--border2)';
  // Show/hide the month nav arrows when in all-months mode
  const nav=$('txn-month-label');
  const prev=document.querySelector('.mn-btn');
  const next=$('txn-month-next');
  [prev,next,nav].forEach(el=>{ if(el) el.style.opacity=txnAllMonths?'0.3':'1'; });
}

// ── EMPTY STATE HELPER ──────────────────────────────
// emptyState lives in utils.js

// ── DATA HELPERS ─────────────────────────────────

function autoProcessScheduledBills(){
  let changed=false;
  data.bills.forEach(b=>{
    if(b.status!=='Scheduled') return;
    const d=daysUntil(b.dueDate);
    if(d>0) return; // only process today (d===0) or overdue (d<0)
    const amt=b.scheduledAmount||b.amount||0;
    const acId=b.scheduledAccountId||0;
    // Debit linked account
    if(acId) adjustAccountBalance(acId,-amt);
    // If debt, reduce balance
    if((b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo')&&b.balance>0){
      migrateRevolvingBalance(b);
      const monthlyRate=(b.apr||0)/100/12;
      // Interest only on revolving portion (skip if flagged as no-interest payment)
      const interest=b.noInterestPayment?0:parseFloat(((b.revolvingBalance||0)*monthlyRate).toFixed(2));
      const principal=Math.max(0,amt-interest);
      b.revolvingBalance=parseFloat(Math.max(0,(b.revolvingBalance||0)-principal).toFixed(2));
      b.balance=parseFloat(Math.max(0,b.balance-principal).toFixed(2));
      delete b.noInterestPayment; // clear after use
    }
    // Log transaction
    data.transactions.push({
      id:Date.now()+Math.random(),
      description:b.name+' payment (auto-processed)',
      amount:parseFloat(amt.toFixed(2)),
      type:(b.btype==='creditcard'||b.btype==='loan')?'Debt Payment':'Bill Payment',
      date:b.dueDate||today(),
      accountId:acId,
      autoLogRef: b.autoLog ? b.id : undefined
    });
    // Advance due date if recurring
    if(b.dueDate&&b.recurring&&b.recurring!=='No'){
      const dd=new Date(b.dueDate);
      if(b.recurring==='Monthly') dd.setMonth(dd.getMonth()+1);
      else if(b.recurring==='Weekly') dd.setDate(dd.getDate()+7);
      else if(b.recurring==='Yearly') dd.setFullYear(dd.getFullYear()+1);
      b.dueDate=dd.toISOString().split('T')[0];
      b.status='Pending';
      b.scheduledAmount=null;
      b.scheduledAccountId=null;
    } else {
      b.status='Paid';
    }
    changed=true;
  });
  if(changed) saveData();
}
function saveBillDueDate(id){
  const b=data.bills.find(x=>x.id===id);if(!b)return;
  const input=$('due-edit-'+id);if(!input)return;
  const newDate=input.value;
  if(!newDate){showToast('Please enter a valid date','error');return;}
  b.dueDate=newDate;
  saveData();renderSections('alerts','bills','dashboard');
  showToast('Due date updated!');
}

function revertToPending(id){
  const b=data.bills.find(x=>x.id===id);if(!b)return;
  showConfirm({
    icon:'↩️', title:'Cancel scheduled payment?',
    msg:b.name+' will return to Pending status.',
    okLabel:'Cancel Payment', okStyle:'background:var(--red);color:#fff',
    onOk:()=>{
      b.status='Pending';
      b.scheduledAmount=null;
      saveData();renderSections('alerts','bills','dashboard','debt');renderBillsManage();
    }
  });
}

// flashBillCard lives in utils.js

let _scheduleExpenseId=null;

function openScheduleExpense(id){
  const e=data.expenses.find(x=>x.id===id);if(!e)return;
  _scheduleExpenseId=id;
  _scheduleBillId=null;
  $('sb-name').textContent=e.description||e.category;
  $('sb-due').textContent=e.date?'Due: '+fmtDate(e.date):'';
  $('sb-min-val').textContent=usd(e.amount);
  $('sb-custom').value='';
  $('sb-custom').placeholder='e.g. '+e.amount;
  checkNoAccountsNudge('sb-no-accounts-nudge');
  populateAccountSelects();
  $('sb-account').value=getDefaultAccountId()||'';
  _sbAmount=e.amount;
  $('sb-min-btn').style.outline='2px solid var(--accent)';
  const sbWrap=$('sb-website-wrap');
  if(sbWrap) sbWrap.style.display='none';
  $('modal-schedulebill').classList.add('open');
}

function confirmScheduleExpense(){
  const e=data.expenses.find(x=>x.id===_scheduleExpenseId);if(!e)return;
  const amt=sanitizeNum($('sb-custom').value)||_sbAmount||e.amount;
  const acId=parseInt($('sb-account').value)||0;
  if(!amt||amt<=0){showToast('Enter a valid amount','error');return;}
  if(!acId){showToast('Please select a Pay From account','error');return;}
  const doMark=()=>{
    e.paidMonth=today().slice(0,7);
    adjustAccountBalance(acId,-amt);
    data.transactions.push({
      id:Date.now()+Math.random(),
      description:e.description||e.category,
      amount:amt,type:'Bill Payment',
      date:today(),accountId:acId,
      category:e.category,
      methodLabel:(data.accounts||[]).find(a=>a.id===acId)?.name||'',
      note:'Manual expense payment'
    });
    _scheduleExpenseId=null;
    closeModal('schedulebill');
    saveData();renderSections('bills','dashboard','insights');
    showToast('Expense logged — '+usd(amt));
  };
  const bal=getAccountBalance(acId);
  if(bal!==null&&amt>bal){
    showConfirm({
      icon:'⚠️',title:'Overdraft warning',
      msg:'This would overdraw the account by '+usd(amt-bal)+'. Continue anyway?',
      okLabel:'Continue',okStyle:'background:var(--yellow);color:#000',
      onOk:doMark
    });
    return;
  }
  doMark();
}

function undoExpensePaid(id){
  const e=data.expenses.find(x=>x.id===id);if(!e)return;
  e.paidMonth=null;
  saveData();renderSections('bills','dashboard','insights');
  showToast('Expense marked unpaid');
}
// Schedule regular (non-debt) bill
let _scheduleBillId=null;
function openScheduleBill(id){
  const b=data.bills.find(x=>x.id===id);if(!b)return;
  _scheduleBillId=id;
  _scheduleExpenseId=null;
  $('sb-name').textContent=b.name;
  $('sb-due').textContent='Due: '+fmtDate(b.dueDate);
  $('sb-min-val').textContent=usd(b.amount);
  $('sb-custom').value='';
  $('sb-custom').placeholder='e.g. '+b.amount;
  checkNoAccountsNudge('sb-no-accounts-nudge');
  populateAccountSelects();
  $('sb-account').value=getDefaultAccountId()||'';
  _sbAmount=b.amount;
  $('sb-min-btn').style.outline='2px solid var(--accent)';
  // Website button
  const sbWrap=$('sb-website-wrap'), sbBtn=$('sb-website-btn');
  if(sbWrap&&sbBtn){
    const url=b.url?normUrl(b.url):'';
    sbWrap.style.display=url?'block':'none';
    if(url){ sbBtn.href='https://'+url.replace(/^https?:\/\//,''); sbBtn.textContent=''; sbBtn.innerHTML='🌐 Go to '+url+' &nbsp;→'; }
  }
  $('modal-schedulebill').classList.add('open');
}
let _sbAmount=0;
function sbSelect(type){
  if(type==='min'){
    $('sb-min-btn').style.outline='2px solid var(--accent)';
    $('sb-custom').value='';
    const b=data.bills.find(x=>x.id===_scheduleBillId);
    if(b) _sbAmount=b.amount;
    // For expenses _sbAmount was already set in openScheduleExpense
  } else {
    $('sb-min-btn').style.outline='none';
    _sbAmount=sanitizeNum($('sb-custom').value)||0;
  }
}
function confirmScheduleBill(){
  if(_scheduleExpenseId){ confirmScheduleExpense(); return; }
  const b=data.bills.find(x=>x.id===_scheduleBillId);if(!b)return;
  const amt=sanitizeNum($('sb-custom').value)||_sbAmount||b.amount;
  const acId=parseInt($('sb-account').value)||0;
  if(!amt||amt<=0){showToast(t('Enter a valid amount'),'error');return;}
  if(!acId){showToast(t('Please select a Pay From account'),'error');return;}
  const _doSchedule=()=>{
    b.status='Scheduled';
    b.scheduledAmount=amt;
    b.scheduledAccountId=acId;
    closeModal('schedulebill');
    haptic('medium');
    saveData();renderSections('alerts','bills','dashboard','debt');
    flashBillCard(_scheduleBillId,'blue');
    showToast('Payment scheduled - '+usd(amt));
  };
  const bal=getAccountBalance(acId);
  if(bal!==null&&amt>bal){
    showConfirm({
      icon:'⚠️', title:'Overdraft warning',
      msg:'Scheduling '+usd(amt)+' would overdraw this account by '+usd(amt-bal)+'. Continue anyway?',
      okLabel:'Continue', okStyle:'background:var(--yellow);color:#000',
      onOk:_doSchedule
    });
  } else { _doSchedule(); }
}

// ── DEBT PAYMENT FLOW ────────────────────────────
let _payDebtId=null;
let _payDebtAmount=0;
let _payDebtType='min';
let _noInterest=false;

function openPayDebt(id){
  const b=data.bills.find(x=>x.id===id);if(!b)return;
  _payDebtId=id;
  $('pd-name').textContent=b.name;
  $('pd-balance').textContent=usd(b.balance||0);
  $('pd-apr').textContent=pct(b.apr||0);
  const minAmt=b.amount||0;
  const fullAmt=b.balance||0;
  $('pd-min-val').textContent=usd(minAmt);
  $('pd-sug-val').textContent=usd(minAmt);
  $('pd-full-val').textContent=usd(fullAmt);
  $('pd-custom').value='';
  $('pd-breakdown').style.display='none';
  // Statement Balance button
  const stmtBal=b.statementBalance||0;
  $('pd-sug-btn').style.display='';
  $('pd-sug-val').textContent=stmtBal>0?usd(stmtBal):'Set amount';
  // Reset no-interest state
  _noInterest=false;
  const niChk=$('pd-no-interest'),niWrap=$('pd-no-interest-wrap');
  if(niChk) niChk.checked=false;
  if(niWrap) niWrap.style.display='none';
  // Edit mode: pre-fill if already scheduled
  const confirmBtn=$('pd-confirm-btn');
  if(b.scheduledAmount){
    $('pd-custom').value=b.scheduledAmount;
    _payDebtAmount=b.scheduledAmount;
    _payDebtType='custom';
    highlightPayBtn(null);
    if(b.noInterestPayment){
      _noInterest=true;
      if(niChk){niChk.checked=true;}
    }
    if(niWrap) niWrap.style.display='block';
    updatePayBreakdown(b,b.scheduledAmount);
    if(confirmBtn) confirmBtn.textContent='Update Payment';
  } else {
    if(confirmBtn) confirmBtn.textContent='Confirm Payment';
  }
  checkNoAccountsNudge('pd-no-accounts-nudge');
  populateAccountSelects();
  $('pd-account').value=getDefaultAccountId()||'';
  _payDebtAmount=minAmt;
  _payDebtType='min';
  highlightPayBtn('pd-min-btn');
  updatePayBreakdown(b,minAmt);
  // ── Promo split balance display ───────────────────────────
  migrateRevolvingBalance(b);
  const revolving=getRevolvingBalance(b);
  const promoTotal=Math.max(0,(b.balance||0)-revolving);
  const hasPromo=promoTotal>0;
  const splitEl=$('pd-balance-split');
  if(splitEl) splitEl.style.display=hasPromo?'flex':'none';
  if(hasPromo){
    const monthlyRate=(b.apr||0)/100/12;
    const revInterest=parseFloat((revolving*monthlyRate).toFixed(2));
    if($('pd-revolving-val')) $('pd-revolving-val').textContent=usd(revolving);
    if($('pd-revolving-interest')) $('pd-revolving-interest').textContent=
      revolving>0?`~${usd(revInterest)}/mo interest`:'No revolving balance';
    if($('pd-promo-val')) $('pd-promo-val').textContent=usd(promoTotal);
    const promoItems=data.transactions.filter(tx=>tx.cardId===id&&tx.promoType&&tx.promoEnd);
    const activeItems=promoItems.filter(tx=>{
      const paid=data.transactions.filter(t=>t.promoRef===tx.id).reduce((s,t)=>s+t.amount,0);
      return tx.amount-paid>0.01;
    });
    if($('pd-promo-count')) $('pd-promo-count').textContent=activeItems.length+' active item'+(activeItems.length===1?'':'s');
  }
  const allocSec=$('pd-alloc-section');
  if(allocSec) allocSec.style.display=hasPromo?'block':'none';
  if(hasPromo) buildAllocRows(b);
  // Website button
  const pdWrap=$('pd-website-wrap'), pdBtn=$('pd-website-btn');
  if(pdWrap&&pdBtn){
    const url=b.url?normUrl(b.url):'';
    pdWrap.style.display=url?'block':'none';
    if(url){ pdBtn.href='https://'+url.replace(/^https?:\/\//,''); pdBtn.innerHTML='🌐 Go to '+url+' &nbsp;→'; }
  }
  if($('pd-due-date')) $('pd-due-date').value=b.dueDate||'';
  $('modal-paydebt').classList.add('open');
}

function selectPayAmount(type){
  const b=data.bills.find(x=>x.id===_payDebtId);if(!b)return;
  _payDebtType=type;
  const niChk=$('pd-no-interest'),niWrap=$('pd-no-interest-wrap');
  if(type==='min'){
    _payDebtAmount=b.amount||0;
    highlightPayBtn('pd-min-btn');
    _noInterest=false;
    if(niChk) niChk.checked=false;
    if(niWrap) niWrap.style.display='none';
  } else if(type==='statement'){
    const stmtAmt=b.statementBalance||0;
    if(stmtAmt>0){ $('pd-custom').value=stmtAmt; _payDebtAmount=stmtAmt; }
    else{ $('pd-custom').value=''; _payDebtAmount=0; setTimeout(()=>$('pd-custom').focus(),50); }
    highlightPayBtn('pd-sug-btn');
    _noInterest=true;
    if(niChk) niChk.checked=true;
    if(niWrap) niWrap.style.display='block';
  } else if(type==='full'){
    _payDebtAmount=b.balance||0;
    highlightPayBtn('pd-full-btn');
    _noInterest=true;
    if(niChk) niChk.checked=true;
    if(niWrap) niWrap.style.display='block';
  } else if(type==='custom'){
    _payDebtAmount=sanitizeNum($('pd-custom').value)||0;
    highlightPayBtn(null);
    if(niWrap) niWrap.style.display='block';
    _noInterest=niChk?niChk.checked:false;
  }
  updatePayBreakdown(b,_payDebtAmount);
}

function highlightPayBtn(activeId){
  ['pd-min-btn','pd-sug-btn','pd-full-btn'].forEach(id=>{
    const el=$(id);if(!el)return;
    el.style.outline=id===activeId?'2px solid var(--accent)':'none';
  });
}

function updatePayBreakdown(b,amount){
  if(!amount||amount<=0){$('pd-breakdown').style.display='none';return;}
  let interest,principal,newBal;
  if(_noInterest){
    interest=0;
    principal=parseFloat(Math.min(amount,b.balance||0).toFixed(2));
    newBal=parseFloat(Math.max(0,(b.balance||0)-principal).toFixed(2));
  } else {
    const monthlyRate=(b.apr||0)/100/12;
    interest=parseFloat(((b.balance||0)*monthlyRate).toFixed(2));
    principal=parseFloat(Math.min(amount-interest,b.balance||0).toFixed(2));
    newBal=parseFloat(Math.max(0,(b.balance||0)-principal).toFixed(2));
  }
  $('pd-interest-portion').textContent=usd(Math.max(0,interest));
  $('pd-principal-portion').textContent=usd(Math.max(0,principal));
  $('pd-new-balance').textContent=usd(newBal);
  $('pd-breakdown').style.display='block';
}

function toggleNoInterest(){
  const chk=$('pd-no-interest');
  const b=data.bills.find(x=>x.id===_payDebtId);if(!b||!chk)return;
  if(document.activeElement!==chk) chk.checked=!chk.checked;
  _noInterest=chk.checked;
  const amt=_payDebtType==='custom'?sanitizeNum($('pd-custom').value)||0:_payDebtAmount;
  updatePayBreakdown(b,amt);
}

function confirmDebtPayment(){
  const b=data.bills.find(x=>x.id===_payDebtId);if(!b)return;
  const hasPromo=$('pd-alloc-section')&&$('pd-alloc-section').style.display!=='none';

  if(hasPromo){
    // ── Allocation mode (split revolving + promo items) ───────
    const toRevolving=parseFloat($('pd-alloc-revolving')?.value)||0;
    const promoAllocs=[];
    document.querySelectorAll('[id^="pd-alloc-promo-"]').forEach(inp=>{
      const pid=parseInt(inp.dataset.promoId);
      const amt=parseFloat(inp.value)||0;
      if(amt>0) promoAllocs.push({id:pid,amount:amt});
    });
    const total=parseFloat((toRevolving+promoAllocs.reduce((s,p)=>s+p.amount,0)).toFixed(2));
    const acId=parseInt($('pd-account').value)||0;
    if(!total||total<=0){showToast(t('Enter a valid amount'),'error');return;}
    if(!acId){showToast(t('Please select a Pay From account'),'error');return;}
    if(acId){
      const bal=getAccountBalance(acId);
      if(bal!==null&&total>bal){
        showConfirm({
          icon:'⚠️', title:'Overdraft warning',
          msg:'Payment of '+usd(total)+' would overdraw this account by '+usd(total-bal)+'. Continue anyway?',
          okLabel:'Continue', okStyle:'background:var(--yellow);color:#000',
          onOk:()=>{
            migrateRevolvingBalance(b);
            if(toRevolving>0){
              const monthlyRate=(b.apr||0)/100/12;
              const interest=parseFloat(((b.revolvingBalance||0)*monthlyRate).toFixed(2));
              const principal=Math.max(0,toRevolving-interest);
              b.revolvingBalance=parseFloat(Math.max(0,(b.revolvingBalance||0)-principal).toFixed(2));
              b.balance=parseFloat(Math.max(0,(b.balance||0)-principal).toFixed(2));
              data.transactions.push({
                id:Date.now()+Math.random(),description:b.name+' - revolving payment',
                amount:parseFloat(toRevolving.toFixed(2)),type:'Debt Payment',date:today(),
                accountId:acId,methodLabel:''
              });
            }
            promoAllocs.forEach(alloc=>{
              const txn=data.transactions.find(t=>t.id===alloc.id);if(!txn)return;
              b.balance=parseFloat(Math.max(0,(b.balance||0)-alloc.amount).toFixed(2));
              data.transactions.push({
                id:Date.now()+Math.random(),description:b.name+' - promo: '+txn.description,
                amount:parseFloat(alloc.amount.toFixed(2)),type:'Debt Payment',date:today(),
                accountId:acId,methodLabel:'',promoRef:txn.id
              });
            });
            adjustAccountBalance(acId,-total);
            b.status=b.balance>0.01?'Pending':'Paid';
            b.scheduledAmount=null;b.scheduledAccountId=null;
            closeModal('paydebt');saveData();renderSections('alerts','bills','dashboard','debt','networth','txns');
            if(b.status==='Paid'){ haptic('medium'); flashBillCard(_payDebtId,'green'); }
            showToast('Payment of '+usd(total)+' applied!');
          }
        });
        return;
      }
    }
    migrateRevolvingBalance(b);
    if(toRevolving>0){
      const monthlyRate=(b.apr||0)/100/12;
      const interest=parseFloat(((b.revolvingBalance||0)*monthlyRate).toFixed(2));
      const principal=Math.max(0,toRevolving-interest);
      b.revolvingBalance=parseFloat(Math.max(0,(b.revolvingBalance||0)-principal).toFixed(2));
      b.balance=parseFloat(Math.max(0,(b.balance||0)-principal).toFixed(2));
      data.transactions.push({
        id:Date.now()+Math.random(),description:b.name+' - revolving payment',
        amount:parseFloat(toRevolving.toFixed(2)),type:'Debt Payment',date:today(),
        accountId:acId,methodLabel:''
      });
    }
    promoAllocs.forEach(alloc=>{
      const txn=data.transactions.find(t=>t.id===alloc.id);if(!txn)return;
      b.balance=parseFloat(Math.max(0,(b.balance||0)-alloc.amount).toFixed(2));
      data.transactions.push({
        id:Date.now()+Math.random(),description:b.name+' - promo: '+txn.description,
        amount:parseFloat(alloc.amount.toFixed(2)),type:'Debt Payment',date:today(),
        accountId:acId,methodLabel:'',promoRef:txn.id
      });
    });
    adjustAccountBalance(acId,-total);
    b.status=b.balance>0.01?'Pending':'Paid';
    b.scheduledAmount=null;b.scheduledAccountId=null;
    closeModal('paydebt');saveData();renderSections('alerts','bills','dashboard','debt','networth','txns');
    if(b.status==='Paid'){ haptic('medium'); flashBillCard(_payDebtId,'green'); }
    showToast('Payment of '+usd(total)+' applied!');
  } else {
    // ── Standard scheduling mode ──────────────────────────────
    const amount=_payDebtType==='custom'
      ? sanitizeNum($('pd-custom').value)||0
      : _payDebtAmount;
    const acId=parseInt($('pd-account').value)||0;
    if(!amount||amount<=0){showToast(t('Enter a valid amount'),'error');return;}
    if(!acId){showToast(t('Please select a Pay From account'),'error');return;}
    if(acId){
      const bal=getAccountBalance(acId);
      if(bal!==null&&amount>bal){
        showConfirm({
          icon:'⚠️', title:'Overdraft warning',
          msg:'This payment of '+usd(amount)+' would overdraw this account by '+usd(amount-bal)+'. Continue anyway?',
          okLabel:'Continue', okStyle:'background:var(--yellow);color:#000',
          onOk:()=>{
            applyGeneralPaymentToPromos(b.id,amount);
            b.scheduledAmount=parseFloat(amount.toFixed(2));
            b.scheduledAccountId=acId;
            b.status='Scheduled';
            closeModal('paydebt');saveData();renderSections('alerts','bills','dashboard','debt','networth','txns');
            showToast('Payment of '+usd(amount)+' scheduled!');
          }
        });
        return;
      }
    }
    applyGeneralPaymentToPromos(b.id,amount);
    b.scheduledAmount=parseFloat(amount.toFixed(2));
    b.scheduledAccountId=acId;
    b.status='Scheduled';
    if(_noInterest) b.noInterestPayment=true; else delete b.noInterestPayment;
    const newDue=$('pd-due-date')?.value;
    if(newDue) b.dueDate=newDue;
    closeModal('paydebt');saveData();renderSections('alerts','bills','dashboard','debt','networth','txns');
    showToast('Payment of '+usd(amount)+' scheduled!');
  }
}
// Check if an inactive card has been used recently (within 90 days via logged purchases)
function getLastPurchaseDate(billId,nameHint){
  let purchases;
  if(billId){
    purchases=data.transactions.filter(t=>t.type==='Purchase'&&t.cardId===billId&&t.date);
  } else if(nameHint){
    const creditCards=data.bills.filter(b=>b.btype==='creditcard');
    const match=creditCards.find(c=>
      c.name.toLowerCase().includes(nameHint.toLowerCase().split(' ')[0])||
      nameHint.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])
    );
    purchases=match?data.transactions.filter(t=>t.type==='Purchase'&&t.cardId===match.id&&t.date):[];
  } else { return null; }
  if(!purchases.length) return null;
  return purchases.sort((a,b)=>b.date.localeCompare(a.date))[0].date;
}
function cardLastUsed(cardName){ return getLastPurchaseDate(null,cardName); }

// After a purchase on a credit card, reset any matching inactive card reminder
function resetInactiveCardForPurchase(cardId){
  if(!cardId) return;
  const bill=data.bills.find(b=>b.id===cardId);if(!bill) return;
  // Find inactive card that matches this credit card by name
  const match=data.cards.find(c=>
    c.name.toLowerCase().includes(bill.name.toLowerCase().split(' ')[0])||
    bill.name.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])
  );
  if(match){
    const next=new Date();next.setDate(next.getDate()+90);
    match.nextReminder=next.toISOString().split('T')[0];
    match.reminderDays=90;
  }
}

// Compute whether inactive card alert should show (no purchases in 90 days)
function cardIsInactive(c){
  const last=cardLastUsed(c.name);
  if(!last) return daysUntil(c.nextReminder)<=0; // fallback to old logic if no purchases logged
  return daysUntil(last) <= -90; // more than 90 days since last purchase
}
// calendar picker state
let _calPending={name:'',date:'',notes:''};
function addToCalendar(name,date,notes){
  _calPending={name,date,notes};
  $('cal-event-name').textContent=name;
  $('cal-event-date').textContent=date;
  $('modal-calpick').classList.add('open');
}
function calGoogle(){
  const{name,date,notes}=_calPending;
  const d=new Date(date+'T12:00:00'),pad=n=>String(n).padStart(2,'0');
  const dt=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('💰 '+name)}&dates=${dt}/${dt}&details=${encodeURIComponent(notes||'')}`, '_blank');
  closeModal('calpick');
}
function calIcal(){
  const{name,date,notes}=_calPending;
  const d=new Date(date+'T12:00:00'),pad=n=>String(n).padStart(2,'0');
  const dt=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  const uid=`financeos-${Date.now()}@local`;
  const stamp=new Date().toISOString().replace(/[-:.]/g,'').slice(0,15)+'Z';
  const ics=[
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FinanceOS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dt}`,
    `DTEND;VALUE=DATE:${dt}`,
    `SUMMARY:💰 ${name}`,
    `DESCRIPTION:${(notes||'').replace(/\n/g,'\\n')}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1440M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${name}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`${name.replace(/[^a-z0-9]/gi,'-').toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
  closeModal('calpick');
  showToast('Calendar file downloaded!');
}
function toggleSchedule(id){
  const el=$(id);if(!el)return;
  el.style.display=el.style.display==='none'?'block':'none';
}

// ── VISUAL HELPERS ───────────────────────────────
function statusColor(s){return{Paid:'#22c55e',Scheduled:'#3b82f6',Pending:'#f59e0b',Overdue:'#ef4444'}[s]||'#888';}
function recurBadge(freq){
  if(!freq||freq==='One-time')return'';
  const map={Weekly:['#06b6d4','🔁'],'Bi-weekly':['#8b5cf6','🔁'],Monthly:['#5070f0','🔄'],Yearly:['#f59e0b','📆']};
  const[c,icon]=map[freq]||['#888','🔁'];
  return`<span class="recur-badge" style="background:${c}22;color:${c}">${freq} ${icon}</span>`;
}

// ── DEBT PLANNER ENGINE ──────────────────────────
function setMethod(m){
  debtMethod=m;
  $('btn-avalanche').classList.toggle('active',m==='avalanche');
  $('btn-snowball').classList.toggle('active',m==='snowball');
  renderDebt();
}

function calcDebtPlan(debts, extra){
  // Clone debts preserving original min payments
  let items=debts.map(d=>({...d,bal:d.balance,monthlyRate:d.apr/100/12,minPay:Math.max(d.scheduledAmount||0,d.amount||0)||d.amount,skipInterest:!!d.noInterestPayment}));
  // Sort by method
  if(debtMethod==='avalanche') items.sort((a,b)=>b.apr-a.apr);
  else items.sort((a,b)=>a.bal-b.bal);

  const totalMinPayment=items.reduce((s,d)=>s+d.minPay,0);
  const totalMonthly=totalMinPayment+extra;
  let months=0;
  let totalInterestPaid=0;
  const MAX_MONTHS=600;
  items.forEach(d=>d.sched=[]);

  while(items.some(d=>d.bal>0.01) && months<MAX_MONTHS){
    months++;

    // Step 1: collect freed minimums from already-paid debts (cascade/roll effect)
    const freedMinimums=items.filter(d=>d.bal<=0.01).reduce((s,d)=>s+d.minPay,0);
    // Total available for focus debt = user extra + freed minimums
    let available=extra+freedMinimums;

    // Step 2: pay interest + minimum on each active debt
    items.forEach(d=>{
      if(d.bal<=0.01){d.bal=0;return;}
      const interest=d.skipInterest?0:parseFloat((d.bal*d.monthlyRate).toFixed(2));
      d.skipInterest=false; // only skip interest for the first scheduled month
      totalInterestPaid+=interest;
      d.bal+=interest;
      const pay=parseFloat(Math.min(d.minPay,d.bal).toFixed(2));
      d.bal=parseFloat(Math.max(0,d.bal-pay).toFixed(2));
      d.sched.push({month:months,payment:pay,interest,balance:d.bal});
    });

    // Step 3: apply available (extra + freed) to focus debt in priority order
    for(let d of items){
      if(d.bal<=0.01) continue;
      const bonus=parseFloat(Math.min(available,d.bal).toFixed(2));
      d.bal=parseFloat(Math.max(0,d.bal-bonus).toFixed(2));
      if(d.sched[d.sched.length-1]) d.sched[d.sched.length-1].payment=parseFloat((d.sched[d.sched.length-1].payment+bonus).toFixed(2));
      available=parseFloat((available-bonus).toFixed(2));
      if(available<=0) break;
    }
  }
  return{items,months,totalInterestPaid,totalMonthly};
}

function dismissDebtInfo(){
  localStorage.setItem('financeOS_debtInfoDismissed','1');
  const card=$('debt-info-card');
  if(card) card.style.display='none';
}


function renderCards(){
  // ── CREDIT UTILIZATION ──────────────────────────
  const creditCards=data.bills.filter(b=>b.btype==='creditcard'&&b.creditLimit>0);
  const totalLimit=creditCards.reduce((s,c)=>s+(c.creditLimit||0),0);
  const totalBal=creditCards.reduce((s,c)=>s+(c.balance||0),0);
  const totalAvail=Math.max(0,totalLimit-totalBal);
  const utilPct=totalLimit>0?Math.min(100,Math.round(totalBal/totalLimit*100)):0;
  const utilColor=utilPct<30?'var(--green)':utilPct<50?'var(--yellow)':'var(--red)';
  const tip=utilPct<30?t('Great! Utilization under 30% is ideal for your credit score.')
    :utilPct<50?t('Moderate utilization. Try to pay down balances to stay under 30%.')
    :t('High utilization. This may be impacting your credit score.');

  // Summary
  const crLimit=$('cr-limit'),crUsed=$('cr-used'),crAvail=$('cr-avail'),crPct=$('cr-pct'),crBar=$('cr-bar'),crTip=$('cr-tip');
  if(crLimit) crLimit.textContent=usd(totalLimit);
  if(crUsed){crUsed.textContent=usd(totalBal);crUsed.style.color=utilColor;}
  if(crAvail) crAvail.textContent=usd(totalAvail);
  if(crPct){crPct.textContent=utilPct+'%';crPct.style.color=utilColor;}
  if(crBar){crBar.style.width=utilPct+'%';crBar.style.background=utilColor;}
  if(crTip) crTip.textContent=tip;

  // Per-card list — show all cards with a balance (even if no credit limit set yet)
  const activeCards=data.bills.filter(b=>b.btype==='creditcard'&&b.balance>0);
  const ccList=$('credit-card-list');
  if(ccList){
    ccList.innerHTML=activeCards.length?activeCards.map(c=>{
      const cardUtil=c.creditLimit>0?Math.min(100,Math.round(c.balance/c.creditLimit*100)):0;
      const cardColor=cardUtil<30?'var(--green)':cardUtil<50?'var(--yellow)':'var(--red)';
      const avail=Math.max(0,c.creditLimit-c.balance);
      // Card drill-down transactions
      const now2=new Date();
      const cardTxns=data.transactions.filter(tr=>{
        if(!tr.date)return false;
        const d=new Date(tr.date);
        return tr.cardId===c.id&&d.getFullYear()===now2.getFullYear()&&d.getMonth()===now2.getMonth();
      }).sort((a,b)=>b.date.localeCompare(a.date));
      const cardDrillId='drill-card-'+c.id;
      const cardDrillHtml=cardTxns.length
        ? cardTxns.map(tr=>`<div class="drill-row">
            <div class="dr-left">
              <div class="dr-desc">${tr.description||'Purchase'}</div>
              <div class="dr-sub">${fmtDate(tr.date)}${tr.category?' · '+tr.category:''}</div>
            </div>
            <div class="dr-amt">-${usd(tr.amount)}</div>
          </div>`).join('')
        : '<div class="drill-empty">No purchases on this card this month.</div>';

      return`<div class="card" style="margin-bottom:11px;border-color:${cardColor}44">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
          <div style="flex:1;min-width:160px">
            <div style="font-size:15px;font-weight:600;margin-bottom:4px">💳 ${c.name}</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:10px">
              <div class="surface-chip">
                <div class="txt-label">Balance</div>
                <div style="font-size:15px;font-weight:700;color:${cardColor}">${usd(c.balance)}</div>
              </div>
              <div class="surface-chip">
                <div class="txt-label">Limit</div>
                <div style="font-size:15px;font-weight:700">${usd(c.creditLimit)}</div>
              </div>
              <div class="surface-chip">
                <div class="txt-label">Available</div>
                <div style="font-size:15px;font-weight:700;color:var(--green)">${usd(avail)}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="target-bar-bg" style="flex:1"><div class="target-bar-fill" style="width:${cardUtil}%;background:${cardColor}"></div></div>
              <span style="font-size:12px;font-weight:700;color:${cardColor};min-width:36px">${cardUtil}%</span>
            </div>
            <div style="font-size:10px;color:var(--muted);margin-top:3px">APR: ${pct(c.apr)}</div>
            <div class="drill-toggle" onclick="toggleDrill('${cardDrillId}',this)">
              <i class="dt-icon">›</i> <span class="dt-label">${cardTxns.length} purchase${cardTxns.length===1?'':'s'} this month</span>
            </div>
            <div class="drill-panel" id="${cardDrillId}">${cardDrillHtml}</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="openEditBill(${c.id})">Edit</button>
        </div>
      </div>`;
    }).join('')
    :emptyState('💳','No credit cards yet','Add a Credit Card in Cash Flow - tap the + Bill button and choose Credit Card as the type.','Go to Cash Flow',"show('bills',null);closeModal&&closeModal('settings')");
  }

  // ── INACTIVE CARD REMINDERS ──────────────────────
  // Show only credit cards with $0 balance (not actively carrying debt)
  const allCreditCards=data.bills.filter(b=>b.btype==='creditcard');
  const zeroBalanceCards=allCreditCards.filter(b=>!b.balance||b.balance<=0);

  // Also include manually tracked inactive cards (data.cards) that are not already in bills
  const trackedCards=(data.cards||[]);

  // Merge: tracked cards + zero-balance credit cards
  const inactiveSection=[];
  // Add zero-balance credit cards from bills
  zeroBalanceCards.forEach(b=>{
    const lastUsed=getLastPurchaseDate(b.id,'card');
    const daysSince=lastUsed?-daysUntil(lastUsed):null;
    const inactive=daysSince===null||daysSince>=90;
    inactiveSection.push({id:'bill-'+b.id,name:b.name,last4:'',notes:'',lastUsed,daysSince,inactive,isCard:true,billId:b.id});
  });
  // Add manually tracked reminder cards
  trackedCards.forEach(c=>{
    const lastUsed=getLastPurchaseDate(null,null,c.name);
    const daysSince=lastUsed?-daysUntil(lastUsed):null;
    const inactive=daysSince===null||daysSince>=90;
    inactiveSection.push({id:'card-'+c.id,name:c.name,last4:c.last4,notes:c.notes,lastUsed,daysSince,inactive,isCard:false,cardId:c.id});
  });

  const cardListEl=$('card-list');
  if(!inactiveSection.length){
    cardListEl.innerHTML=emptyState('💳','No inactive cards','Cards with a $0 balance appear here automatically once paid off. Great for tracking cards you own but rarely use.','','');
  } else {
    cardListEl.innerHTML=inactiveSection.map(c=>{
      const borderColor=c.inactive?'var(--accent2)':'var(--border)';
      const lastUsedText=c.lastUsed
        ?`Last purchase: ${fmtDate(c.lastUsed)} (${c.daysSince} days ago)`
        :'No purchases logged yet';
      return`<div class="card" style="margin-bottom:11px;border-color:${borderColor}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-size:15px;font-weight:600;margin-bottom:3px">💳 ${c.name}${c.last4?` <span style="color:var(--muted);font-size:13px">....${c.last4}</span>`:''}</div>
            <div class="txt-muted-xs">${lastUsedText}</div>
            ${c.notes?`<div style="font-size:12px;color:#444;margin-top:2px">${c.notes}</div>`:''}
            ${c.inactive?`<div style="color:var(--accent2);font-size:12px;font-weight:700;margin-top:5px">⚡ No purchases in 90+ days - use this card!</div>`:''}
          </div>
          <div class="row-actions">
            ${c.isCard?`<button class="btn btn-secondary btn-sm" onclick="openEditBill(${c.billId})">Edit</button>`:''}
            <button class="btn btn-secondary btn-sm" onclick="addToCalendar('Use ${c.name} card','${c.lastUsed||today()}','Keep card active')">📅 Remind</button>
            ${!c.isCard?`<button class="btn btn-danger btn-sm" onclick="deleteItem('cards',${c.cardId})">✕</button>`:`<button class="btn btn-danger btn-sm" onclick="deleteItem('bills',${c.billId})">✕</button>`}
          </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }
}


function renderLoans(){
  const loans = data.bills.filter(b => b.btype === 'loan');

  // ── SUMMARY ──────────────────────────────────────
  const totalBal  = loans.reduce((s,l) => s + (l.balance||0), 0);
  const totalOrig = loans.reduce((s,l) => s + (l.originalLoanAmount||l.originalBalance||l.balance||0), 0);
  const totalPaid = Math.max(0, totalOrig - totalBal);
  const paidPct   = totalOrig > 0 ? Math.min(100, Math.round(totalPaid / totalOrig * 100)) : 0;
  const barColor  = paidPct < 30 ? 'var(--blue)' : paidPct < 70 ? 'var(--accent)' : 'var(--green)';

  const lTotalBal  = $('loan-total-bal');
  const lTotalOrig = $('loan-total-orig');
  const lTotalPaid = $('loan-total-paid');
  const lTotalPct  = $('loan-total-pct');
  const lTotalBar  = $('loan-total-bar');
  if(lTotalBal)  lTotalBal.textContent  = usd(totalBal);
  if(lTotalOrig) lTotalOrig.textContent = usd(totalOrig);
  if(lTotalPaid) lTotalPaid.textContent = usd(totalPaid);
  if(lTotalPct){  lTotalPct.textContent = paidPct + '%'; lTotalPct.style.color = barColor; }
  if(lTotalBar){  lTotalBar.style.width = paidPct + '%'; lTotalBar.style.background = barColor; }

  // ── PER-LOAN LIST ─────────────────────────────────
  const el = $('loans-list');
  if(!el) return;

  if(!loans.length){
    el.innerHTML = emptyState('🏦','No loans yet','Add a loan in Money → Bills. Tap + and choose Loan as the type.','Go to Money',"show('bills',null)");
    return;
  }

  el.innerHTML = loans.map(l => {
    const orig     = l.originalLoanAmount || l.originalBalance || l.balance || 0;
    const paid     = Math.max(0, orig - (l.balance||0));
    const lPct     = orig > 0 ? Math.min(100, Math.round(paid / orig * 100)) : 0;
    const lColor   = lPct < 30 ? 'var(--blue)' : lPct < 70 ? 'var(--accent)' : 'var(--green)';
    const statusC  = statusColor(l.status||'Pending');

    // Drill-down: transactions this month linked to this bill
    const now2 = new Date();
    const loanTxns = data.transactions.filter(tr => {
      if(!tr.date) return false;
      const d = new Date(tr.date);
      return (tr.cardId === l.id || tr.autoLogRef === l.id) &&
             d.getFullYear() === now2.getFullYear() &&
             d.getMonth()    === now2.getMonth();
    }).sort((a,b) => b.date.localeCompare(a.date));

    const drillId  = 'drill-loan-' + l.id;
    const drillHtml = loanTxns.length
      ? loanTxns.map(tr => `<div class="drill-row">
          <div class="dr-left">
            <div class="dr-desc">${tr.description||'Payment'}</div>
            <div class="dr-sub">${fmtDate(tr.date)}${tr.category?' · '+tr.category:''}</div>
          </div>
          <div class="dr-amt" class="txt-green">-${usd(tr.amount)}</div>
        </div>`).join('')
      : '<div class="drill-empty">No payments logged this month.</div>';

    return `<div class="card" style="margin-bottom:11px;border-color:${lColor}44">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div style="flex:1;min-width:160px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <span style="font-size:15px;font-weight:600">🏦 ${escHtml(l.name)}</span>
            <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:${statusC}22;color:${statusC}">${l.status||'Pending'}</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:10px">
            <div class="surface-chip">
              <div class="txt-label">Balance</div>
              <div style="font-size:15px;font-weight:700;color:var(--red)">${usd(l.balance||0)}</div>
            </div>
            <div class="surface-chip">
              <div class="txt-label">Original</div>
              <div style="font-size:15px;font-weight:700">${usd(orig)}</div>
            </div>
            <div class="surface-chip">
              <div class="txt-label">Paid Off</div>
              <div style="font-size:15px;font-weight:700;color:var(--green)">${usd(paid)}</div>
            </div>
            <div class="surface-chip">
              <div class="txt-label">Min. Payment</div>
              <div style="font-size:15px;font-weight:700;color:var(--yellow)">${usd(l.amount||0)}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <div class="target-bar-bg" style="flex:1"><div class="target-bar-fill" style="width:${lPct}%;background:${lColor}"></div></div>
            <span style="font-size:12px;font-weight:700;color:${lColor};min-width:36px">${lPct}%</span>
          </div>
          <div style="font-size:10px;color:var(--muted);margin-bottom:6px">APR: ${pct(l.apr||0)}${l.dueDate?' · Due '+fmtDate(l.dueDate):''}</div>
          <div class="drill-toggle" onclick="toggleDrill('${drillId}',this)">
            <i class="dt-icon">›</i> <span class="dt-label">${loanTxns.length} payment${loanTxns.length===1?'':'s'} this month</span>
          </div>
          <div class="drill-panel" id="${drillId}">${drillHtml}</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="openEditBill(${l.id})">Edit</button>
      </div>
    </div>`;
  }).join('');
}

function setTxnFilter(f){
  txnFilter=f;
  const map={'All':'tf-all','Withdrawal':'tf-withdrawal','Purchase':'tf-purchase','Transfer':'tf-transfer'};
  Object.values(map).forEach(id=>{ const el=$(id); if(el) el.classList.remove('active'); });
  const active=$(map[f]); if(active) active.classList.add('active');
  renderTxns();
}
// ── TRANSACTION MONTH PAGINATION ────────────────────────────
function initTxnMonth(){
  if(!txnMonth) txnMonth=today().slice(0,7);
}
function shiftTxnMonth(dir){
  initTxnMonth();
  const [y,m]=txnMonth.split('-').map(Number);
  const d=new Date(y,m-1+dir,1);
  txnMonth=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  renderTxns();
}


function renderGoals(){
  const el = $('goals-list');
  if(!el) return;
  if(!(data.goals||[]).length){
    el.innerHTML = emptyState('🎯','No savings goals yet',
      'Set a goal - emergency fund, vacation, down payment - and track your progress.','+ Add Goal',"openModal('goal')");
    return;
  }
  const now = new Date();
  el.innerHTML = (data.goals||[]).map(g=>{
    // Get saved amount - use linked account balance if set, else manual
    const acc = (data.accounts||[]).find(a=>a.id===g.accountId);
    const saved = acc ? Math.min(acc.balance, g.target) : (g.saved||0);
    const pct = g.target>0 ? Math.min(100, Math.round(saved/g.target*100)) : 0;
    const remaining = Math.max(0, g.target-saved);
    const isComplete = saved >= g.target;

    // Monthly contribution needed
    let monthlyNote = '';
    if(!isComplete && g.date){
      const months = Math.max(1, Math.round((new Date(g.date)-now)/2592000000));
      const monthly = parseFloat((remaining/months).toFixed(2));
      monthlyNote = `Save ${usd(monthly)}/mo to reach goal`;
    }

    // Target date display
    const dateStr = g.date
      ? new Date(g.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',year:'numeric'})
      : '';

    // Circular ring
    const r=28, circ=2*Math.PI*r;
    const filled=circ*(1-pct/100);
    const ringColor=isComplete?'#22c55e':pct>=80?'#f59e0b':'#5070f0';

    const goalId='goal'+g.id;
    const goalCardHtml = `<div class="goal-card" style="border-left:3px solid ${ringColor};border-color:${ringColor}" onclick="toggleCardExpand('${goalId}')">
      <div class="goal-header">
        <div>
          <div class="goal-name">🎯 ${g.name}</div>
          <div class="goal-meta">${dateStr?'By '+dateStr:'No deadline'}${acc?' · '+acc.name:''}</div>
          ${g.notes?`<div class="goal-meta" style="font-style:italic">${g.notes}</div>`:''}
        </div>
        <div class="goal-amounts" style="display:flex;align-items:center;gap:8px">
          <div><div class="goal-saved">${usd(saved)}</div><div class="goal-target">of ${usd(g.target)}</div></div>
          <span id="cchev-${goalId}" style="color:var(--muted);font-size:11px">&#9662;</span>
        </div>
      </div>
      <div class="goal-ring-wrap">
        <svg class="goal-ring" width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="6"/>
          <circle cx="36" cy="36" r="${r}" fill="none" stroke="${ringColor}" stroke-width="6"
            stroke-dasharray="${circ}" stroke-dashoffset="${filled}"
            stroke-linecap="round" transform="rotate(-90 36 36)"
            style="transition:stroke-dashoffset .6s ease"/>
          <text x="36" y="40" text-anchor="middle" font-size="13" font-weight="800" fill="currentColor" style="fill:var(--text)">${pct}%</text>
        </svg>
        <div class="goal-ring-info">
          <div class="goal-ring-pct">${isComplete?'🎉 Done!':usd(remaining)+' to go'}</div>
          <div class="goal-ring-sub">${isComplete?'Goal reached!':monthlyNote||pct+'% saved'}</div>
        </div>
      </div>
      <div id="cact-${goalId}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);flex-wrap:wrap;gap:6px">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();openEditGoal(${g.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteItem('goals',${g.id})">&#x2715;</button>
      </div>
    </div>`;
    return '<div style="margin-bottom:11px">'+goalCardHtml+'</div>';
  }).join('');
}



// ══════════════════════════════════════════════════════════════
// BANK RECONCILIATION
// ══════════════════════════════════════════════════════════════

let _reconAccountId = null;

function openReconcile(id){
  const a = (data.accounts||[]).find(x=>x.id===id);
  if(!a) return;
  _reconAccountId = id;

  $('recon-account-id').value = id;
  $('recon-account-name').textContent = (acTypeIcon[a.type]||'') + ' ' + a.name;
  $('recon-bank-bal').value = '';
  $('recon-summary').style.display = 'none';
  $('recon-analyze-btn').style.display = 'none';
  $('recon-step2').style.display = 'none';
  $('recon-step1').style.display = 'block';
  $('modal-recon').classList.add('open');
}

function updateReconDiff(){
  const id = _reconAccountId;
  const a = (data.accounts||[]).find(x=>x.id===id);
  if(!a) return;
  const bankBal = parseFloat($('recon-bank-bal').value);
  if(isNaN(bankBal)){
    $('recon-summary').style.display='none';
    $('recon-analyze-btn').style.display='none';
    return;
  }

  const appBal = a.balance||0;
  const diff   = parseFloat((bankBal - appBal).toFixed(2));

  $('recon-app-bal').textContent    = usd(appBal);
  $('recon-bank-display').textContent = usd(bankBal);

  const diffEl = $('recon-diff-display');
  if(diff===0){
    diffEl.textContent   = 'None - perfectly balanced!';
    diffEl.className     = 'recon-diff-zero';
  } else {
    diffEl.textContent   = (diff>0?'+':'')+usd(diff);
    diffEl.className     = diff>0?'recon-diff-pos':'recon-diff-neg';
  }

  $('recon-summary').style.display   = 'block';
  $('recon-analyze-btn').style.display = 'block';
  $('recon-analyze-btn').textContent  = diff===0
    ? '✓ Confirm Reconciliation'
    : 'Analyze Difference';
}

function runReconAnalysis(){
  const id     = _reconAccountId;
  const a      = (data.accounts||[]).find(x=>x.id===id);
  if(!a) return;
  const bankBal = parseFloat($('recon-bank-bal').value)||0;
  const diff    = parseFloat((bankBal - (a.balance||0)).toFixed(2));

  // Perfect balance - skip analysis
  if(diff===0){ confirmReconcile(); return; }

  // ── Pattern-match for likely missing transactions ─────────
  const suggestions = [];
  const now = new Date();
  const thisMonth = today().slice(0,7);

  // 1. Bills marked Paid/Scheduled this month but no matching debit transaction on this account
  data.bills.forEach(b=>{
    if(b.btype==='creditcard'||b.btype==='loan'||b.btype==='promo') return;
    if(b.status!=='Paid'&&b.status!=='Scheduled') return;
    const billMonth = b.dueDate?b.dueDate.slice(0,7):'';
    if(billMonth!==thisMonth) return;
    // Check if a payment transaction exists for this bill on this account this month
    const hasTxn = data.transactions.some(t=>
      t.accountId===id &&
      t.date&&t.date.slice(0,7)===thisMonth &&
      t.amount===b.amount &&
      (t.type==='Bill Payment'||t.description.toLowerCase().includes(b.name.toLowerCase()))
    );
    if(!hasTxn){
      suggestions.push({
        desc: b.name+' payment',
        sub: 'Bill marked '+b.status+' but no debit found on this account',
        amount: b.amount,
        type: 'debit'
      });
    }
  });

  // 2. Income entries this month with deposit to this account but no matching credit
  data.income.forEach(i=>{
    if(i.accountId!==id) return;
    const incMonth = i.date?i.date.slice(0,7):'';
    if(incMonth!==thisMonth) return;
    const hasTxn = data.transactions.some(t=>
      t.accountId===id &&
      t.date&&t.date.slice(0,7)===thisMonth &&
      t.type==='Income' &&
      Math.abs(t.amount - getEffectiveIncome(i, now.getFullYear(), now.getMonth())) < 1
    );
    if(!hasTxn){
      const eff = getEffectiveIncome(i, now.getFullYear(), now.getMonth());
      suggestions.push({
        desc: i.source+' deposit',
        sub: 'Income entry found but no matching deposit transaction',
        amount: eff,
        type: 'credit'
      });
    }
  });

  // 3. Scheduled bills auto-processed this month
  data.transactions.filter(t=>
    t.accountId===id &&
    t.date&&t.date.slice(0,7)===thisMonth &&
    t.description&&t.description.includes('auto-processed')
  ).forEach(t=>{
    suggestions.push({
      desc: t.description,
      sub: 'Auto-processed payment - verify it cleared your bank',
      amount: t.amount,
      type: 'debit'
    });
  });

  // 4. Large round-number gap hints
  if(Math.abs(diff)>=5 && Math.abs(diff)<=50 && Math.round(diff)===diff){
    suggestions.push({
      desc: 'Bank fee or small charge',
      sub: usd(Math.abs(diff))+' is a common bank fee or rounding amount',
      amount: Math.abs(diff),
      type: diff<0?'debit':'credit'
    });
  }

  // Build suggestions HTML
  const suggWrap = $('recon-suggestions');
  if(suggestions.length){
    suggWrap.innerHTML = `
      <div class="recon-suggestion-title">Possible explanations (${suggestions.length} found)</div>
      ${suggestions.map(s=>`
        <div class="recon-suggestion-item">
          <div class="rsi-left">
            <div class="rsi-desc">${s.type==='debit'?'&#8595;':'&#8593;'} ${s.desc}</div>
            <div class="rsi-sub">${s.sub}</div>
          </div>
          <div class="rsi-amount">${s.type==='debit'?'-':'+'} ${usd(s.amount)}</div>
        </div>`).join('')}`;
  } else {
    suggWrap.innerHTML = `<div class="recon-suggestion-title">No obvious patterns found</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
        Log an adjustment below to close the gap and mark this account reconciled.
      </div>`;
  }

  // Pre-fill adjustment amount with the difference
  const adjHint = $('recon-adj-hint');
  if(adjHint) adjHint.textContent = diff<0
    ? `App shows ${usd(Math.abs(diff))} more than your bank. Log a debit adjustment to match.`
    : `Your bank shows ${usd(diff)} more than the app. Log a credit adjustment to match.`;

  const adjAuto = $('recon-adj-auto');
  if(adjAuto) adjAuto.textContent = '(auto-filled: '+usd(Math.abs(diff))+')';

  $('recon-adj-amount').value = Math.abs(diff).toFixed(2);

  $('recon-step1').style.display = 'none';
  $('recon-step2').style.display = 'block';
}

function confirmReconcile(){
  const id      = _reconAccountId;
  const a       = (data.accounts||[]).find(x=>x.id===id);
  if(!a) return;
  const bankBal  = parseFloat($('recon-bank-bal').value)||0;
  const diff     = parseFloat((bankBal - (a.balance||0)).toFixed(2));
  const adjAmt   = parseFloat($('recon-adj-amount').value)||0;
  const reason   = $('recon-adj-reason')?$('recon-adj-reason').value:'Unknown';

  // Apply adjustment if non-zero and step2 was shown
  if($('recon-step2').style.display!=='none' && adjAmt>0){
    adjustAccountBalance(id, diff); // bring app balance in line with bank
    data.transactions.push({
      id: Date.now(),
      description: 'Reconciliation adjustment: '+reason,
      amount: parseFloat(Math.abs(diff).toFixed(2)),
      type: 'Reconciliation',
      date: today(),
      accountId: id,
      methodLabel: a.name,
      category: 'Reconciliation'
    });
  } else if(diff!==0){
    // Direct confirm without step2 - still adjust
    adjustAccountBalance(id, diff);
    data.transactions.push({
      id: Date.now(),
      description: 'Reconciliation - balance confirmed',
      amount: 0,
      type: 'Reconciliation',
      date: today(),
      accountId: id,
      methodLabel: a.name
    });
  }

  // Mark account as reconciled
  a.lastReconciled    = today();
  a.lastReconciledBal = bankBal;

  closeModal('recon');
  saveData(); renderSections('dashboard','networth','txns');
  showToast('Account reconciled!');
}



// ══════════════════════════════════════════════════════════════
// FEATURE: SPENDING TRENDS BY CATEGORY
// ══════════════════════════════════════════════════════════════

let _trendCat = null; // selected category, null = all
let _puTags   = []; // working set for purchase modal











// ══════════════════════════════════════════════════════════════
// FEATURE 4: SPENDING TRENDS - ENHANCED
// ══════════════════════════════════════════════════════════════

let _trendCat2 = null; // second category for comparison

function getCategoryTotal(cat, monthStr){
  const txnTotal = data.transactions
    .filter(t=>t.category===cat && t.type==='Purchase' && t.date && t.date.slice(0,7)===monthStr)
    .reduce((s,t)=>s+t.amount, 0);
  const expTotal = data.expenses
    .filter(e=>e.category===cat && e.date && e.date.slice(0,7)===monthStr)
    .reduce((s,e)=>s+e.amount, 0);
  return parseFloat((txnTotal+expTotal).toFixed(2));
}


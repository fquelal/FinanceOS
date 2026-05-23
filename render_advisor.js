// ── RENDER/ADVISOR.JS ────────────────────────────────────────────────────────
// Renders the Advisor tab: AI chat interface, streaming responses.
// Depends on: state.js (data), utils.js ($, escHtml, showToast)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';


function renderAdvisor() {
  var keyScreen = document.getElementById('advisor-key-screen');
  var chatScreen = document.getElementById('advisor-chat-screen');
  if (!keyScreen || !chatScreen) return;
  var apiKey = localStorage.getItem('financeOS_apiKey') || '';
  if (!apiKey) {
    keyScreen.style.display = 'flex';
    chatScreen.style.display = 'none';
  } else {
    keyScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
    renderAdvisorMessages();
  }
}

function advisorSetKey() {
  var inp = document.getElementById('advisor-api-key-input');
  var key = (inp ? inp.value : '').trim();
  if (!key.startsWith('sk-ant-')) { showToast('Invalid API key — must start with sk-ant-'); return; }
  localStorage.setItem('financeOS_apiKey', key);
  if (inp) inp.value = '';
  advisorHistory = [];
  renderAdvisor();
}

function advisorClearKey() {
  localStorage.removeItem('financeOS_apiKey');
  advisorHistory = [];
  renderAdvisor();
}

function advisorClearHistory() {
  advisorHistory = [];
  renderAdvisorMessages();
}

// escHtml lives in utils.js

function renderAdvisorMessages() {
  var wrap = document.getElementById('advisor-messages');
  if (!wrap) return;
  if (advisorHistory.length === 0) {
    wrap.innerHTML = '<div style="text-align:center;padding:48px 20px;color:var(--muted);font-size:13px"><div style="font-size:40px;margin-bottom:14px">🤖</div><div style="font-weight:700;color:var(--text);margin-bottom:6px;font-size:15px">Ready to advise</div><div>Ask me anything about your finances.</div></div>';
    return;
  }
  wrap.innerHTML = advisorHistory.map(function(m) {
    var isUser = m.role === 'user';
    return '<div style="display:flex;justify-content:' + (isUser?'flex-end':'flex-start') + ';margin-bottom:10px">' +
      '<div style="max-width:84%;padding:10px 14px;border-radius:' + (isUser?'16px 16px 4px 16px':'16px 16px 16px 4px') + ';background:' + (isUser?'var(--accent)':'var(--surface)') + ';border:' + (isUser?'none':'1px solid var(--border)') + ';font-size:13px;line-height:1.6;color:var(--text);white-space:pre-wrap;word-break:break-word">' +
      escHtml(m.content) + '</div></div>';
  }).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

async function advisorSend() {
  var inp = document.getElementById('advisor-input');
  var msg = inp ? inp.value.trim() : '';
  if (!msg) return;
  var apiKey = localStorage.getItem('financeOS_apiKey');
  if (!apiKey) { renderAdvisor(); return; }

  inp.value = '';
  inp.style.height = 'auto';
  advisorHistory.push({role:'user', content:msg});
  renderAdvisorMessages();

  var wrap = document.getElementById('advisor-messages');
  var sendBtn = document.getElementById('advisor-send-btn');
  if (sendBtn) sendBtn.disabled = true;

  // Create a live streaming bubble
  var streamDiv = document.createElement('div');
  streamDiv.style.cssText = 'display:flex;justify-content:flex-start;margin-bottom:10px';
  var bubble = document.createElement('div');
  bubble.style.cssText = 'max-width:84%;padding:10px 14px;border-radius:16px 16px 16px 4px;background:var(--surface);border:1px solid var(--border);font-size:13px;line-height:1.6;color:var(--text);white-space:pre-wrap;word-break:break-word';
  bubble.textContent = '…';
  streamDiv.appendChild(bubble);
  wrap.appendChild(streamDiv);
  wrap.scrollTop = wrap.scrollHeight;

  var fullText = '';
  try {
    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-calls': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        stream: true,
        system: buildFinancialContext(),
        messages: advisorHistory
      })
    });

    if (!resp.ok) {
      var errData = await resp.json();
      throw new Error((errData.error && errData.error.message) || 'API error ' + resp.status);
    }

    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    while (true) {
      var _ref = await reader.read();
      var done = _ref.done, value = _ref.value;
      if (done) break;
      buffer += decoder.decode(value, {stream: true});
      var lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line.startsWith('data:')) continue;
        var jsonStr = line.slice(5).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          var evt = JSON.parse(jsonStr);
          if (evt.type === 'content_block_delta' && evt.delta && evt.delta.type === 'text_delta') {
            fullText += evt.delta.text;
            bubble.textContent = fullText;
            wrap.scrollTop = wrap.scrollHeight;
          } else if (evt.type === 'error') {
            throw new Error(evt.error && evt.error.message || 'Stream error');
          }
        } catch(parseErr) { /* skip malformed lines */ }
      }
    }

    streamDiv.remove();
    advisorHistory.push({role:'assistant', content: fullText || '(no response)'});

  } catch(err) {
    streamDiv.remove();
    advisorHistory.push({role:'assistant', content:'⚠️ ' + (err.message || 'Connection error. Check your internet and try again.')});
  }

  if (sendBtn) sendBtn.disabled = false;
  renderAdvisorMessages();
}

function advisorKeyPress(e) {

// Predictor Logic & Diagnostics with Pre-Dispatch & Post-Transit Modes

let inferenceMode = 'full';

function setInferenceMode(mode) {
  inferenceMode = mode;

  const btnFull = document.getElementById('mode-btn-full');
  const btnPre = document.getElementById('mode-btn-pre');
  const banner = document.getElementById('pre-dispatch-banner');
  const realContainer = document.getElementById('days-real-container');
  const realHint = document.getElementById('days_real_hint');
  const realVal = document.getElementById('days_real_val');
  const realInput = document.getElementById('days_real');
  const featureBadge = document.getElementById('feature-count-badge');
  const modeBadge = document.getElementById('active-mode-badge');

  if (mode === 'pre_dispatch') {
    if (btnPre) {
      btnPre.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition bg-[#214e3b] text-[#f2f5ef] shadow-sm';
    }
    if (btnFull) {
      btnFull.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition text-[#7e8c83] hover:text-[#d3ded7]';
    }
    if (banner) banner.classList.remove('hidden');
    if (realContainer) realContainer.classList.add('opacity-35', 'pointer-events-none');
    if (realInput) realInput.disabled = true;
    if (realHint) realHint.innerText = 'Disabled in Pre-Dispatch Mode: Transit time unknown at intake';
    if (realVal) realVal.innerText = 'N/A (Intake)';
    if (featureBadge) {
      featureBadge.innerText = '11 ML Input Features (Zero Leakage)';
      featureBadge.className = 'text-xs font-mono text-amber-400 bg-[#282115] px-2.5 py-0.5 rounded border border-[#4d3c22]';
    }
    if (modeBadge) {
      modeBadge.innerText = 'Pre-Dispatch SLA';
      modeBadge.className = 'text-[10px] font-mono text-amber-400 bg-[#282115] px-2 py-0.5 rounded border border-[#4d3c22]';
    }
  } else {
    if (btnFull) {
      btnFull.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition bg-[#214e3b] text-[#f2f5ef] shadow-sm';
    }
    if (btnPre) {
      btnPre.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition text-[#7e8c83] hover:text-[#d3ded7]';
    }
    if (banner) banner.classList.add('hidden');
    if (realContainer) realContainer.classList.remove('opacity-35', 'pointer-events-none');
    if (realInput) realInput.disabled = false;
    if (realHint) realHint.innerText = 'Carrier transit elapsed duration';
    if (realVal && realInput) realVal.innerText = realInput.value + ' days';
    if (featureBadge) {
      featureBadge.innerText = '12 ML Input Features (Full Pipeline)';
      featureBadge.className = 'text-xs font-mono text-emerald-400 bg-[#14231b] px-2.5 py-0.5 rounded border border-[#234b34]';
    }
    if (modeBadge) {
      modeBadge.innerText = 'Post-Transit';
      modeBadge.className = 'text-[10px] font-mono text-emerald-400 bg-[#14231b] px-2 py-0.5 rounded border border-[#234b34]';
    }
  }

  if (typeof triggerPrediction === 'function') {
    triggerPrediction();
  }
}

async function triggerPrediction() {
  const payload = {
    mode: inferenceMode,
    days_real: parseFloat(document.getElementById('days_real').value),
    days_scheduled: parseFloat(document.getElementById('days_scheduled').value),
    shipping_mode: document.getElementById('shipping_mode').value,
    order_status: document.getElementById('order_status').value,
    type: document.getElementById('type').value,
    segment: document.getElementById('segment').value,
    city: document.getElementById('city').value,
    state: document.getElementById('state').value,
    quantity: parseFloat(document.getElementById('quantity').value) || 1,
    department_id: parseFloat(document.getElementById('department_id').value) || 2,
    zipcode: parseFloat(document.getElementById('zipcode').value) || 725,
  };

  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      updateUIResults(data.data);
    }
  } catch (err) {
    console.error('Prediction error:', err);
  }
}

function updateUIResults(result) {
  const pct = result.risk_percentage;
  const isLate = result.is_late_risk;

  document.getElementById('risk-percentage').innerText = pct.toFixed(1);
  document.getElementById('logit-z').innerText = (result.logit_z > 0 ? '+' : '') + result.logit_z;
  document.getElementById('risk-severity').innerText = result.risk_level;

  const badge = document.getElementById('risk-badge');
  const card = document.getElementById('risk-result-card');
  const bar = document.getElementById('risk-progress-bar');
  const statusText = document.getElementById('risk-status-text');

  bar.style.width = pct + '%';

  if (isLate) {
    badge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#2d1b1d] text-[#f87171] border border-[#52252a]';
    badge.innerText = 'LATE RISK DETECTED';
    card.className = 'bg-card-dark rounded-xl p-6 sm:p-7 space-y-5 transition-all duration-300 border border-rose-500/40 shadow-lg shadow-rose-500/10';
    bar.className = 'h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500';
    statusText.innerText = 'High Likelihood of Delivery Delay';
    statusText.className = 'text-xs text-rose-400 mt-1 font-semibold';
  } else {
    badge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#1b3829] text-emerald-300 border border-[#26533c]';
    badge.innerText = 'ON-TIME EXPECTED';
    card.className = 'bg-card-dark rounded-xl p-6 sm:p-7 space-y-5 transition-all duration-300 border border-card';
    bar.className = 'h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500';
    statusText.innerText = 'Order On Schedule for Timely Delivery';
    statusText.className = 'text-xs text-emerald-400 mt-1 font-semibold';
  }

  // Feature contributions
  const contList = document.getElementById('feature-contributions-list');
  if (contList) {
    contList.innerHTML = '';
    (result.top_contributions || []).forEach(item => {
      const isPos = item.impact > 0;
      const color = isPos ? 'text-rose-400' : 'text-emerald-400';
      const sign = isPos ? '+' : '';
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between p-2 rounded-lg bg-[#171d19] text-xs border border-[#26312a]';
      div.innerHTML = `
        <span class="text-[#c4ceca] font-medium">${item.name}</span>
        <span class="font-mono font-bold ${color}">${sign}${item.impact} impact</span>
      `;
      contList.appendChild(div);
    });
  }

  // Mitigation recommendations
  const recList = document.getElementById('recommendations-list');
  if (recList) {
    recList.innerHTML = '';
    (result.recommendations || []).forEach(rec => {
      const li = document.createElement('li');
      li.className = 'flex items-start space-x-2';
      li.innerHTML = `
        <i data-lucide="check" class="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"></i>
        <span>${rec}</span>
      `;
      recList.appendChild(li);
    });
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}


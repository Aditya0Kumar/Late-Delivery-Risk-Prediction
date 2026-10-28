// Predictor Logic & Diagnostics

async function triggerPrediction() {
  const payload = {
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
    badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30';
    badge.innerText = 'LATE RISK DETECTED';
    card.className = 'glass-card rounded-2xl p-6 relative overflow-hidden transition-all duration-300 border border-rose-500/40 shadow-lg shadow-rose-500/10';
    bar.className = 'h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500';
    statusText.innerText = 'High Likelihood of Delivery Delay';
    statusText.className = 'text-sm font-semibold text-rose-400 mt-1';
  } else {
    badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    badge.innerText = 'ON-TIME EXPECTED';
    card.className = 'glass-card rounded-2xl p-6 relative overflow-hidden transition-all duration-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10';
    bar.className = 'h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500';
    statusText.innerText = 'Order On Schedule for Timely Delivery';
    statusText.className = 'text-sm font-semibold text-emerald-400 mt-1';
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
      div.className = 'flex items-center justify-between p-2 rounded-lg bg-slate-900/50 text-xs border border-slate-800/60';
      div.innerHTML = `
        <span class="text-slate-300 font-medium">${item.name}</span>
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
        <i data-lucide="check" class="w-4 h-4 text-indigo-400 shrink-0 mt-0.5"></i>
        <span>${rec}</span>
      `;
      recList.appendChild(li);
    });
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}


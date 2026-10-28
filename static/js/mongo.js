// MongoDB Atlas Integration

async function fetchMongoSamples() {
  const tbody = document.getElementById('mongo-samples-body');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-slate-500 font-sans">Connecting to MongoDB Atlas...</td></tr>';
  
  try {
    const res = await fetch('/api/mongo/samples');
    const json = await res.json();
    if (json.success && json.samples && json.samples.length > 0) {
      tbody.innerHTML = '';
      json.samples.forEach(doc => {
        const isLate = doc.Late_delivery_risk === 1;
        const badge = isLate
          ? '<span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">1 (Late)</span>'
          : '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">0 (On-Time)</span>';
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-900/50 transition';
        tr.innerHTML = `
          <td class="py-2.5 px-3 font-semibold text-slate-200">${doc.Type || '-'}</td>
          <td class="py-2.5 px-3">${doc['Days for shipping (real)'] ?? '-'}</td>
          <td class="py-2.5 px-3">${doc['Days for shipment (scheduled)'] ?? '-'}</td>
          <td class="py-2.5 px-3">${doc['Delivery Status'] || '-'}</td>
          <td class="py-2.5 px-3">${doc['Shipping Mode'] || '-'}</td>
          <td class="py-2.5 px-3 text-slate-400">${doc['Order City'] || '-'}, ${doc['Order Country'] || ''}</td>
          <td class="py-2.5 px-3 text-indigo-300 font-mono">$${(doc.Sales || 0).toFixed(2)}</td>
          <td class="py-2.5 px-3">${badge}</td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-slate-400 font-sans">No records returned or connection pending.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-rose-400 font-sans">Error fetching from MongoDB Atlas: ${err.message}</td></tr>`;
  }
}


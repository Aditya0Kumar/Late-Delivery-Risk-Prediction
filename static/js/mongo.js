// MongoDB Atlas Dynamic Filter, Search & Pagination Controller

let mongoState = {
  skip: 0,
  limit: 10,
  totalMatching: 180519,
  debounceTimer: null
};

async function fetchMongoSamples(newSkip = null) {
  if (newSkip !== null) {
    mongoState.skip = newSkip;
  }

  const query = document.getElementById('mongo-search-input')?.value.trim() || '';
  const risk = document.getElementById('mongo-risk-filter')?.value || 'all';
  const shippingMode = document.getElementById('mongo-shipping-filter')?.value || 'all';

  const tbody = document.getElementById('mongo-samples-body');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-slate-500 font-sans">Querying MongoDB Atlas collection...</td></tr>';
  }

  const params = new URLSearchParams({
    query: query,
    risk: risk,
    shipping_mode: shippingMode,
    limit: mongoState.limit,
    skip: mongoState.skip
  });

  try {
    const res = await fetch(`/api/mongo/samples?${params.toString()}`);
    const json = await res.json();

    if (json.success && json.samples) {
      mongoState.totalMatching = json.total_matching;
      renderMongoTable(json.samples);
      updateMongoPagination(json.samples.length);
    } else {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-rose-400 font-sans">${json.error || 'Failed to query MongoDB'}</td></tr>`;
      }
    }
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-rose-400 font-sans">Network error querying MongoDB: ${err.message}</td></tr>`;
    }
  }
}

function renderMongoTable(samples) {
  const tbody = document.getElementById('mongo-samples-body');
  if (!tbody) return;

  if (samples.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-[#738278] font-sans">No matching orders found. Try adjusting your search query or filters.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  samples.forEach(doc => {
    const isLate = doc.Late_delivery_risk === 1;
    const badge = isLate
      ? '<span class="px-2 py-0.5 rounded bg-[#2d1b1d] text-[#f87171] font-bold border border-[#52252a]">1 (Late)</span>'
      : '<span class="px-2 py-0.5 rounded bg-[#182a20] text-[#34d399] font-bold border border-[#274b37]">0 (On-Time)</span>';
    
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-[#18201b] transition';
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-semibold text-[#f2f5ef]">${doc.Type || '-'}</td>
      <td class="py-2.5 px-3">${doc['Days for shipping (real)'] ?? '-'}</td>
      <td class="py-2.5 px-3">${doc['Days for shipment (scheduled)'] ?? '-'}</td>
      <td class="py-2.5 px-3 text-[#a0aca3]">${doc['Delivery Status'] || '-'}</td>
      <td class="py-2.5 px-3">${doc['Shipping Mode'] || '-'}</td>
      <td class="py-2.5 px-3 text-[#7e8c83]">${doc['Order City'] || '-'}, ${doc['Order Country'] || ''}</td>
      <td class="py-2.5 px-3 text-emerald-400 font-mono font-medium">$${(doc.Sales || 0).toFixed(2)}</td>
      <td class="py-2.5 px-3">${badge}</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateMongoPagination(returnedCount) {
  const countEl = document.getElementById('mongo-matching-count');
  if (countEl) {
    countEl.innerText = mongoState.totalMatching.toLocaleString();
  }

  const paginationInfo = document.getElementById('mongo-pagination-info');
  if (paginationInfo) {
    if (mongoState.totalMatching === 0) {
      paginationInfo.innerText = 'No records found';
    } else {
      const start = mongoState.skip + 1;
      const end = mongoState.skip + returnedCount;
      paginationInfo.innerText = `Showing orders ${start} - ${end} of ${mongoState.totalMatching.toLocaleString()}`;
    }
  }

  const prevBtn = document.getElementById('mongo-prev-btn');
  const nextBtn = document.getElementById('mongo-next-btn');

  if (prevBtn) {
    prevBtn.disabled = mongoState.skip <= 0;
  }
  if (nextBtn) {
    nextBtn.disabled = mongoState.skip + mongoState.limit >= mongoState.totalMatching;
  }
}

function mongoPrevPage() {
  if (mongoState.skip > 0) {
    fetchMongoSamples(Math.max(0, mongoState.skip - mongoState.limit));
  }
}

function mongoNextPage() {
  if (mongoState.skip + mongoState.limit < mongoState.totalMatching) {
    fetchMongoSamples(mongoState.skip + mongoState.limit);
  }
}

function debounceMongoSearch() {
  clearTimeout(mongoState.debounceTimer);
  mongoState.debounceTimer = setTimeout(() => {
    fetchMongoSamples(0);
  }, 350);
}

function resetMongoFilters() {
  const searchInput = document.getElementById('mongo-search-input');
  const riskFilter = document.getElementById('mongo-risk-filter');
  const shippingFilter = document.getElementById('mongo-shipping-filter');

  if (searchInput) searchInput.value = '';
  if (riskFilter) riskFilter.value = 'all';
  if (shippingFilter) shippingFilter.value = 'all';

  fetchMongoSamples(0);
}

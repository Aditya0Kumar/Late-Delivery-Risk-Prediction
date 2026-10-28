// Navigation & Application State Management

function switchView(viewName) {
  // Hide all view panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.add('hidden');
  });

  // Reset desktop navbar tab button states
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.remove('text-emerald-400', 'bg-[#1c2921]', 'border', 'border-[#27382d]');
    btn.classList.add('text-[#7c8780]');
  });

  // Reset mobile navigation button states
  document.querySelectorAll('.mob-nav-btn').forEach(btn => {
    btn.classList.remove('text-emerald-400', 'bg-[#1c2921]', 'border', 'border-[#27382d]');
    btn.classList.add('text-[#7c8780]');
  });

  // Show active panel
  const activePanel = document.getElementById(`view-${viewName}`);
  if (activePanel) {
    activePanel.classList.remove('hidden');
  }

  // Highlight active desktop tab
  const activeDesktopBtn = document.getElementById(`nav-btn-${viewName}`);
  if (activeDesktopBtn) {
    activeDesktopBtn.classList.add('text-emerald-400', 'bg-[#1c2921]', 'border', 'border-[#27382d]');
    activeDesktopBtn.classList.remove('text-[#7c8780]');
  }

  // Highlight active mobile tab
  const activeMobileBtn = document.getElementById(`mob-nav-btn-${viewName}`);
  if (activeMobileBtn) {
    activeMobileBtn.classList.add('text-emerald-400', 'bg-[#1c2921]', 'border', 'border-[#27382d]');
    activeMobileBtn.classList.remove('text-[#7c8780]');
  }

  // Update Breadcrumb
  const breadcrumb = document.getElementById('breadcrumb-current');
  if (breadcrumb) {
    if (viewName === 'overview') breadcrumb.innerText = 'Overview';
    else if (viewName === 'assess') breadcrumb.innerText = 'Assess Order';
    else if (viewName === 'analytics') breadcrumb.innerText = 'Model Analytics';
    else if (viewName === 'mongodb') breadcrumb.innerText = 'Order Book';
  }

  // Trigger view-specific components
  if (viewName === 'assess' && typeof triggerPrediction === 'function') {
    triggerPrediction();
  }
  if (viewName === 'analytics' && typeof renderCoefficientsChart === 'function' && !window.chartRendered) {
    renderCoefficientsChart();
  }
  if (viewName === 'mongodb' && typeof fetchMongoSamples === 'function') {
    fetchMongoSamples();
  }
}

// Mobile Menu Controls
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const icon = document.getElementById('hamburger-icon');
  if (!menu) return;

  const isHidden = menu.classList.contains('hidden');
  if (isHidden) {
    menu.classList.remove('hidden');
    if (icon) icon.setAttribute('data-lucide', 'x');
  } else {
    menu.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'menu');
  }
  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const icon = document.getElementById('hamburger-icon');
  if (menu && !menu.classList.contains('hidden')) {
    menu.classList.add('hidden');
    if (icon) icon.setAttribute('data-lucide', 'menu');
    if (window.lucide) {
      lucide.createIcons();
    }
  }
}

function switchViewMobile(viewName) {
  switchView(viewName);
  closeMobileMenu();
}

// Auto-close mobile menu if resized to desktop width (>= 768px)
window.addEventListener('resize', () => {
  if (window.innerWidth >= 768) {
    closeMobileMenu();
  }
});

// Close mobile menu on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMobileMenu();
  }
});

function scrollToDetails() {
  switchView('analytics');
}

function updateRangeVal(id, unit) {
  const el = document.getElementById(id);
  if (!el) return;
  const label = document.getElementById(`${id}_val`);
  if (label) label.innerText = el.value + unit;
}

// Preset configurations
const presets = {
  high_risk: {
    days_real: 5,
    days_scheduled: 2,
    shipping_mode: 'First Class',
    order_status: 'COMPLETE',
    type: 'DEBIT',
    segment: 'Consumer',
    city: 'Chicago',
    state: 'IL',
    quantity: 1,
    department_id: 2,
    zipcode: 60601
  },
  on_time: {
    days_real: 2,
    days_scheduled: 4,
    shipping_mode: 'Standard Class',
    order_status: 'COMPLETE',
    type: 'PAYMENT',
    segment: 'Corporate',
    city: 'Caguas',
    state: 'PR',
    quantity: 2,
    department_id: 5,
    zipcode: 725
  },
  first_class: {
    days_real: 3,
    days_scheduled: 1,
    shipping_mode: 'First Class',
    order_status: 'PROCESSING',
    type: 'TRANSFER',
    segment: 'Home Office',
    city: 'New York',
    state: 'NY',
    quantity: 1,
    department_id: 4,
    zipcode: 10001
  }
};

function loadPreset(key) {
  const p = presets[key];
  if (!p) return;
  document.getElementById('days_real').value = p.days_real;
  document.getElementById('days_scheduled').value = p.days_scheduled;
  updateRangeVal('days_real', ' days');
  updateRangeVal('days_scheduled', ' days');
  document.getElementById('shipping_mode').value = p.shipping_mode;
  document.getElementById('order_status').value = p.order_status;
  document.getElementById('type').value = p.type;
  document.getElementById('segment').value = p.segment;
  document.getElementById('city').value = p.city;
  document.getElementById('state').value = p.state;
  document.getElementById('quantity').value = p.quantity;
  document.getElementById('department_id').value = p.department_id;
  document.getElementById('zipcode').value = p.zipcode;
  
  if (typeof triggerPrediction === 'function') {
    triggerPrediction();
  }
}

function liveSimulate() {
  const autoCheckbox = document.getElementById('auto-predict');
  if (autoCheckbox && autoCheckbox.checked && typeof triggerPrediction === 'function') {
    triggerPrediction();
  }
}

// Initial page load
window.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }
  if (typeof renderWeeklyPerformanceChart === 'function') {
    renderWeeklyPerformanceChart();
  }

  // Handle direct tab routing via ?tab= or #hash
  const urlParams = new URLSearchParams(window.location.search);
  const requestedTab = urlParams.get('tab') || window.location.hash.replace('#', '');
  if (requestedTab && ['overview', 'assess', 'analytics', 'mongodb'].includes(requestedTab)) {
    switchView(requestedTab);
  }
});

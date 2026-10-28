// Chart.js Implementations matching executive UI

window.chartRendered = false;

function renderWeeklyPerformanceChart() {
  const canvas = document.getElementById('weeklyPerformanceChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  
  // 8 weekly data points matching the screenshot visual trend
  const labels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
  const values = [68, 76, 73, 79, 77, 86, 83, 91];

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'On-Time Delivery %',
        data: values,
        borderColor: '#2d6d53',
        backgroundColor: 'rgba(45, 109, 83, 0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#2d6d53',
        pointBorderColor: '#17221c',
        pointBorderWidth: 2,
        pointRadius: 4.5,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#161c18',
          borderColor: '#2b3930',
          borderWidth: 1,
          titleColor: '#e0e7e3',
          bodyColor: '#a1b3a9',
          titleFont: { family: 'Plus Jakarta Sans', size: 11 },
          bodyFont: { family: 'Plus Jakarta Sans', size: 11 },
          callbacks: {
            label: (ctx) => `Delivery Rate: ${ctx.raw}%`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#68776f', font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          min: 40,
          max: 105,
          border: { display: false },
          grid: {
            color: 'rgba(255, 255, 255, 0.04)',
            drawTicks: false
          },
          ticks: {
            stepSize: 25,
            color: '#68776f',
            font: { family: 'JetBrains Mono', size: 10 },
            callback: (v) => [50, 75, 100].includes(v) ? v : ''
          }
        }
      }
    }
  });
}

function renderCoefficientsChart() {
  const canvas = document.getElementById('coefficientsChart');
  if (!canvas) return;
  window.chartRendered = true;

  const ctx = canvas.getContext('2d');
  const labels = [
    'Days Real', 'Days Sched', 'Ship Mode', 'Order Status', 'Pay Type', 'Zipcode', 'City', 'Qty', 'Dept ID', 'Segment', 'Lname', 'State'
  ];
  const data = [
    9.05, -7.23, 0.75, -1.43, 0.50, 0.02, 0.02, -0.02, 0.01, 0.01, -0.04, -0.01
  ];

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Weight',
        data: data,
        backgroundColor: data.map(v => v >= 0 ? '#b91c1c' : '#23543f'),
        borderColor: data.map(v => v >= 0 ? '#ef4444' : '#34d399'),
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#161c18',
          borderColor: '#2b3930',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => `Weight: ${ctx.raw} (${ctx.raw >= 0 ? 'Risk Driver' : 'Risk Cushion'})`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#738278', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#738278', font: { size: 10 } }
        }
      }
    }
  });
}

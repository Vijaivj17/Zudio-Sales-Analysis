/* ════════════════════════════════════════════════════════════════
   ZUDIO SALES DASHBOARD — dashboard.js
   Exact Power BI palette replica
   ════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Global state ───────────────────────────────────────────────
let allData = [];
let filteredData = [];
let indiaTopo = null;

// Chart instances
let chartState, chartCategory, chartClothing, chartMonth, chartStateCity, chartStore;

// Register Geo chart components explicitly
if (typeof ChartGeo !== 'undefined' && typeof Chart !== 'undefined') {
  Chart.register(ChartGeo.ChoroplethController, ChartGeo.ProjectionScale, ChartGeo.ColorScale, ChartGeo.GeoFeature);
}

// Month order (calendar)
const MONTHS_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// ── Exact palette from Power BI screenshot ──────────────────────
const GREEN_BAR = '#51EC77';
const GREEN_BAR_H = '#2FD458';
const DONUT_NAVY = '#0D3B66';
const DONUT_BLUE = '#1565C0';
const SCATTER_KIDS = '#C9A8F0';   // light purple
const SCATTER_MEN = '#72C3F5';   // light blue
const SCATTER_WOMEN = '#FF9EC4';   // light pink
const STORE_RENTED = '#5CE1E1';
const STORE_OWNED = '#0D6ABF';
const TEXT_DARK = '#3A2E1F';
const CARD_BG = '#E8D166';

// Category order for donut (matching reference legend top-to-bottom)
const CAT_ORDER_DONUT = ['Kids', 'Women', 'Men'];

// Treemap state colour palette
const STATE_PALETTE = [
  '#E53935', '#D81B60', '#8E24AA', '#1E88E5',
  '#00ACC1', '#F9A825', '#E65100', '#43A047',
  '#00838F', '#6A1B9A', '#558B2F', '#BF360C',
];

// ─── Formatters ─────────────────────────────────────────────────
function fmtCr(n) {
  if (Math.abs(n) >= 1e7) return (n / 1e7).toFixed(2) + 'Cr';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(0);
}

function fmtCrRupee(n) { return '₹' + fmtCr(n); }

function fmtAxis(val) {
  const a = Math.abs(val);
  if (a >= 1e7) return (val / 1e7).toFixed(0) + 'Cr';
  if (a >= 1e6) return (val / 1e6).toFixed(0) + 'M';
  if (a >= 1e3) return (val / 1e3).toFixed(0) + 'K';
  return val.toFixed(0);
}

// ─── Data helpers ────────────────────────────────────────────────
function groupBy(data, key) {
  const acc = {};
  for (const r of data) {
    const k = r[key] || 'Unknown';
    (acc[k] = acc[k] || []).push(r);
  }
  return acc;
}

function rowSales(r) {
  return (parseFloat(r['Price']) || 0) * (parseFloat(r['Quantity']) || 0);
}
function rowProfit(r) { return parseFloat(r['Sales Profit']) || 0; }
function rowQty(r) { return parseFloat(r['Quantity']) || 0; }

// ─── Shared Chart.js defaults ────────────────────────────────────
Chart.defaults.font.family = 'Inter, Segoe UI, sans-serif';

function sharedTooltip() {
  return {
    backgroundColor: 'rgba(58,46,31,0.93)',
    borderColor: '#9E8C30',
    borderWidth: 1,
    titleColor: '#F0E199',
    bodyColor: '#fff',
    titleFont: { size: 12, weight: '700' },
    bodyFont: { size: 11 },
    padding: 10,
    cornerRadius: 6,
  };
}

function axisStyle(callback) {
  return {
    ticks: { color: TEXT_DARK, font: { size: 9, weight: '600' }, callback },
    grid: { color: 'rgba(58,46,31,0.12)' },
    border: { color: 'rgba(58,46,31,0.25)' },
  };
}

// ─── KPI animation ───────────────────────────────────────────────
function animateKPI(id, target, fmt) {
  const el = document.getElementById(id);
  if (!el) return;
  const dur = 900, t0 = performance.now();
  function step(now) {
    const p = Math.min((now - t0) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(target * ease);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = fmt(target);
  }
  requestAnimationFrame(step);
}

function updateKPIs(data) {
  let sales = 0, profit = 0, qty = 0;
  for (const r of data) {
    sales += rowSales(r);
    profit += rowProfit(r);
    qty += rowQty(r);
  }
  const avg = data.length > 0 ? profit / data.length : 0;
  animateKPI('kpiSalesVal', sales, fmtCrRupee);
  animateKPI('kpiProfitVal', profit, fmtCrRupee);
  animateKPI('kpiAvgProfitVal', avg, fmtCrRupee);
  animateKPI('kpiQtyVal', qty, n => Math.round(n).toLocaleString('en-IN'));
}

// ═══════════════════════════════════════════════════════════
// CHART 1 — Total Sales by State (Choropleth Map)
// ═══════════════════════════════════════════════════════════
function buildChartState(data) {
  if (!indiaTopo) return;
  const statesGeo = topojson.feature(indiaTopo, indiaTopo.objects.default).features;

  const groups = groupBy(data, 'State');
  const salesByState = {};
  Object.entries(groups).forEach(([state, rows]) => {
    // TopoJSON uses 'NCT of Delhi'
    const mapState = state === 'Delhi' ? 'NCT of Delhi' : state;
    salesByState[mapState] = rows.reduce((s, r) => s + rowSales(r), 0);
  });

  const maxSales = Math.max(...Object.values(salesByState), 1);

  const ctx = document.getElementById('chartState').getContext('2d');
  if (chartState) chartState.destroy();

  chartState = new Chart(ctx, {
    type: 'choropleth',
    data: {
      labels: statesGeo.map(d => d.properties.name),
      datasets: [{
        label: 'States',
        outline: statesGeo,
        data: statesGeo.map(d => ({
          feature: d,
          value: salesByState[d.properties.name] || 0
        })),
        backgroundColor: (context) => {
          if (context.type !== 'data') return 'transparent';
          const val = context.raw.value;
          if (!val) return 'rgba(183, 166, 85, 0.3)'; // Distinct empty state color
          const intensity = 0.2 + 0.8 * (val / maxSales);
          return `rgba(48, 212, 88, ${intensity})`; // GREEN_BAR_H (#30D458)
        },
        borderColor: '#9E8C30',
        borderWidth: 0.5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 500 },
      scales: {
        projection: {
          axis: 'x',
          projection: 'mercator'
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...sharedTooltip(),
          callbacks: {
            title: items => items[0].raw.feature.properties.name,
            label: c => c.raw.value ? ` Sales: ${fmtCrRupee(c.raw.value)}` : ' No Sales'
          }
        },
        datalabels: { display: false }
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════
// CHART 2 — Total Profit by Category (Donut)
//   Exact reference: two-tone alternating navy + blue
//   Kids=#0D3B66, Women=#1565C0, Men=(mid between two)
// ═══════════════════════════════════════════════════════════
function buildChartCategory(data) {
  const groups = groupBy(data, 'Category');
  const DONUT_COLORS = { Kids: DONUT_NAVY, Women: DONUT_BLUE, Men: '#1A6FB5' };

  const entries = CAT_ORDER_DONUT
    .filter(c => groups[c])
    .map(cat => ({ cat, profit: groups[cat].reduce((s, r) => s + rowProfit(r), 0) }));

  const other = Object.keys(groups)
    .filter(c => !CAT_ORDER_DONUT.includes(c))
    .map(cat => ({ cat, profit: groups[cat].reduce((s, r) => s + rowProfit(r), 0) }));

  const all = [...entries, ...other];
  const total = all.reduce((s, e) => s + e.profit, 0);

  const ctx = document.getElementById('chartCategory').getContext('2d');
  if (chartCategory) chartCategory.destroy();

  chartCategory = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: all.map(e => e.cat),
      datasets: [{
        data: all.map(e => e.profit),
        backgroundColor: all.map(e => DONUT_COLORS[e.cat] || '#888'),
        borderColor: CARD_BG,
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '58%',
      animation: { duration: 600 },
      layout: { padding: { right: 0 } },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: TEXT_DARK,
            font: { size: 11, weight: '600' },
            boxWidth: 12,
            padding: 10,
          }
        },
        tooltip: {
          ...sharedTooltip(),
          callbacks: {
            label: c => {
              const pct = ((c.raw / total) * 100).toFixed(2);
              return ` ${fmtCrRupee(c.raw)} (${pct}%)`;
            }
          }
        },
        datalabels: {
          display: true,
          color: '#FFFFFF',
          font: { size: 10, weight: '700' },
          formatter: (val) => {
            const pct = ((val / total) * 100).toFixed(2);
            return fmtCr(val) + '\n(' + pct + '%)';
          },
          textAlign: 'center',
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// ═══════════════════════════════════════════════════════════
// CHART 3 — Total Sales by Clothing Type (horizontal bar)
//   Bright green bars #51EC77 with right-side labels
// ═══════════════════════════════════════════════════════════
function buildChartClothing(data) {
  const groups = groupBy(data, 'Clothing Type');
  const entries = Object.entries(groups)
    .map(([type, rows]) => ({ type, sales: rows.reduce((s, r) => s + rowSales(r), 0) }))
    .sort((a, b) => b.sales - a.sales);

  const ctx = document.getElementById('chartClothing').getContext('2d');
  if (chartClothing) chartClothing.destroy();

  chartClothing = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map(e => e.type),
      datasets: [{
        data: entries.map(e => e.sales),
        backgroundColor: GREEN_BAR,
        hoverBackgroundColor: GREEN_BAR_H,
        borderRadius: 3,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...sharedTooltip(),
          callbacks: { label: c => ' ' + fmtCrRupee(c.raw) }
        },
        datalabels: {
          display: true,
          anchor: 'center',
          align: 'center',
          color: '#1A1200',
          font: { size: 9, weight: '700' },
          formatter: v => fmtCr(v),
          clamp: true,
        }
      },
      scales: {
        x: { ...axisStyle(v => fmtAxis(v)), beginAtZero: true },
        y: {
          ticks: { color: TEXT_DARK, font: { size: 9, weight: '700' } },
          grid: { display: false },
          border: { display: false },
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// ═══════════════════════════════════════════════════════════
// CHART 4 — Total Sales by Month (vertical column)
//   Green bars #51EC77, light-blue label pills above each bar
// ═══════════════════════════════════════════════════════════
function buildChartMonth(data) {
  const groups = groupBy(data, 'Month');
  const values = MONTHS_ORDER.map(m =>
    (groups[m] || []).reduce((s, r) => s + rowSales(r), 0)
  );
  const shortMonths = MONTHS_ORDER.map(m => m.slice(0, 3));

  const ctx = document.getElementById('chartMonth').getContext('2d');
  if (chartMonth) chartMonth.destroy();

  chartMonth = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: shortMonths,
      datasets: [{
        data: values,
        backgroundColor: GREEN_BAR,
        hoverBackgroundColor: GREEN_BAR_H,
        borderRadius: 4,
        borderSkipped: 'bottom',
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...sharedTooltip(),
          callbacks: {
            title: c => MONTHS_ORDER[c[0].dataIndex],
            label: c => ' ' + fmtCrRupee(c.raw)
          }
        },
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'top',
          // "light-blue pill" style label
          backgroundColor: '#B3E5FC',
          borderRadius: 4,
          color: '#0D3B66',
          font: { size: 8, weight: '700' },
          formatter: v => v > 0 ? fmtCr(v) : '',
          padding: { top: 2, bottom: 2, left: 4, right: 4 },
          offset: 2,
        }
      },
      scales: {
        x: {
          ticks: { color: TEXT_DARK, font: { size: 9, weight: '600' } },
          grid: { display: false },
          border: { display: false },
        },
        y: { ...axisStyle(v => fmtAxis(v)), beginAtZero: true }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// ═══════════════════════════════════════════════════════════
// CHART 5 — Sales Breakdown by State (Treemap)
//   Single-level: one block per State, sized by total sales
// ═══════════════════════════════════════════════════════════
function buildChartStateCity(data) {
  // Aggregate sales by State only
  const stateTotal = {};
  for (const r of data) {
    const state = r['State'] || 'Unknown';
    stateTotal[state] = (stateTotal[state] || 0) + rowSales(r);
  }

  const treeData = Object.entries(stateTotal).map(([State, value]) => ({ State, value }));

  // Assign palette colours sorted by total sales desc
  const sortedStates = Object.keys(stateTotal).sort((a, b) => stateTotal[b] - stateTotal[a]);
  const stateColorMap = {};
  sortedStates.forEach((s, i) => { stateColorMap[s] = STATE_PALETTE[i % STATE_PALETTE.length]; });

  const ctx = document.getElementById('chartStateCity').getContext('2d');
  if (chartStateCity) chartStateCity.destroy();

  chartStateCity = new Chart(ctx, {
    type: 'treemap',
    data: {
      datasets: [{
        tree: treeData,
        key: 'value',
        groups: ['State'],
        borderWidth: 2,
        borderColor: '#E8D166',
        spacing: 2,
        backgroundColor(ctx) {
          if (ctx.type !== 'data') return 'transparent';
          return stateColorMap[ctx.raw.g] || '#888888';
        },
        labels: {
          display: true,
          align: 'center',
          color: '#FFFFFF',
          font: { size: 11, weight: '700', family: 'Inter, Segoe UI, sans-serif' },
          formatter: ctx => ctx.raw.g || ''
        }
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...sharedTooltip(),
          callbacks: {
            title: items => items[0].raw.g,
            label: ctx => ` Sales: ${fmtCrRupee(ctx.raw.v)}`,
          }
        },
        datalabels: { display: false }
      }
    }
  });
}


// ═══════════════════════════════════════════════════════════
// CHART 6 — Total Sales by Store Type (column)
//   Rented = cyan #5CE1E1,  Owned = deep blue #0D6ABF
// ═══════════════════════════════════════════════════════════
function buildChartStore(data) {
  const groups = groupBy(data, 'Store Type');
  const types = ['Rented', 'Owned'];
  const values = types.map(t => (groups[t] || []).reduce((s, r) => s + rowSales(r), 0));

  const ctx = document.getElementById('chartStore').getContext('2d');
  if (chartStore) chartStore.destroy();

  chartStore = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: types,
      datasets: [{
        data: values,
        backgroundColor: [STORE_RENTED, STORE_OWNED],
        hoverBackgroundColor: ['#40CFCF', '#0A57A0'],
        borderRadius: 6,
        borderSkipped: 'bottom',
        barThickness: 55,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...sharedTooltip(),
          callbacks: { label: c => ' ' + fmtCrRupee(c.raw) }
        },
        datalabels: {
          display: true,
          anchor: 'end',
          align: 'top',
          color: TEXT_DARK,
          font: { size: 11, weight: '700' },
          formatter: v => fmtCr(v),
          offset: 4,
        }
      },
      scales: {
        x: {
          ticks: { color: TEXT_DARK, font: { size: 11, weight: '700' } },
          grid: { display: false },
          border: { display: false },
        },
        y: { ...axisStyle(v => fmtAxis(v)), beginAtZero: true }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// ─── Build all 6 charts ──────────────────────────────────────────
function buildAll(data) {
  buildChartState(data);
  buildChartCategory(data);
  buildChartClothing(data);
  buildChartMonth(data);
  buildChartStateCity(data);
  buildChartStore(data);
}

// ─── Filters ─────────────────────────────────────────────────────
function fillSelect(id, vals) {
  const el = document.getElementById(id);
  if (!el) return;
  const cur = el.value;
  el.innerHTML = '<option value="">All</option>';
  vals.forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    if (v === cur) o.selected = true;
    el.appendChild(o);
  });
}

function populateFilters(data) {
  const states = [...new Set(data.map(r => r['State']))].filter(Boolean).sort();
  const cats = [...new Set(data.map(r => r['Category']))].filter(Boolean).sort();
  const clothing = [...new Set(data.map(r => r['Clothing Type']))].filter(Boolean).sort();
  fillSelect('stateFilter', states);
  fillSelect('categoryFilter', cats);
  fillSelect('clothingFilter', clothing);
}

function applyFilters() {
  const s1 = document.getElementById('stateFilter').value;
  const c1 = document.getElementById('categoryFilter').value;
  const t1 = document.getElementById('clothingFilter').value;

  filteredData = allData.filter(r => {
    if (s1 && r['State'] !== s1) return false;
    if (c1 && r['Category'] !== c1) return false;
    if (t1 && r['Clothing Type'] !== t1) return false;
    return true;
  });

  updateKPIs(filteredData);
  buildAll(filteredData);
}

function resetFilters() {
  ['stateFilter', 'categoryFilter', 'clothingFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  filteredData = [...allData];
  updateKPIs(filteredData);
  buildAll(filteredData);
}

// ─── Status helpers ───────────────────────────────────────────────
function setStatus(msg, cls = '') {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  if (dot) { dot.className = 'status-dot ' + cls; }
  if (txt) txt.textContent = msg;
}

function hideOverlay() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = 'none';
}

function showOverlay(msg) {
  const el = document.getElementById('loadingOverlay');
  const msg2 = document.getElementById('loadingMsg');
  if (el) el.style.display = 'flex';
  if (msg2) msg2.textContent = msg;
}

// ─── Data loading ─────────────────────────────────────────────────
async function loadCSV() {
  showOverlay('Loading data & maps…');
  setStatus('Loading…', '');

  try {
    const topoRes = await fetch('india.topo.json');
    indiaTopo = await topoRes.json();
  } catch (err) {
    console.error('Failed to load map data', err);
  }

  Papa.parse('clothing_sales_data.csv', {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete(results) {
      allData = results.data.filter(r => r['Price'] && r['Quantity']);
      filteredData = [...allData];


      setStatus(allData.length.toLocaleString('en-IN') + ' records', 'ready');

      populateFilters(allData);
      updateKPIs(filteredData);
      buildAll(filteredData);
      hideOverlay();
    },
    error(err) {
      hideOverlay();
      setStatus('Error', 'err');
      console.error(err);
      document.querySelector('.chart-grid').innerHTML = `
        <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;
                    justify-content:center;gap:12px;padding:60px;text-align:center;">
          <div style="font-size:48px;">⚠️</div>
          <div style="font-family:'Libre Baskerville',serif;font-size:18px;font-weight:700;color:#3A2E1F;">
            CSV file not found
          </div>
          <div style="font-size:13px;color:#6B5A20;max-width:380px;">
            Ensure <strong>clothing_sales_data.csv</strong> is in the same folder as
            <strong>index.html</strong> and serve via a local web server (not file://).
          </div>
        </div>`;
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadCSV);

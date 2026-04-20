const AAVE_API_URL = "https://api.v3.aave.com/graphql";
const AAVE_HISTORY_API_URL = "https://api.llama.fi/protocol/aave";
const AAVE_HISTORY_SNAPSHOT_URL = "./aave_data.json";
const AAVE_CURRENT_SNAPSHOT_URL = "./aave_current.json";
const COMPARE_API_URL = "https://twojekrypto.github.io/vedolo-dashboard/defillama_data.json";
const COMPARE_SNAPSHOT_URL = "./dolomite_data.json";
const COMPARE_CURRENT_API_URL = "https://twojekrypto.github.io/vedolo-dashboard/dolomite_tvl.json";
const COMPARE_CURRENT_SNAPSHOT_URL = "./dolomite_current.json";
const AAVE_CHAINS_QUERY = `
  query AaveChains {
    chains {
      chainId
      isTestnet
    }
  }
`;
const AAVE_MARKETS_QUERY = `
  query AaveMarkets($chainIds: [ChainId!]!) {
    markets(request: { chainIds: $chainIds }) {
      name
      address
      chain {
        chainId
        name
        icon
      }
      totalMarketSize
      totalAvailableLiquidity
    }
  }
`;
const CHART_AAVE_START = "#58A6FF";
const CHART_AAVE_END = "#2FE6FF";
const CHART_AAVE_GLOW = "rgba(88, 166, 255, 0.42)";
const CHART_AAVE_SOFT = "rgba(88, 166, 255, 0.18)";
const CHART_DOLO_START = "#FFD166";
const CHART_DOLO_END = "#FF8F3F";
const CHART_DOLO_GLOW = "rgba(255, 177, 77, 0.44)";
const CHART_DOLO_SOFT = "rgba(255, 177, 77, 0.26)";
const NON_CHAIN_KEYS = new Set([
  "borrowed",
  "staking",
  "pool2",
  "vesting",
  "offers",
  "treasury",
  "cex",
  "governance",
]);

const CHAIN_META = {
  Ethereum: { color: "#7ca5ff", icon: "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg" },
  Arbitrum: { color: "#63e1ff", icon: "https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg" },
  Base: { color: "#5f8dff", icon: "https://icons.llamao.fi/icons/chains/rsz_base.jpg" },
  Avalanche: { color: "#ff7c7c", icon: "https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg" },
  Polygon: { color: "#c387ff", icon: "https://icons.llamao.fi/icons/chains/rsz_polygon.jpg" },
  Optimism: { color: "#ff6d7d", icon: "https://icons.llamao.fi/icons/chains/rsz_optimism.jpg" },
  Harmony: { color: "#59d7df", icon: "https://icons.llamao.fi/icons/chains/rsz_harmony.jpg" },
  Fantom: { color: "#58a3ff", icon: "https://icons.llamao.fi/icons/chains/rsz_fantom.jpg" },
  Metis: { color: "#72c6ff", icon: "https://icons.llamao.fi/icons/chains/rsz_metis.jpg" },
  xDai: { color: "#74e8c1", icon: "https://icons.llamao.fi/icons/chains/rsz_gnosis.jpg" },
  Gnosis: { color: "#74e8c1", icon: "" },
  Linea: { color: "#f4bf61", icon: "https://icons.llamao.fi/icons/chains/rsz_linea.jpg" },
  "zkSync Era": { color: "#a8b8ff", icon: "https://icons.llamao.fi/icons/chains/rsz_zksync%20era.jpg" },
  zkSync: { color: "#a8b8ff", icon: "" },
  Sonic: { color: "#73f0ff", icon: "https://icons.llamao.fi/icons/chains/rsz_sonic.jpg" },
  Soneium: { color: "#d4ddff", icon: "https://icons.llamao.fi/icons/chains/rsz_soneium.jpg" },
  Binance: { color: "#f3ce62", icon: "https://icons.llamao.fi/icons/chains/rsz_binance.jpg" },
  BSC: { color: "#f3ce62", icon: "https://icons.llamao.fi/icons/chains/rsz_binance.jpg" },
  Scroll: { color: "#e8c36d", icon: "https://icons.llamao.fi/icons/chains/rsz_scroll.jpg" },
  Mantle: { color: "#8be2d0", icon: "https://icons.llamao.fi/icons/chains/rsz_mantle.jpg" },
  Plasma: { color: "#ff8cc6", icon: "" },
  Celo: { color: "#b8ff6f", icon: "https://icons.llamao.fi/icons/chains/rsz_celo.jpg" },
  Ink: { color: "#ff97c0", icon: "" },
  "X Layer": { color: "#f5a162", icon: "" },
  MegaETH: { color: "#70d3ff", icon: "" },
};

const state = {
  rawPoints: [],
  rangePoints: [],
  visiblePoints: [],
  chainRows: [],
  currentRange: "all",
  currentChartMode: "relative",
  brushStart: 0,
  brushEnd: 1,
  latestSupply: 0,
  latestTvl: 0,
  latestBorrowed: 0,
  compareRawPoints: [],
  compareRangePoints: [],
  compareVisiblePoints: [],
  compareLatestSupply: 0,
  compareChainCount: 0,
  chainsExpanded: false,
};

function formatCurrency(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1000000000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000000000 ? 2 : 0,
  }).format(value);
}

function formatCompactNumber(value) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000000000 ? 2 : 1,
  }).format(value);
}

function formatPercent(value, digits = 1) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return `${value.toFixed(digits)}%`;
}

function formatDateLong(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(date, mode) {
  if (mode === "month") {
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function smoothPath(points) {
  if (points.length < 2) {
    return "";
  }

  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  const tension = 0.22;
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[Math.min(points.length - 1, index + 1)];
    const p3 = points[Math.min(points.length - 1, index + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return path;
}

function fallbackIcon(name, color) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return `<span class="chain-icon" style="background:${color}22;color:${color}">${initials}</span>`;
}

function iconMarkup(name) {
  const meta = CHAIN_META[name] || { color: "#7ca5ff", icon: "" };
  if (!meta.icon) {
    return fallbackIcon(name, meta.color);
  }

  return `<span class="chain-icon"><img src="${meta.icon}" alt="${name}"></span>`;
}

function setMetric(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setCoverage(chains) {
  const coverage = document.getElementById("coverage-text");
  if (!coverage) {
    return;
  }

  const parts = [];
  if (chains?.length) {
    parts.push(`Aave: ${chains.length} chains`);
  }
  if (state.compareChainCount) {
    parts.push(`Dolomite: ${state.compareChainCount} chains`);
  }
  coverage.textContent = parts.join(" · ") || "Loading markets...";
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: url.startsWith("./") ? "default" : "no-store",
    });

    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchGraphQL(url, query, variables, timeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`${url} returned ${response.status}`);
    }

    const payload = await response.json();
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((entry) => entry.message).join("; "));
    }

    return payload.data;
  } finally {
    window.clearTimeout(timeout);
  }
}

function showError(message) {
  const chainBars = document.getElementById("chain-bars");
  const chartWrap = document.getElementById("chart-wrap");
  const chartAxis = document.getElementById("chart-axis");
  const brushLabel = document.getElementById("brush-label");
  const brushSvg = document.getElementById("brush-svg");

  if (chainBars) {
    chainBars.innerHTML = `<div class="error-state"><div><strong>Data load failed</strong>${message}</div></div>`;
  }

  if (chartWrap) {
    chartWrap.innerHTML = `<div class="error-state"><div><strong>Unable to render the chart</strong>${message}</div></div>`;
  }

  if (chartAxis) {
    chartAxis.innerHTML = "";
  }

  if (brushLabel) {
    brushLabel.textContent = "Chart unavailable";
  }

  if (brushSvg) {
    brushSvg.innerHTML = "";
  }
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildLegacyChainRows(currentChainTvls) {
  const rows = [];
  let totalTvl = 0;

  Object.entries(currentChainTvls).forEach(([key, value]) => {
    if (
      key.includes("-") ||
      NON_CHAIN_KEYS.has(key.toLowerCase()) ||
      typeof value !== "number" ||
      value <= 0
    ) {
      return;
    }

    const borrowed = currentChainTvls[`${key}-borrowed`] || 0;
    const supply = value + borrowed;
    rows.push({ chain: key, tvl: value, borrowed, supply });
    totalTvl += value;
  });

  rows.sort((left, right) => right.supply - left.supply);
  return { rows, totalTvl };
}

function buildOfficialProtocolSnapshot(data) {
  const grouped = new Map();
  let totalTvl = 0;
  let totalBorrowed = 0;
  let liveSupply = 0;

  (data?.markets || []).forEach((market) => {
    const chainName = market?.chain?.name;
    const supply = toFiniteNumber(market?.totalMarketSize);
    const available = toFiniteNumber(market?.totalAvailableLiquidity);

    if (!chainName || supply <= 0) {
      return;
    }

    const borrowed = Math.max(0, supply - available);
    const existing = grouped.get(chainName) || {
      chain: chainName,
      tvl: 0,
      borrowed: 0,
      supply: 0,
    };

    existing.tvl += available;
    existing.borrowed += borrowed;
    existing.supply += supply;
    grouped.set(chainName, existing);

    if (market.chain?.icon) {
      CHAIN_META[chainName] = {
        color: CHAIN_META[chainName]?.color || "#7ca5ff",
        icon: market.chain.icon,
      };
    }

    totalTvl += available;
    totalBorrowed += borrowed;
    liveSupply += supply;
  });

  return {
    rows: [...grouped.values()].sort((left, right) => right.supply - left.supply),
    totalTvl,
    totalBorrowed,
    liveSupply,
  };
}

function deriveGrossSupplyFromCurrentMap(currentChainTvls) {
  let grossSupply = 0;
  let chainCount = 0;

  Object.entries(currentChainTvls || {}).forEach(([key, value]) => {
    if (
      key.includes("-") ||
      NON_CHAIN_KEYS.has(key.toLowerCase()) ||
      typeof value !== "number" ||
      value <= 0
    ) {
      return;
    }

    grossSupply += value;
    chainCount += 1;
  });

  return { grossSupply, chainCount };
}

function buildHistorySupplySeries(data) {
  const borrowedHistory = data.chainTvls?.borrowed?.tvl || [];
  const borrowedMap = new Map(
    borrowedHistory.map((point) => [point.date, point.totalLiquidityUSD])
  );

  return (data.tvl || []).map((point) => ({
    date: new Date(point.date * 1000),
    value: point.totalLiquidityUSD + (borrowedMap.get(point.date) || 0),
  }));
}

function buildLegacyProtocolSnapshot(data) {
  const currentChainTvls = data.currentChainTvls || {};
  const { rows, totalTvl } = buildLegacyChainRows(currentChainTvls);
  const totalBorrowed = currentChainTvls.borrowed || 0;
  const liveSupply = totalTvl + totalBorrowed;

  return {
    rows,
    totalTvl,
    totalBorrowed,
    liveSupply,
    rawPoints: normalizeSeries(buildHistorySupplySeries(data), liveSupply),
  };
}

function buildAaveSnapshot(historyData, currentData = null) {
  const currentSnapshot = currentData?.markets
    ? buildOfficialProtocolSnapshot(currentData)
    : buildLegacyProtocolSnapshot(historyData);

  return {
    ...currentSnapshot,
    rawPoints: normalizeSeries(buildHistorySupplySeries(historyData), currentSnapshot.liveSupply),
  };
}

function updateLegend() {
  setMetric("legend-aave-value", formatCurrency(state.latestSupply));
  setMetric("legend-dolomite-value", formatCurrency(state.compareLatestSupply));
}

function updateChartContext() {
  const hint = document.getElementById("chart-axis-hint");
  const scalePill = document.getElementById("chart-scale-pill");

  if (hint) {
    hint.textContent = state.currentChartMode === "relative"
      ? "Relative mode · both lines show % change from the visible-range start"
      : "Absolute mode · Aave = left axis, Dolomite = right axis";
  }

  if (scalePill) {
    if (!Number.isFinite(state.latestSupply) || !Number.isFinite(state.compareLatestSupply) || state.compareLatestSupply <= 0) {
      scalePill.textContent = "Current scale: —";
      return;
    }

    const ratio = state.latestSupply / state.compareLatestSupply;
    scalePill.textContent = `Current scale: Aave ${ratio.toFixed(ratio >= 10 ? 1 : 2)}x Dolomite`;
  }
}

function formatChartAxisTick(value, mode) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  if (mode === "relative") {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(Math.abs(value) >= 10 ? 0 : 1)}%`;
  }

  return formatCompactNumber(value);
}

function buildRelativePlotSeries(series) {
  if (!series.length) {
    return [];
  }

  const base = series[0].value;
  if (!Number.isFinite(base) || base === 0) {
    return series.map((point) => ({ ...point, plotValue: 0 }));
  }

  return series.map((point) => ({
    ...point,
    plotValue: ((point.value - base) / base) * 100,
  }));
}

function buildValueBounds(values, padRatio = 0.1) {
  if (!values.length) {
    return { min: 0, max: 1, spread: 1 };
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const spread = maxValue - minValue;
  const verticalPad = spread > 0 ? spread * padRatio : Math.max(Math.abs(maxValue) * 0.1, 1.5);
  const adjustedMin = minValue - verticalPad;
  const adjustedMax = maxValue + verticalPad;

  return {
    min: adjustedMin,
    max: adjustedMax,
    spread: adjustedMax - adjustedMin || 1,
  };
}

function findClosestEntry(series, targetDate) {
  if (!series.length || !targetDate) {
    return { entry: null, index: -1 };
  }

  const targetTime = targetDate.getTime();
  let closestIndex = 0;
  let smallestDistance = Math.abs(series[0].date.getTime() - targetTime);

  for (let index = 1; index < series.length; index += 1) {
    const distance = Math.abs(series[index].date.getTime() - targetTime);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestIndex = index;
    }
  }

  return { entry: series[closestIndex], index: closestIndex };
}

function filterSeriesByDate(series, startDate, endDate) {
  if (!series.length || !startDate || !endDate) {
    return [];
  }

  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  return series.filter((point) => {
    const pointTime = point.date.getTime();
    return pointTime >= startTime && pointTime <= endTime;
  });
}

function setAaveStatus(copy) {
  const element = document.getElementById("status-copy");
  if (element) {
    element.textContent = copy;
  }
}

function hydrateData(historyData, currentData = null, sourceLabel = "snapshot") {
  const snapshot = buildAaveSnapshot(historyData, currentData);
  const hasOfficialCurrent = Boolean(currentData?.markets?.length);

  state.chainRows = snapshot.rows;
  state.latestTvl = snapshot.totalTvl;
  state.latestBorrowed = snapshot.totalBorrowed;
  state.latestSupply = snapshot.liveSupply;
  state.rawPoints = snapshot.rawPoints;
  state.rangePoints = [...state.rawPoints];
  state.visiblePoints = [...state.rawPoints];

  setCoverage(state.chainRows);
  renderChainBars();
  renderBrush();
  setRange(state.currentRange || "all");

  const supplySub = document.getElementById("metric-supply-sub");
  if (hasOfficialCurrent) {
    if (supplySub) {
      supplySub.textContent = "Official Aave API current supply, normalized onto the visible history series";
    }
  } else if (state.rawPoints.length >= 2) {
    const prev = state.rawPoints[state.rawPoints.length - 2].value;
    const latest = state.rawPoints[state.rawPoints.length - 1].value;
    const dayChange = prev ? ((latest - prev) / prev) * 100 : 0;
    if (supplySub) {
      const prefix = sourceLabel === "live" ? "Live" : "Snapshot";
      supplySub.textContent = `${prefix} daily move ${dayChange >= 0 ? "+" : ""}${dayChange.toFixed(2)}%`;
    }
  }

  const updatedAt = document.getElementById("metric-updated");
  if (updatedAt && state.rawPoints.length) {
    const latestPointDate = formatDateLong(state.rawPoints[state.rawPoints.length - 1].date);
    updatedAt.textContent = hasOfficialCurrent
      ? `Official current · history ends ${latestPointDate}`
      : `${sourceLabel === "live" ? "Live" : "Snapshot"} point: ${latestPointDate}`;
  }

  setAaveStatus(
    hasOfficialCurrent
      ? "Official current via Aave API"
      : sourceLabel === "live"
        ? "Legacy history refresh"
        : "Snapshot fallback"
  );
  updateLegend();
}

function hydrateCompareData(historyData, currentData) {
  const historySeries = buildHistorySupplySeries(historyData);
  const currentMap = currentData?.currentChainTvls || {};
  const derivedCurrent = deriveGrossSupplyFromCurrentMap(currentMap);
  const targetSupply = currentData?.supplyLiquidity || derivedCurrent.grossSupply || historySeries[historySeries.length - 1]?.value || 0;

  state.compareRawPoints = normalizeSeries(historySeries, targetSupply, 0.5, 2.1);
  state.compareLatestSupply = targetSupply;
  state.compareChainCount = derivedCurrent.chainCount;

  if (state.rangePoints.length) {
    setRange(state.currentRange || "all");
  } else {
    setCoverage(state.chainRows);
    updateLegend();
  }
}

function normalizeSeries(series, liveSupply, minRatio = 0.55, maxRatio = 1.45) {
  if (!series.length || !Number.isFinite(liveSupply) || liveSupply <= 0) {
    return series;
  }

  const lastValue = series[series.length - 1].value;
  if (!Number.isFinite(lastValue) || lastValue <= 0) {
    return series;
  }

  const ratio = liveSupply / lastValue;
  if (ratio < minRatio || ratio > maxRatio) {
    return series;
  }

  return series.map((point) => ({
    ...point,
    value: point.value * ratio,
  }));
}

function updateHero(changePct) {
  const badge = document.getElementById("hero-badge");
  const heroChange = document.getElementById("hero-change");

  setMetric("hero-supply", formatCurrency(state.latestSupply));
  setMetric("metric-supply", formatCurrency(state.latestSupply));
  setMetric("metric-tvl", formatCurrency(state.latestTvl));
  setMetric("metric-borrowed", formatCurrency(state.latestBorrowed));
  setMetric("metric-utilization", formatPercent((state.latestBorrowed / state.latestSupply) * 100, 2));
  setMetric("metric-chains", String(state.chainRows.length));

  const updatedAt = document.getElementById("metric-updated");
  if (updatedAt && state.rawPoints.length) {
    updatedAt.textContent = `Latest point: ${formatDateLong(state.rawPoints[state.rawPoints.length - 1].date)}`;
  }

  if (!badge || !heroChange) {
    return;
  }

  const direction = changePct >= 0 ? "positive" : "negative";
  const sign = changePct >= 0 ? "+" : "";

  badge.textContent = `${sign}${changePct.toFixed(2)}%`;
  badge.className = `delta-badge ${direction}`;

  heroChange.textContent = `Change over the active visible range: ${sign}${changePct.toFixed(2)}%.`;
}

function renderChainBars() {
  const container = document.getElementById("chain-bars");
  if (!container) {
    return;
  }

  const visibleRows = state.chainsExpanded ? state.chainRows : state.chainRows.slice(0, 8);
  const totalSupply = state.latestSupply;

  const rowsMarkup = visibleRows
    .map((row) => {
      const meta = CHAIN_META[row.chain] || { color: "#7ca5ff" };
      const pct = totalSupply > 0 ? (row.supply / totalSupply) * 100 : 0;

      return `
        <div class="chain-row">
          <div class="chain-row-top">
            <div class="chain-name">
              ${iconMarkup(row.chain)}
              <span>${row.chain}</span>
            </div>
            <div class="chain-value">
              <strong>${formatCurrency(row.supply)}</strong>
              <span>${pct.toFixed(1)}% of supply</span>
            </div>
          </div>
          <div class="chain-bar-track">
            <div class="chain-bar-fill" data-width="${pct.toFixed(2)}%" style="background:${meta.color}"></div>
          </div>
          <div class="chain-meta">Available ${formatCompactNumber(row.tvl)} · Borrowed ${formatCompactNumber(row.borrowed)}</div>
        </div>
      `;
    })
    .join("");

  const needsToggle = state.chainRows.length > 8;
  const toggleLabel = state.chainsExpanded
    ? "Show fewer chains"
    : `Show ${state.chainRows.length - 8} more chains`;

  container.innerHTML = rowsMarkup + (
    needsToggle
      ? `<button class="chain-toggle" id="chain-toggle" type="button">${toggleLabel}</button>`
      : ""
  );

  const supplySummary = document.getElementById("chain-summary-supply");
  const borrowedSummary = document.getElementById("chain-summary-borrowed");

  if (supplySummary) {
    supplySummary.textContent = `Supply ${formatCurrency(totalSupply)}`;
  }

  if (borrowedSummary) {
    borrowedSummary.textContent = `Borrowed ${formatCurrency(state.latestBorrowed)}`;
  }

  requestAnimationFrame(() => {
    container.querySelectorAll(".chain-bar-fill").forEach((bar) => {
      bar.style.width = bar.dataset.width;
    });
  });

  const toggle = document.getElementById("chain-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      state.chainsExpanded = !state.chainsExpanded;
      renderChainBars();
    });
  }
}

function currentVisibleChange() {
  if (state.visiblePoints.length < 2) {
    return 0;
  }

  const first = state.visiblePoints[0].value;
  const last = state.visiblePoints[state.visiblePoints.length - 1].value;
  if (!first) {
    return 0;
  }

  return ((last - first) / first) * 100;
}

function updateBrushLabel() {
  const label = document.getElementById("brush-label");
  if (!label || !state.rangePoints.length) {
    return;
  }

  const startIndex = Math.floor(state.brushStart * (state.rangePoints.length - 1));
  const endIndex = Math.ceil(state.brushEnd * (state.rangePoints.length - 1));
  const start = state.rangePoints[startIndex]?.date;
  const end = state.rangePoints[endIndex]?.date;

  if (!start || !end) {
    label.textContent = "Showing full history";
    return;
  }

  label.textContent = `${formatDateShort(start, "day")} -> ${formatDateShort(end, "day")}`;
}

function updateResetButton() {
  const button = document.getElementById("reset-zoom");
  if (!button) {
    return;
  }

  const fullRange = state.brushStart <= 0.001 && state.brushEnd >= 0.999;
  button.classList.toggle("hidden", fullRange);
}

function applyBrush() {
  if (!state.rangePoints.length) {
    state.visiblePoints = [];
    return;
  }

  const startIndex = Math.floor(state.brushStart * (state.rangePoints.length - 1));
  const endIndex = Math.ceil(state.brushEnd * (state.rangePoints.length - 1));

  state.visiblePoints = state.rangePoints.slice(startIndex, endIndex + 1);
  if (state.visiblePoints.length < 2) {
    state.visiblePoints = [...state.rangePoints];
  }

  const visibleStartDate = state.visiblePoints[0]?.date;
  const visibleEndDate = state.visiblePoints[state.visiblePoints.length - 1]?.date;
  state.compareVisiblePoints = filterSeriesByDate(
    state.compareRangePoints,
    visibleStartDate,
    visibleEndDate
  );
  if (state.compareVisiblePoints.length < 2) {
    state.compareVisiblePoints = [...state.compareRangePoints];
  }

  updateBrushLabel();
  updateResetButton();
  updateHero(currentVisibleChange());
  updateLegend();
  updateChartContext();
  renderChart();
}

function updateBrushOverlay() {
  const overlay = document.getElementById("brush-overlay");
  const leftDim = document.getElementById("brush-dim-left");
  const rightDim = document.getElementById("brush-dim-right");
  const windowEl = document.getElementById("brush-window");

  if (!overlay || !leftDim || !rightDim || !windowEl) {
    return;
  }

  const width = overlay.offsetWidth;
  const left = state.brushStart * width;
  const right = state.brushEnd * width;

  leftDim.style.width = `${left}px`;
  rightDim.style.left = `${right}px`;
  rightDim.style.width = `${Math.max(0, width - right)}px`;
  windowEl.style.left = `${left}px`;
  windowEl.style.width = `${Math.max(24, right - left)}px`;
}

function renderBrush() {
  const svg = document.getElementById("brush-svg");
  if (!svg || state.rangePoints.length < 2) {
    return;
  }

  const rect = svg.getBoundingClientRect();
  const width = rect.width || svg.clientWidth || 1000;
  const height = 62;

  const values = state.rangePoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sqrtMin = Math.sqrt(Math.max(0, min));
  const sqrtMax = Math.sqrt(Math.max(0, max));
  const sqrtSpread = sqrtMax - sqrtMin || 1;

  const points = state.rangePoints.map((point, index) => {
    const x = (width * index) / Math.max(1, state.rangePoints.length - 1);
    const normalized = (Math.sqrt(Math.max(0, point.value)) - sqrtMin) / sqrtSpread;
    const y = 6 + (height - 12) * (1 - normalized);
    return { x, y };
  });

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const lastPoint = points[points.length - 1];
  const area = `${line} L ${lastPoint.x.toFixed(1)} ${height} L 0 ${height} Z`;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <defs>
      <linearGradient id="brush-area-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(88, 166, 255, 0.28)" />
        <stop offset="100%" stop-color="rgba(88, 166, 255, 0.02)" />
      </linearGradient>
      <linearGradient id="brush-line-gradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${CHART_AAVE_START}" />
        <stop offset="100%" stop-color="${CHART_AAVE_END}" />
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#brush-area-gradient)" />
    <path d="${line}" fill="none" stroke="${CHART_AAVE_SOFT}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
    <path d="${line}" fill="none" stroke="url(#brush-line-gradient)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  `;

  updateBrushOverlay();
}

function renderChart() {
  const svg = document.getElementById("chart-svg");
  const axis = document.getElementById("chart-axis");
  const wrap = document.getElementById("chart-wrap");

  if (!svg || !axis || !wrap || state.visiblePoints.length < 2) {
    return;
  }

  const width = 1000;
  const height = 360;
  const padLeft = 76;
  const padRight = 76;
  const padTop = 20;
  const padBottom = 28;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const startTime = state.visiblePoints[0].date.getTime();
  const endTime = state.visiblePoints[state.visiblePoints.length - 1].date.getTime();
  const totalTime = Math.max(1, endTime - startTime);
  const hasCompareSeries = state.compareVisiblePoints.length >= 2;
  const isRelativeMode = state.currentChartMode === "relative";
  const plottedAave = isRelativeMode
    ? buildRelativePlotSeries(state.visiblePoints)
    : state.visiblePoints.map((point) => ({ ...point, plotValue: point.value }));
  const plottedCompare = hasCompareSeries
    ? (isRelativeMode
      ? buildRelativePlotSeries(state.compareVisiblePoints)
      : state.compareVisiblePoints.map((point) => ({ ...point, plotValue: point.value })))
    : [];

  const aaveBounds = buildValueBounds(plottedAave.map((point) => point.plotValue), isRelativeMode ? 0.18 : 0.1);
  const compareBounds = isRelativeMode
    ? aaveBounds
    : hasCompareSeries
      ? buildValueBounds(plottedCompare.map((point) => point.plotValue), 0.1)
      : aaveBounds;
  const sharedBounds = isRelativeMode
    ? buildValueBounds(
      [...plottedAave.map((point) => point.plotValue), ...plottedCompare.map((point) => point.plotValue)],
      0.18
    )
    : aaveBounds;
  const primaryBounds = isRelativeMode ? sharedBounds : aaveBounds;

  const points = plottedAave.map((point) => {
    const x = padLeft + ((point.date.getTime() - startTime) / totalTime) * innerWidth;
    const y = height - padBottom - ((point.plotValue - primaryBounds.min) / primaryBounds.spread) * innerHeight;
    return { x, y };
  });
  const comparePoints = plottedCompare.map((point) => {
    const x = padLeft + ((point.date.getTime() - startTime) / totalTime) * innerWidth;
    const bounds = isRelativeMode ? primaryBounds : compareBounds;
    const y = height - padBottom - ((point.plotValue - bounds.min) / bounds.spread) * innerHeight;
    return { x, y };
  });

  const linePath = smoothPath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(height - padBottom).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - padBottom).toFixed(2)} Z`
    : "";
  const compareLinePath = hasCompareSeries ? smoothPath(comparePoints) : "";

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = primaryBounds.max - (primaryBounds.spread * index) / 4;
    const y = padTop + (innerHeight * index) / 4;
    return { value, y };
  });
  const compareTicks = !isRelativeMode && hasCompareSeries
    ? Array.from({ length: 5 }, (_, index) => {
      const value = compareBounds.max - (compareBounds.spread * index) / 4;
      const y = padTop + (innerHeight * index) / 4;
      return { value, y };
    })
    : [];

  const zeroLineY = isRelativeMode && primaryBounds.min < 0 && primaryBounds.max > 0
    ? height - padBottom - ((0 - primaryBounds.min) / primaryBounds.spread) * innerHeight
    : null;
  const grid = yTicks
    .map((tick) => `<line x1="${padLeft}" y1="${tick.y.toFixed(1)}" x2="${width - padRight}" y2="${tick.y.toFixed(1)}" stroke="rgba(255,255,255,0.045)" stroke-width="1" />`)
    .join("");

  const labels = yTicks
    .map((tick) => `<text x="${padLeft - 12}" y="${(tick.y + 4).toFixed(1)}" fill="rgba(156,172,204,0.7)" font-size="10" font-family="'JetBrains Mono', monospace" text-anchor="end">${formatChartAxisTick(tick.value, state.currentChartMode)}</text>`)
    .join("");
  const compareLabels = !isRelativeMode && hasCompareSeries
    ? compareTicks
      .map((tick) => `<text x="${width - padRight + 12}" y="${(tick.y + 4).toFixed(1)}" fill="rgba(255,221,156,0.98)" font-size="10" font-family="'JetBrains Mono', monospace" text-anchor="start">${formatChartAxisTick(tick.value, "absolute")}</text>`)
      .join("")
    : "";

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <defs>
      <clipPath id="chart-clip">
        <rect x="${padLeft}" y="${padTop}" width="${innerWidth}" height="${innerHeight}" rx="0" />
      </clipPath>
      <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(88, 166, 255, 0.22)" />
        <stop offset="55%" stop-color="rgba(88, 166, 255, 0.055)" />
        <stop offset="100%" stop-color="rgba(88, 166, 255, 0.02)" />
      </linearGradient>
      <linearGradient id="line-gradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${CHART_AAVE_START}" />
        <stop offset="100%" stop-color="${CHART_AAVE_END}" />
      </linearGradient>
      <linearGradient id="compare-line-gradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${CHART_DOLO_START}" />
        <stop offset="100%" stop-color="${CHART_DOLO_END}" />
      </linearGradient>
      <filter id="compare-line-glow" x="-20%" y="-35%" width="140%" height="170%">
        <feGaussianBlur stdDeviation="4.5" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0
                  0 0.72 0 0 0
                  0 0 0.24 0 0
                  0 0 0 0.92 0"
          result="glow"
        />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    ${grid}
    ${zeroLineY !== null ? `<line x1="${padLeft}" y1="${zeroLineY.toFixed(1)}" x2="${width - padRight}" y2="${zeroLineY.toFixed(1)}" stroke="rgba(255, 177, 77, 0.24)" stroke-width="1.2" stroke-dasharray="5 5" />` : ""}
    ${labels}
    ${compareLabels}
    <g clip-path="url(#chart-clip)">
      ${!isRelativeMode ? `<path d="${areaPath}" fill="url(#area-gradient)" />` : ""}
      <path d="${linePath}" fill="none" stroke="${isRelativeMode ? "rgba(88, 166, 255, 0.12)" : CHART_AAVE_SOFT}" stroke-width="${isRelativeMode ? "3.2" : "4"}" stroke-linecap="round" stroke-linejoin="round" />
      <path d="${linePath}" fill="none" stroke="url(#line-gradient)" stroke-width="${isRelativeMode ? "2.2" : "1.75"}" stroke-linecap="round" stroke-linejoin="round" />
      ${hasCompareSeries ? `
        <path d="${compareLinePath}" fill="none" stroke="${CHART_DOLO_SOFT}" stroke-width="${isRelativeMode ? "11" : "9"}" stroke-linecap="round" stroke-linejoin="round" filter="url(#compare-line-glow)" />
        <path d="${compareLinePath}" fill="none" stroke="rgba(255, 245, 222, 0.24)" stroke-width="${isRelativeMode ? "6.1" : "5.2"}" stroke-linecap="round" stroke-linejoin="round" />
        <path d="${compareLinePath}" fill="none" stroke="url(#compare-line-gradient)" stroke-width="${isRelativeMode ? "3.9" : "3.35"}" stroke-linecap="round" stroke-linejoin="round" />
      ` : ""}
    </g>
    <line id="hover-line" x1="0" y1="${padTop}" x2="0" y2="${height - padBottom}" stroke="rgba(255,255,255,0.22)" stroke-width="1" opacity="0" />
    <circle id="hover-dot" cx="0" cy="0" r="4.5" fill="${CHART_AAVE_START}" stroke="#08101f" stroke-width="2" opacity="0" />
    <circle id="hover-dot-compare" cx="0" cy="0" r="5.6" fill="${CHART_DOLO_START}" stroke="#08101f" stroke-width="2.4" opacity="0" />
  `;

  const spanDays = (state.visiblePoints[state.visiblePoints.length - 1].date - state.visiblePoints[0].date) / (1000 * 60 * 60 * 24);
  const formatter = spanDays > 120 ? "month" : "day";
  const tickCount = spanDays <= 14 ? Math.min(6, state.visiblePoints.length) : 5;
  const tickIndexes = Array.from({ length: tickCount }, (_, index) =>
    Math.round(((state.visiblePoints.length - 1) * index) / Math.max(1, tickCount - 1))
  );

  axis.innerHTML = tickIndexes
    .map((index) => `<span>${formatDateShort(state.visiblePoints[index].date, formatter)}</span>`)
    .join("");

  const tooltip = document.getElementById("chart-tooltip");
  const hoverLine = document.getElementById("hover-line");
  const hoverDot = document.getElementById("hover-dot");
  const hoverCompareDot = document.getElementById("hover-dot-compare");

  const hideTooltip = () => {
    if (tooltip) {
      tooltip.classList.add("hidden");
    }
    if (hoverLine) {
      hoverLine.setAttribute("opacity", "0");
    }
    if (hoverDot) {
      hoverDot.setAttribute("opacity", "0");
    }
    if (hoverCompareDot) {
      hoverCompareDot.setAttribute("opacity", "0");
    }
  };

  const rangeStartValue = state.visiblePoints[0].value;
  const compareStartValue = state.compareVisiblePoints[0]?.value || 0;
  const wrapRectResolver = () => wrap.getBoundingClientRect();

  wrap.onpointermove = (event) => {
    const rect = wrapRectResolver();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const clampedX = Math.max(padLeft, Math.min(width - padRight, relativeX));
    const index = Math.round(((clampedX - padLeft) / innerWidth) * (state.visiblePoints.length - 1));
    const point = points[index];
    const entry = state.visiblePoints[index];

    if (!point || !entry || !tooltip || !hoverLine || !hoverDot) {
      return;
    }

    const pctChange = rangeStartValue
      ? ((entry.value - rangeStartValue) / rangeStartValue) * 100
      : 0;
    const { entry: compareEntry, index: compareIndex } = findClosestEntry(state.compareVisiblePoints, entry.date);
    const comparePctChange = compareEntry && compareStartValue
      ? ((compareEntry.value - compareStartValue) / compareStartValue) * 100
      : 0;
    const comparePoint = compareEntry && compareIndex >= 0
      ? {
        x: comparePoints[compareIndex].x,
        y: comparePoints[compareIndex].y,
      }
      : null;

    tooltip.classList.remove("hidden");
    tooltip.innerHTML = `
      <strong class="tooltip-title">${formatDateLong(entry.date)}</strong>
      <div class="tooltip-series">
        <div class="tooltip-series-block">
          <div class="tooltip-series-row">
            <span class="tooltip-swatch tooltip-swatch-aave"></span>
            <span class="tooltip-series-name">Aave Supply</span>
            <strong>${formatCurrency(entry.value)}</strong>
          </div>
          <span class="tooltip-subchange ${pctChange >= 0 ? "positive" : "negative"}">
            ${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(2)}% from visible start
          </span>
        </div>
        ${compareEntry ? `
          <div class="tooltip-series-block">
            <div class="tooltip-series-row">
              <span class="tooltip-swatch tooltip-swatch-dolomite"></span>
              <span class="tooltip-series-name">Dolomite Supply</span>
              <strong>${formatCurrency(compareEntry.value)}</strong>
            </div>
            <span class="tooltip-subchange ${comparePctChange >= 0 ? "positive" : "negative"}">
              ${comparePctChange >= 0 ? "+" : ""}${comparePctChange.toFixed(2)}% from visible start
            </span>
          </div>
        ` : ""}
      </div>
    `;

    hoverLine.setAttribute("x1", point.x.toFixed(2));
    hoverLine.setAttribute("x2", point.x.toFixed(2));
    hoverLine.setAttribute("opacity", "1");
    hoverDot.setAttribute("cx", point.x.toFixed(2));
    hoverDot.setAttribute("cy", point.y.toFixed(2));
    hoverDot.setAttribute("opacity", "1");
    if (hoverCompareDot && comparePoint) {
      hoverCompareDot.setAttribute("cx", comparePoint.x.toFixed(2));
      hoverCompareDot.setAttribute("cy", comparePoint.y.toFixed(2));
      hoverCompareDot.setAttribute("opacity", "1");
    } else if (hoverCompareDot) {
      hoverCompareDot.setAttribute("opacity", "0");
    }

    const xPx = (point.x / width) * rect.width;
    const yPx = (point.y / height) * rect.height;
    let left = xPx + 18;
    let top = yPx - 86;

    if (left > rect.width - 190) {
      left = xPx - 190;
    }

    if (top < 10) {
      top = yPx + 16;
    }

    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  };

  wrap.onpointerleave = hideTooltip;
}

function setRange(range) {
  state.currentRange = range;

  if (range === "all") {
    state.rangePoints = [...state.rawPoints];
  } else {
    const days = Number(range);
    state.rangePoints = state.rawPoints.slice(-days);
  }

  const rangeStartDate = state.rangePoints[0]?.date;
  const rangeEndDate = state.rangePoints[state.rangePoints.length - 1]?.date;
  state.compareRangePoints = filterSeriesByDate(
    state.compareRawPoints,
    rangeStartDate,
    rangeEndDate
  );

  state.brushStart = 0;
  state.brushEnd = 1;
  state.visiblePoints = [...state.rangePoints];
  state.compareVisiblePoints = [...state.compareRangePoints];

  document.querySelectorAll("#range-pills button").forEach((button) => {
    button.classList.toggle("active", button.dataset.range === String(range));
  });

  renderBrush();
  applyBrush();
}

function bindRangePills() {
  document.querySelectorAll("#range-pills button").forEach((button) => {
    button.addEventListener("click", () => {
      setRange(button.dataset.range);
    });
  });

  const reset = document.getElementById("reset-zoom");
  if (reset) {
    reset.addEventListener("click", () => {
      state.brushStart = 0;
      state.brushEnd = 1;
      updateBrushOverlay();
      applyBrush();
    });
  }
}

function bindModePills() {
  document.querySelectorAll("#mode-pills button").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentChartMode = button.dataset.mode;

      document.querySelectorAll("#mode-pills button").forEach((control) => {
        control.classList.toggle("active", control.dataset.mode === state.currentChartMode);
      });

      updateChartContext();
      renderChart();
    });
  });
}

function bindBrush() {
  const overlay = document.getElementById("brush-overlay");
  const leftHandle = document.getElementById("brush-handle-left");
  const rightHandle = document.getElementById("brush-handle-right");
  const windowEl = document.getElementById("brush-window");

  if (!overlay || !leftHandle || !rightHandle || !windowEl) {
    return;
  }

  let mode = null;
  let startX = 0;
  let startBrushStart = 0;
  let startBrushEnd = 0;

  function overlayWidth() {
    return overlay.getBoundingClientRect().width;
  }

  function beginDrag(nextMode, event) {
    event.preventDefault();
    event.stopPropagation();
    mode = nextMode;
    startX = event.clientX;
    startBrushStart = state.brushStart;
    startBrushEnd = state.brushEnd;
    document.body.style.cursor = nextMode === "pan" ? "grabbing" : "ew-resize";
  }

  leftHandle.addEventListener("mousedown", (event) => beginDrag("left", event));
  rightHandle.addEventListener("mousedown", (event) => beginDrag("right", event));
  windowEl.addEventListener("mousedown", (event) => {
    if (event.target === leftHandle || event.target === rightHandle) {
      return;
    }
    beginDrag("pan", event);
  });

  document.addEventListener("mousemove", (event) => {
    if (!mode) {
      return;
    }

    const width = overlayWidth();
    const delta = (event.clientX - startX) / width;
    const minWidth = 0.03;

    if (mode === "left") {
      state.brushStart = Math.max(0, Math.min(startBrushStart + delta, state.brushEnd - minWidth));
    } else if (mode === "right") {
      state.brushEnd = Math.max(state.brushStart + minWidth, Math.min(1, startBrushEnd + delta));
    } else if (mode === "pan") {
      const span = startBrushEnd - startBrushStart;
      let nextStart = startBrushStart + delta;
      let nextEnd = startBrushEnd + delta;

      if (nextStart < 0) {
        nextStart = 0;
        nextEnd = span;
      }

      if (nextEnd > 1) {
        nextEnd = 1;
        nextStart = 1 - span;
      }

      state.brushStart = nextStart;
      state.brushEnd = nextEnd;
    }

    updateBrushOverlay();
    applyBrush();
  });

  document.addEventListener("mouseup", () => {
    if (!mode) {
      return;
    }

    mode = null;
    document.body.style.cursor = "";
  });
}

async function fetchData() {
  try {
    const snapshotResults = await Promise.allSettled([
      fetchJson(AAVE_HISTORY_SNAPSHOT_URL, 10000),
      fetchJson(AAVE_CURRENT_SNAPSHOT_URL, 10000),
      fetchJson(COMPARE_SNAPSHOT_URL, 10000),
      fetchJson(COMPARE_CURRENT_SNAPSHOT_URL, 10000),
    ]);
    const aaveSnapshotHistory =
      snapshotResults[0].status === "fulfilled" ? snapshotResults[0].value : null;
    const aaveSnapshotCurrent =
      snapshotResults[1].status === "fulfilled" ? snapshotResults[1].value : null;

    if (aaveSnapshotHistory) {
      hydrateData(aaveSnapshotHistory, aaveSnapshotCurrent, "snapshot");
    } else {
      console.warn("Aave snapshot load failed:", snapshotResults[0].reason);
    }

    if (snapshotResults[2].status === "fulfilled") {
      hydrateCompareData(
        snapshotResults[2].value,
        snapshotResults[3].status === "fulfilled" ? snapshotResults[3].value : null
      );
    } else {
      console.warn("Dolomite snapshot load failed:", snapshotResults[2].reason);
    }

    const liveResults = await Promise.allSettled([
      fetchJson(AAVE_HISTORY_API_URL, 15000),
      fetchGraphQL(AAVE_API_URL, AAVE_CHAINS_QUERY, undefined, 15000)
        .then((payload) => {
          const chainIds = (payload.chains || [])
            .filter((chain) => !chain.isTestnet)
            .map((chain) => chain.chainId);
          return fetchGraphQL(AAVE_API_URL, AAVE_MARKETS_QUERY, { chainIds }, 15000);
        }),
      fetchJson(COMPARE_API_URL, 15000),
      fetchJson(COMPARE_CURRENT_API_URL, 15000),
    ]);
    const aaveLiveHistory = liveResults[0].status === "fulfilled" ? liveResults[0].value : null;
    const aaveLiveCurrent = liveResults[1].status === "fulfilled" ? liveResults[1].value : null;

    if (aaveLiveHistory) {
      hydrateData(aaveLiveHistory, aaveLiveCurrent || aaveSnapshotCurrent, "live");
    } else if (aaveSnapshotHistory && aaveLiveCurrent) {
      hydrateData(aaveSnapshotHistory, aaveLiveCurrent, "snapshot");
    } else {
      console.warn("Live refresh failed:", liveResults[0].reason);
    }

    if (!aaveLiveCurrent && liveResults[1].status !== "fulfilled") {
      console.warn("Official Aave current refresh failed:", liveResults[1].reason);
    }

    if (liveResults[2].status === "fulfilled") {
      hydrateCompareData(
        liveResults[2].value,
        liveResults[3].status === "fulfilled" ? liveResults[3].value : null
      );
    } else {
      console.warn("Dolomite refresh failed:", liveResults[2].reason);
    }

    if (!state.rawPoints.length) {
      throw new Error("Unable to load Aave supply data");
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "Unknown error");
  }
}

function bindResizeRefresh() {
  const rerender = () => {
    if (!state.rawPoints.length) {
      return;
    }
    renderBrush();
    renderChart();
    updateBrushOverlay();
  };

  window.addEventListener("resize", rerender);

  if ("ResizeObserver" in window) {
    const chartWrap = document.getElementById("chart-wrap");
    const brushWrap = document.getElementById("brush-wrap");
    const observer = new ResizeObserver(rerender);
    if (chartWrap) {
      observer.observe(chartWrap);
    }
    if (brushWrap) {
      observer.observe(brushWrap);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindModePills();
  bindRangePills();
  bindBrush();
  bindResizeRefresh();
  fetchData();
});

/**
 * IP Port Scanner — script.js
 * ============================================================
 * Handles all UI interactions:
 *  - Form validation
 *  - API calls to Flask backend
 *  - Live progress polling
 *  - Results table rendering
 *  - Filter buttons
 *  - CSV export
 * ============================================================
 */

"use strict";

/* ──────────────────────────────────────────────
   Constants & State
────────────────────────────────────────────── */

/** How often (ms) we poll /status while a scan is running */
const POLL_INTERVAL_MS = 600;

/** Reference to the setInterval timer for status polling */
let pollTimer = null;

/** Full results array from the last completed scan */
let allResults = [];

/** Current active filter: "all" | "OPEN" | "CLOSED" */
let activeFilter = "all";

/* ──────────────────────────────────────────────
   DOM References
────────────────────────────────────────────── */
const form          = document.getElementById("scan-form");
const inputIP       = document.getElementById("target-ip");
const inputStart    = document.getElementById("start-port");
const inputEnd      = document.getElementById("end-port");
const btnScan       = document.getElementById("btn-scan");
const btnStop       = document.getElementById("btn-stop");
const btnClear      = document.getElementById("btn-clear");
const btnExport     = document.getElementById("btn-export");
const errorMsg      = document.getElementById("error-msg");

const progressSection = document.getElementById("progress-section");
const progressBar     = document.getElementById("progress-bar");
const progressLabel   = document.getElementById("progress-label");
const progressPercent = document.getElementById("progress-percent");
const progressDetail  = document.getElementById("progress-ports-detail");
const pulseDot        = document.getElementById("pulse-dot");
const progressTrack   = document.querySelector(".progress-bar-track");

const statsSection  = document.getElementById("stats-section");
const statTarget    = document.getElementById("stat-target-val");
const statScanned   = document.getElementById("stat-scanned-val");
const statOpen      = document.getElementById("stat-open-val");
const statClosed    = document.getElementById("stat-closed-val");
const statTime      = document.getElementById("stat-time-val");

const resultsSection = document.getElementById("results-section");
const resultsTbody   = document.getElementById("results-tbody");

const filterBtns = document.querySelectorAll(".filter-btn");

/* ──────────────────────────────────────────────
   Validation helpers
────────────────────────────────────────────── */

/**
 * Returns true if the string is a valid IPv4 address.
 * (Server does a full validation too; this is just UI feedback.)
 */
function isValidIPv4(ip) {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return false;
  return parts.every(p => {
    if (!/^\d+$/.test(p)) return false;
    const n = parseInt(p, 10);
    return n >= 0 && n <= 255;
  });
}

/**
 * Validates the form inputs.
 * Returns { valid: true } on success or { valid: false, message: "..." }.
 */
function validateInputs() {
  const ip    = inputIP.value.trim();
  const start = parseInt(inputStart.value, 10);
  const end   = parseInt(inputEnd.value, 10);

  if (!ip) return { valid: false, message: "Please enter a target IP address." };
  if (!isValidIPv4(ip))
    return { valid: false, message: `"${ip}" is not a valid IPv4 address. Use format: 127.0.0.1` };
  if (isNaN(start) || isNaN(end))
    return { valid: false, message: "Port numbers must be valid integers." };
  if (start < 1 || start > 65535)
    return { valid: false, message: "Start port must be between 1 and 65535." };
  if (end < 1 || end > 65535)
    return { valid: false, message: "End port must be between 1 and 65535." };
  if (start > end)
    return { valid: false, message: "Start port cannot be greater than end port." };
  if (end - start > 64999)
    return { valid: false, message: "Port range too large. Maximum range is 65000 ports at a time." };

  return { valid: true };
}

/* ──────────────────────────────────────────────
   Error display
────────────────────────────────────────────── */
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
}

function hideError() {
  errorMsg.classList.add("hidden");
  errorMsg.textContent = "";
}

/* ──────────────────────────────────────────────
   Button state helpers
────────────────────────────────────────────── */
function setScanning(scanning) {
  btnScan.disabled   =  scanning;
  btnStop.disabled   = !scanning;
  btnExport.disabled =  scanning;  // disable export while running
  inputIP.disabled   =  scanning;
  inputStart.disabled =  scanning;
  inputEnd.disabled  =  scanning;
}

/* ──────────────────────────────────────────────
   Progress UI
────────────────────────────────────────────── */
function showProgress() {
  progressSection.classList.remove("hidden");
}

function hideProgress() {
  progressSection.classList.add("hidden");
}

/**
 * Update the progress panel with data from /status.
 * @param {Object} data — parsed JSON from /status
 */
function updateProgress(data) {
  const pct = data.percent ?? 0;
  progressBar.style.width = pct + "%";
  progressTrack.setAttribute("aria-valuenow", pct);

  progressPercent.textContent = pct + "%";

  if (data.running) {
    const cur   = data.current_port ?? 0;
    const total = data.end_port ?? 0;
    progressLabel.textContent  = `Scanning port ${cur} / ${total}…`;
    progressDetail.textContent = `Target: ${data.target}`;
    pulseDot.className         = "pulse-dot";
  } else if (data.stop_requested) {
    progressLabel.textContent = "⛔ Scan stopped by user.";
    pulseDot.className        = "pulse-dot stopped";
  } else if (data.end_time > 0) {
    progressLabel.textContent = "✅ Scan completed successfully.";
    pulseDot.className        = "pulse-dot done";
  }
}

/* ──────────────────────────────────────────────
   Stats cards
────────────────────────────────────────────── */
function showStats(data) {
  statsSection.classList.remove("hidden");
  statTarget.textContent  = data.target  || "—";
  statScanned.textContent = data.results ? data.results.length : 0;
  statOpen.textContent    = data.open_ports ?? 0;
  statClosed.textContent  = data.closed_ports ?? 0;
  statTime.textContent    = data.elapsed ? `${data.elapsed}s` : "—";
}

/* ──────────────────────────────────────────────
   Results table
────────────────────────────────────────────── */

/**
 * Render rows from the results array, respecting activeFilter.
 */
function renderTable(results) {
  allResults = results;

  const filtered = results.filter(r => {
    if (activeFilter === "all")    return true;
    if (activeFilter === "OPEN")   return r.status === "OPEN";
    if (activeFilter === "CLOSED") return r.status === "CLOSED";
    return true;
  });

  resultsTbody.innerHTML = "";

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.style.cssText = "text-align:center; color: var(--text-muted); padding: 2rem;";
    td.textContent = "No results match the current filter.";
    tr.appendChild(td);
    resultsTbody.appendChild(tr);
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach(row => {
    const tr = document.createElement("tr");

    // Port
    const tdPort = document.createElement("td");
    tdPort.className = "col-port";
    tdPort.textContent = row.port;

    // Status badge
    const tdStatus = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = row.status === "OPEN" ? "status-badge status-open" : "status-badge status-closed";
    badge.textContent = row.status;
    tdStatus.appendChild(badge);

    // Service
    const tdService = document.createElement("td");
    tdService.className = row.service === "Unknown" ? "col-service unknown" : "col-service";
    tdService.textContent = row.service;

    tr.appendChild(tdPort);
    tr.appendChild(tdStatus);
    tr.appendChild(tdService);
    fragment.appendChild(tr);
  });

  resultsTbody.appendChild(fragment);
  resultsSection.classList.remove("hidden");
}

/* ──────────────────────────────────────────────
   Polling /status
────────────────────────────────────────────── */
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(fetchStatus, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function fetchStatus() {
  try {
    const res  = await fetch("/status");
    const data = await res.json();

    updateProgress(data);
    showStats(data);

    // Render results progressively while scanning
    if (data.results && data.results.length > 0) {
      renderTable(data.results);
    }

    // Stop polling when scan finishes or is stopped
    if (!data.running) {
      stopPolling();
      setScanning(false);

      // Enable export if we have results
      if (data.results && data.results.length > 0) {
        btnExport.disabled = false;
      }
    }
  } catch (err) {
    console.error("Status poll error:", err);
  }
}

/* ──────────────────────────────────────────────
   Scan form submit
────────────────────────────────────────────── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  // 1. Validate
  const check = validateInputs();
  if (!check.valid) {
    showError(check.message);
    return;
  }

  // 2. Prepare UI
  setScanning(true);
  allResults = [];
  resultsTbody.innerHTML = "";
  resultsSection.classList.add("hidden");
  statsSection.classList.add("hidden");
  showProgress();
  progressBar.style.width = "0%";
  progressLabel.textContent = "Starting scan…";
  progressPercent.textContent = "0%";
  progressDetail.textContent = "";
  pulseDot.className = "pulse-dot";

  // 3. POST /scan
  try {
    const res = await fetch("/scan", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target:     inputIP.value.trim(),
        start_port: parseInt(inputStart.value, 10),
        end_port:   parseInt(inputEnd.value, 10),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Failed to start scan.");
      setScanning(false);
      hideProgress();
      return;
    }

    // 4. Start polling
    startPolling();

  } catch (err) {
    showError("Network error: Could not reach the backend. Is Flask running?");
    setScanning(false);
    hideProgress();
  }
});

/* ──────────────────────────────────────────────
   Stop button
────────────────────────────────────────────── */
btnStop.addEventListener("click", async () => {
  try {
    await fetch("/stop", { method: "POST" });
    progressLabel.textContent = "⛔ Stop requested…";
  } catch (err) {
    console.error("Stop error:", err);
  }
});

/* ──────────────────────────────────────────────
   Clear button
────────────────────────────────────────────── */
btnClear.addEventListener("click", () => {
  stopPolling();
  setScanning(false);
  hideProgress();
  hideError();
  allResults = [];
  resultsTbody.innerHTML = "";
  resultsSection.classList.add("hidden");
  statsSection.classList.add("hidden");
  btnExport.disabled = true;
  activeFilter = "all";
  filterBtns.forEach(b => b.classList.toggle("active", b.dataset.filter === "all"));
});

/* ──────────────────────────────────────────────
   Export button
────────────────────────────────────────────── */
btnExport.addEventListener("click", () => {
  // Just navigate to the export endpoint — Flask sends the CSV file
  window.location.href = "/export";
});

/* ──────────────────────────────────────────────
   Filter buttons
────────────────────────────────────────────── */
filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    activeFilter = btn.dataset.filter;
    filterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    if (allResults.length > 0) renderTable(allResults);
  });
});

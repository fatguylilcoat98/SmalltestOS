// SmalltestOS — smallest possible WebLLM chat test app.
// WebLLM only. No routing, no memory persistence, no persona, no hidden layers.
// Everything runs in the browser via WebGPU.
//
// WebLLM is loaded with a *dynamic* import the first time you click "Load
// model". That keeps the UI shell (model selector, status) working even if the
// CDN is briefly unreachable — and turns a network failure into a clear message
// instead of a blank screen.
//
// We try multiple CDNs in order: some mobile networks block or throttle one
// jsDelivr/esm.run) but not another (esm.sh). First one that imports wins.
const WEBLLM_CDNS = [
  "https://esm.run/@mlc-ai/web-llm",
  "https://esm.sh/@mlc-ai/web-llm",
];
let webllm = null;

async function ensureWebLLM() {
  if (webllm) return webllm;
  let lastErr;
  for (const url of WEBLLM_CDNS) {
    try {
      setStatus("loading WebLLM runtime… (" + new URL(url).host + ")");
      webllm = await import(url);
      return webllm;
    } catch (e) {
      console.warn("WebLLM import failed from", url, e);
      lastErr = e;
    }
  }
  throw new Error(
    "Could not load WebLLM from any CDN (tried " +
      WEBLLM_CDNS.map((u) => new URL(u).host).join(", ") +
      "). Check your connection. Last error: " +
      (lastErr?.message || lastErr)
  );
}

// --- Curated list of small, phone-friendly models -------------------------
// Kept intentionally short. Smallest first so phones have a safe default.
const MODELS = [
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "SmolLM2-360M-Instruct-q4f16_1-MLC",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "gemma-2-2b-it-q4f16_1-MLC",
  "Phi-3.5-mini-instruct-q4f16_1-MLC",
];

// --- DOM refs --------------------------------------------------------------
const modelSelect = document.getElementById("model-select");
const loadBtn = document.getElementById("load-btn");
const modelIdEl = document.getElementById("model-id");
const loadStatusEl = document.getElementById("load-status");
const downloadEl = document.getElementById("download-progress");
const responseTimeEl = document.getElementById("response-time");
const progressBar = document.getElementById("progress-bar");
const chatEl = document.getElementById("chat");
const form = document.getElementById("chat-form");
const input = document.getElementById("prompt-input");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clear-btn");

// --- State -----------------------------------------------------------------
let engine = null;
let loadedModelId = null;
let busy = false;
// In-session conversation only. Not saved anywhere; "Clear chat" wipes it.
let messages = [];

// --- Init UI ---------------------------------------------------------------
for (const id of MODELS) {
  const opt = document.createElement("option");
  opt.value = id;
  opt.textContent = id;
  modelSelect.appendChild(opt);
}
modelIdEl.textContent = modelSelect.value;
modelSelect.addEventListener("change", () => {
  modelIdEl.textContent = modelSelect.value;
});

if (!("gpu" in navigator)) {
  setStatus("WebGPU not available in this browser");
  addMessage(
    "bot",
    "This browser does not expose WebGPU, which WebLLM needs.\n\n" +
      "On a phone try: iOS 18+ Safari, or Chrome/Edge on Android. " +
      "On desktop use a recent Chrome, Edge, or Firefox Nightly."
  );
  loadBtn.disabled = true;
}

// --- Helpers ---------------------------------------------------------------
function setStatus(text) {
  loadStatusEl.textContent = text;
}

function setProgress(fraction) {
  const pct = Math.max(0, Math.min(1, fraction || 0)) * 100;
  progressBar.style.width = pct + "%";
}

// --- Download readout ------------------------------------------------------
// Shows percent + MB fetched + a wall-clock elapsed counter. The elapsed timer
// ticks on its own once per second, so if the download stalls you can SEE it:
// the seconds keep climbing while percent/MB stay frozen = stuck, not slow.
let loadStart = 0;
let elapsedTimer = null;
let lastProgressPct = 0;
let lastMb = "";

function fmtElapsed() {
  const s = Math.max(0, (performance.now() - loadStart) / 1000);
  return s < 60 ? s.toFixed(0) + "s" : Math.floor(s / 60) + "m " + Math.floor(s % 60) + "s";
}

function renderDownload() {
  const parts = [lastProgressPct + "%"];
  if (lastMb) parts.push(lastMb);
  parts.push(fmtElapsed());
  downloadEl.textContent = parts.join(" · ");
}

function startDownloadReadout() {
  loadStart = performance.now();
  lastProgressPct = 0;
  lastMb = "";
  renderDownload();
  clearInterval(elapsedTimer);
  elapsedTimer = setInterval(renderDownload, 1000); // keep ticking even mid-stall
}

function stopDownloadReadout(finalText) {
  clearInterval(elapsedTimer);
  elapsedTimer = null;
  if (finalText !== undefined) downloadEl.textContent = finalText;
}

// Pull "123MB" out of WebLLM's progress text when present.
function parseMb(text) {
  const m = /([\d.]+\s*MB)/i.exec(text || "");
  return m ? m[1].replace(/\s+/g, "") : "";
}

function addMessage(role, text) {
  const el = document.createElement("div");
  el.className = "msg " + (role === "user" ? "user" : "bot");
  el.textContent = text;
  chatEl.appendChild(el);
  chatEl.scrollTop = chatEl.scrollHeight;
  return el;
}

function setMeta(el, text) {
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = text;
  el.appendChild(meta);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function setComposerEnabled(enabled) {
  input.disabled = !enabled;
  sendBtn.disabled = !enabled;
}

// --- Load the selected model ----------------------------------------------
async function loadModel() {
  if (busy) return;
  const modelId = modelSelect.value;
  busy = true;
  loadBtn.disabled = true;
  modelSelect.disabled = true;
  setComposerEnabled(false);
  setProgress(0);
  modelIdEl.textContent = modelId;
  setStatus("initializing…");
  startDownloadReadout();

  try {
    setStatus("loading WebLLM runtime…");
    const lib = await ensureWebLLM();
    engine = await lib.CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        // report.progress: 0..1, report.text: human readable stage
        setStatus(report.text || "loading…");
        if (typeof report.progress === "number") {
          setProgress(report.progress);
          lastProgressPct = Math.round(report.progress * 100);
        }
        const mb = parseMb(report.text);
        if (mb) lastMb = mb;
        renderDownload();
      },
    });

    loadedModelId = modelId;
    setProgress(1);
    setStatus("ready");
    stopDownloadReadout("done · " + fmtElapsed());
    messages = []; // fresh model = fresh conversation, no memory carried over
    setComposerEnabled(true);
    input.focus();
    addMessage("bot", "Model loaded: " + modelId + "\nAsk me anything.");
  } catch (err) {
    console.error(err);
    setStatus("error");
    stopDownloadReadout("failed · " + fmtElapsed());
    addMessage("bot", "Failed to load model:\n" + (err?.message || String(err)));
  } finally {
    busy = false;
    loadBtn.disabled = false;
    modelSelect.disabled = false;
  }
}

// --- Send a prompt ---------------------------------------------------------
async function send(prompt) {
  if (!engine || busy) return;
  busy = true;
  setComposerEnabled(false);

  addMessage("user", prompt);
  messages.push({ role: "user", content: prompt });

  const botEl = addMessage("bot", "");
  const start = performance.now();

  try {
    // Stream the raw model output straight to the screen. No post-processing.
    const chunks = await engine.chat.completions.create({
      messages,
      stream: true,
    });

    let full = "";
    for await (const chunk of chunks) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      if (delta) {
        full += delta;
        botEl.textContent = full;
        chatEl.scrollTop = chatEl.scrollHeight;
      }
    }

    const elapsedMs = performance.now() - start;
    const secs = (elapsedMs / 1000).toFixed(2);
    messages.push({ role: "assistant", content: full });
    setMeta(botEl, secs + "s · " + loadedModelId);
    responseTimeEl.textContent = secs + "s";
  } catch (err) {
    console.error(err);
    botEl.textContent = "Error: " + (err?.message || String(err));
  } finally {
    busy = false;
    setComposerEnabled(true);
    input.focus();
  }
}

// --- Events ----------------------------------------------------------------
loadBtn.addEventListener("click", loadModel);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  send(text);
});

clearBtn.addEventListener("click", () => {
  messages = [];
  chatEl.innerHTML = "";
  responseTimeEl.textContent = "—";
  if (loadedModelId) addMessage("bot", "Chat cleared. Model still loaded: " + loadedModelId);
});

// --- PWA: register the app-shell service worker (optional, non-blocking) ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW:", e));
  });
}

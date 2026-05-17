import { loadConfig, bindPanel } from "./controls";
import type { Config } from "./controls";
import { imageToAscii, computeGrid } from "./imageToAscii";
import { CharacterGrid } from "./grid";
import { applyDisplacement } from "./displacement";
import { render } from "./renderer";

// ── State ────────────────────────────────────────────────────────────────────

const cfg: Config = loadConfig();

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const overlay = document.getElementById("upload-overlay") as HTMLElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const uploadBtn = document.getElementById("upload-btn") as HTMLButtonElement;

const grid = new CharacterGrid();

let currentImage: HTMLImageElement | null = null;
let mouseX = -9999;
let mouseY = -9999;
// prevMouse: position at start of last frame (for path interpolation)
let prevMouseX = -9999;
let prevMouseY = -9999;
// frameMouse: position recorded at end of last tick (for speed calc)
let lastMouseX = -9999;
let lastMouseY = -9999;
let mouseSpeed = 0;

// ── Resize ───────────────────────────────────────────────────────────────────

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (currentImage) buildGrid(currentImage);
}

window.addEventListener("resize", resize);
resize();

// ── Grid construction ────────────────────────────────────────────────────────

function buildGrid(img: HTMLImageElement) {
  const imageAspect = img.naturalWidth / img.naturalHeight;

  const { cols, rows, cellW, cellH } = computeGrid(
    cfg.cols,
    imageAspect,
    cfg.fontSize,
    canvas.width,
    canvas.height,
  );

  const cells = imageToAscii(img, cols, rows, cfg.charRamp, cfg.gamma);

  // Centre the grid on the canvas
  const totalW = cols * cellW;
  const totalH = rows * cellH;
  const offsetX = (canvas.width - totalW) / 2;
  const offsetY = (canvas.height - totalH) / 2;

  grid.build(cells, cols, rows, cellW, cellH, offsetX, offsetY);
}

// ── Image loading ─────────────────────────────────────────────────────────────

function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    currentImage = img;
    buildGrid(img);
    overlay.classList.add("hidden");
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

uploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files?.[0]) loadImage(fileInput.files[0]);
});

// Drag-and-drop on the whole page
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (file && file.type.startsWith("image/")) loadImage(file);
});

// Paste from clipboard (Ctrl+V / screenshot / copy image in browser)
document.addEventListener("paste", (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        loadImage(file);
        break;
      }
    }
  }
});

// ── Mouse tracking ────────────────────────────────────────────────────────────

document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

document.addEventListener("mouseleave", () => {
  mouseX = -9999;
  mouseY = -9999;
});

// ── Controls callback ─────────────────────────────────────────────────────────

bindPanel(
  cfg,
  (_cfg) => {
    /* live params feed directly into rAF — nothing to do */
  },
  () => {
    if (currentImage) buildGrid(currentImage);
  },
);

// ── Perf stats ───────────────────────────────────────────────────────────────

const elFps = document.getElementById("stat-fps")!;
const elFrame = document.getElementById("stat-frame")!;
const elBudget = document.getElementById("stat-budget")!;
const elGlyphs = document.getElementById("stat-glyphs")!;

const BUDGET_MS = 1000 / 60; // target frame budget at 60 fps
let statFrameCount = 0;
let statFpsAccum = 0;
let statFrameAccum = 0;
let statBudgetAccum = 0;
let statLastTime = performance.now();

function updateStats(frameMs: number, workMs: number) {
  statFrameCount++;
  const now = performance.now();
  statFpsAccum += 1000 / frameMs;
  statFrameAccum += workMs;
  statBudgetAccum += (workMs / BUDGET_MS) * 100;

  // Flush every 20 frames so numbers are readable but still responsive
  if (statFrameCount >= 20) {
    const n = statFrameCount;
    const fps = statFpsAccum / n;
    const frame = statFrameAccum / n;
    const budget = statBudgetAccum / n;

    elFps.textContent = `${fps.toFixed(0)} fps`;
    elFrame.textContent = `${frame.toFixed(1)} ms`;
    elBudget.textContent = `${budget.toFixed(0)}% budget`;
    elBudget.style.color = budget > 80 ? "#f64" : budget > 50 ? "#fa0" : "#fff";

    statFrameCount = statFpsAccum = statFrameAccum = statBudgetAccum = 0;
  }
  statLastTime = now;
}

// ── Animation loop ────────────────────────────────────────────────────────────

let lastTickTime = performance.now();

function tick() {
  requestAnimationFrame(tick);

  const tickStart = performance.now();
  const frameMs = tickStart - lastTickTime;
  lastTickTime = tickStart;

  if (grid.glyphs.length === 0) return;

  // Mouse speed (pixels/frame, exponential smoothing)
  const dx = mouseX - lastMouseX;
  const dy = mouseY - lastMouseY;
  mouseSpeed = mouseSpeed * 0.85 + Math.sqrt(dx * dx + dy * dy) * 0.15;

  applyDisplacement(grid.glyphs, mouseX, mouseY, prevMouseX, prevMouseY, cfg);

  prevMouseX = mouseX;
  prevMouseY = mouseY;
  lastMouseX = mouseX;
  lastMouseY = mouseY;

  render(ctx, grid.glyphs, cfg, cfg.fontSize, mouseSpeed);

  const workMs = performance.now() - tickStart;
  elGlyphs.textContent = `${grid.glyphs.length} gl`;
  updateStats(frameMs, workMs);
}

tick();

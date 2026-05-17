export interface Config {
  radius: number;
  strength: number;
  spring: number;
  damping: number;
  chromaticOffset: number;
  chromaticDynamic: number;
  fontSize: number;
  brightness: number;
  gamma: number;
  colorize: number;
  attract: boolean;
  cols: number;
  charRamp: string;
}

// 70-char ramp ordered dense → sparse (Paul Bourke / standard reference)
const BOURKE_RAMP =
  '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`. ';

export const DEFAULT_CONFIG: Config = {
  radius: 120,
  strength: 6,
  spring: 0.08,
  damping: 0.82,
  chromaticOffset: 2.5,
  chromaticDynamic: 1.5,
  fontSize: 9,
  brightness: 1.2,
  gamma: 0.7,
  colorize: 0,
  attract: false,
  cols: 160,
  charRamp: BOURKE_RAMP,
};

const STORAGE_KEY = "chromatic-ascii-config";

export function loadConfig(): Config {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<Config>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(cfg: Config): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function resetConfig(): Config {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_CONFIG };
}

interface SliderDef {
  id: string;
  key: keyof Config;
  /** If true, changing this param requires a full grid rebuild */
  rebuild: boolean;
}

const SLIDERS: SliderDef[] = [
  { id: "ctrl-radius", key: "radius", rebuild: false },
  { id: "ctrl-strength", key: "strength", rebuild: false },
  { id: "ctrl-spring", key: "spring", rebuild: false },
  { id: "ctrl-damping", key: "damping", rebuild: false },
  { id: "ctrl-chromaticOffset", key: "chromaticOffset", rebuild: false },
  { id: "ctrl-chromaticDynamic", key: "chromaticDynamic", rebuild: false },
  { id: "ctrl-brightness", key: "brightness", rebuild: false },
  { id: "ctrl-colorize", key: "colorize", rebuild: false },
  { id: "ctrl-fontSize", key: "fontSize", rebuild: true },
  { id: "ctrl-gamma", key: "gamma", rebuild: true },
  { id: "ctrl-cols", key: "cols", rebuild: true },
];

function fmt(val: number, key: keyof Config): string {
  if (
    key === "spring" ||
    key === "damping" ||
    key === "gamma" ||
    key === "colorize"
  )
    return val.toFixed(2);
  if (
    key === "chromaticOffset" ||
    key === "chromaticDynamic" ||
    key === "strength" ||
    key === "brightness"
  )
    return val.toFixed(1);
  if (key === "cols") return `${Math.round(val)} ch`;
  return String(Math.round(val));
}

function syncSlider(
  slider: HTMLInputElement,
  valEl: HTMLElement,
  val: number,
  key: keyof Config,
) {
  slider.value = String(val);
  valEl.textContent = fmt(val, key);
}

/**
 * Throttles rebuild calls to at most once per animation frame so dragging
 * a slider feels live without queueing redundant rebuilds mid-frame.
 */
function rafThrottle(fn: (cfg: Config) => void) {
  let pending = false;
  let lastArg: Config;
  return (cfg: Config) => {
    lastArg = cfg;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      fn(lastArg);
    });
  };
}

/**
 * @param onLive    Called immediately on every live-param change (no rebuild).
 * @param onRebuild Called (rAF-throttled) when a structural param changes and
 *                  the grid must be reconstructed from the image.
 */
export function bindPanel(
  cfg: Config,
  onLive: (cfg: Config) => void,
  onRebuild: (cfg: Config) => void,
): void {
  const throttledRebuild = rafThrottle(onRebuild);

  // Sync all sliders to current config values
  for (const { id, key, rebuild } of SLIDERS) {
    const slider = document.getElementById(id) as HTMLInputElement | null;
    const valEl = document.getElementById(`val-${key}`) as HTMLElement | null;
    if (!slider || !valEl) continue;

    syncSlider(slider, valEl, cfg[key] as number, key);

    slider.addEventListener("input", () => {
      const num = parseFloat(slider.value);
      (cfg as unknown as { [key: string]: number })[key] = num;
      valEl.textContent = fmt(num, key);
      if (rebuild) {
        throttledRebuild(cfg);
      } else {
        onLive(cfg);
      }
    });
  }

  // Char ramp — structural, rAF-throttled
  const rampInput = document.getElementById(
    "ramp-input",
  ) as HTMLInputElement | null;
  if (rampInput) {
    rampInput.value = cfg.charRamp;
    rampInput.addEventListener("input", () => {
      if (rampInput.value.length > 0) {
        cfg.charRamp = rampInput.value;
        throttledRebuild(cfg);
      }
    });
  }

  // Attract toggle
  const attractBtn = document.getElementById(
    "btn-attract",
  ) as HTMLButtonElement | null;
  function syncAttractBtn() {
    if (!attractBtn) return;
    attractBtn.textContent = cfg.attract ? "Attract" : "Repel";
    attractBtn.classList.toggle("active", cfg.attract);
  }
  syncAttractBtn();
  attractBtn?.addEventListener("click", () => {
    cfg.attract = !cfg.attract;
    syncAttractBtn();
    onLive(cfg);
  });

  // Save button
  const saveBtn = document.getElementById(
    "btn-save",
  ) as HTMLButtonElement | null;
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      saveConfig(cfg);
      saveBtn.textContent = "Saved!";
      saveBtn.classList.add("flash");
      setTimeout(() => {
        saveBtn.textContent = "Save";
        saveBtn.classList.remove("flash");
      }, 1200);
    });
  }

  // Reset button
  const resetBtn = document.getElementById(
    "btn-reset",
  ) as HTMLButtonElement | null;
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const defaults = resetConfig();
      Object.assign(cfg, defaults);

      // Sync sliders back to defaults
      for (const { id, key } of SLIDERS) {
        const slider = document.getElementById(id) as HTMLInputElement | null;
        const valEl = document.getElementById(
          `val-${key}`,
        ) as HTMLElement | null;
        if (slider && valEl)
          syncSlider(slider, valEl, defaults[key] as number, key);
      }
      if (rampInput) rampInput.value = defaults.charRamp;
      syncAttractBtn();

      // Reset always does a full rebuild
      onRebuild(cfg);
    });
  }

  // Toggle panel with C key
  const toggle = document.getElementById(
    "controls-toggle",
  ) as HTMLButtonElement | null;
  const panel = document.getElementById("control-panel") as HTMLElement | null;
  if (toggle && panel) {
    toggle.addEventListener("click", () => {
      panel.classList.toggle("open");
      toggle.classList.toggle("active");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "c" || e.key === "C") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        panel.classList.toggle("open");
        toggle.classList.toggle("active");
      }
    });
  }
}

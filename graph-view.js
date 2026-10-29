// Interactive canvas plot: drag to pan, pinch (or scroll wheel) to zoom, tap to trace.

import { formatNumber } from './calc.js';
import { findRoots, findIntersections, niceStep } from './graph.js';

/** @typedef {{ fn: (x: number) => number, color: string }} Curve  color: a CSS custom property name like '--graph-1' */
/** @typedef {{ x: number, y: number, color: string, kind: 'zero' | 'intersection' | 'point' }} Marker */

const ROOT_SAMPLES = 400;
const MIN_SCALE = 1e-6;
const MAX_SCALE = 1e7;
const TAP_SLOP_PX = 6;
const MARKER_HIT_PX = 22;
const CURVE_HIT_PX = 36;
const HINT = 'Drag · pinch to zoom · tap a curve for values';
const LABEL_EDGE_PX = 14;

/**
 * Six significant figures, with float noise like 1e-17 shown as 0.
 * @param {number} v
 * @param {number} unitsPerPixel
 */
function readable(v, unitsPerPixel) {
  return formatNumber(Math.abs(v) < unitsPerPixel * 1e-6 ? 0 : Number(v.toPrecision(6)));
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} readout
 */
export function createGraphView(canvas, readout) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  // Centre of the view in graph units, and pixels per unit (same on both axes). 0 = not sized yet.
  let view = { cx: 0, cy: 0, scale: 0 };
  /** @type {Curve[]} */
  let curves = [];
  // `curves` with colours resolved for the current theme; refreshed on every draw.
  /** @type {Curve[]} */
  let shown = [];
  /** @type {Marker | null} */
  let trace = null;
  /** @type {Marker[]} */
  let markers = [];
  /** @type {Map<number, { x: number, y: number }>} */
  const pointers = new Map();
  let moved = false;

  const width = () => canvas.clientWidth;
  const height = () => canvas.clientHeight;
  /** @param {number} px */
  const toX = (px) => view.cx + (px - width() / 2) / view.scale;
  /** @param {number} py */
  const toY = (py) => view.cy - (py - height() / 2) / view.scale;
  /** @param {number} x */
  const toPx = (x) => width() / 2 + (x - view.cx) * view.scale;
  /** @param {number} y */
  const toPy = (y) => height() / 2 - (y - view.cy) * view.scale;

  function palette() {
    const css = getComputedStyle(canvas);
    /** @param {string} name */
    const v = (name) => css.getPropertyValue(name).trim();
    return { grid: v('--line'), axis: v('--ink-faint'), label: v('--ink-soft'), ink: v('--ink'), card: v('--card') };
  }

  function computeMarkers() {
    const a = toX(0);
    const b = toX(width());
    /** @type {Marker[]} */
    const found = [];
    for (const curve of shown) {
      for (const x of findRoots(curve.fn, a, b, ROOT_SAMPLES)) found.push({ x, y: 0, color: curve.color, kind: 'zero' });
    }
    for (let i = 0; i < shown.length; i += 1) {
      for (let j = i + 1; j < shown.length; j += 1) {
        for (const p of findIntersections(shown[i].fn, shown[j].fn, a, b, ROOT_SAMPLES)) {
          found.push({ ...p, color: palette().ink, kind: 'intersection' });
        }
      }
    }
    return found;
  }

  /**
   * @param {ReturnType<typeof palette>} colors
   */
  function drawGrid(colors) {
    const w = width();
    const h = height();
    const step = niceStep(w / view.scale, Math.max(4, w / 70));
    const minor = step / 5;
    /** @param {number} s @param {string} color @param {number} lineWidth */
    const lines = (s, color, lineWidth) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      for (let x = Math.ceil(toX(0) / s) * s; x <= toX(w); x += s) {
        const px = Math.round(toPx(x)) + 0.5;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, h);
      }
      for (let y = Math.ceil(toY(h) / s) * s; y <= toY(0); y += s) {
        const py = Math.round(toPy(y)) + 0.5;
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
      }
      ctx.stroke();
    };
    ctx.globalAlpha = 0.5;
    lines(minor, colors.grid, 1);
    ctx.globalAlpha = 1;
    lines(step, colors.grid, 1);

    // Axes, kept on screen edges when the origin is off screen (labels follow them).
    const axisX = Math.min(Math.max(toPy(0), 0), h);
    const axisY = Math.min(Math.max(toPx(0), 0), w);
    ctx.strokeStyle = colors.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (toPy(0) >= 0 && toPy(0) <= h) { ctx.moveTo(0, toPy(0)); ctx.lineTo(w, toPy(0)); }
    if (toPx(0) >= 0 && toPx(0) <= w) { ctx.moveTo(toPx(0), 0); ctx.lineTo(toPx(0), h); }
    ctx.stroke();

    ctx.fillStyle = colors.label;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelY = Math.min(axisX + 4, h - 16);
    for (let x = Math.ceil(toX(0) / step) * step; x <= toX(w); x += step) {
      const value = Number(x.toPrecision(12));
      const px = toPx(x);
      if (value !== 0 && px > LABEL_EDGE_PX && px < w - LABEL_EDGE_PX) ctx.fillText(formatNumber(value), px, labelY);
    }
    ctx.textAlign = axisY > w - 40 ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    const labelX = axisY > w - 40 ? axisY - 5 : axisY + 5;
    for (let y = Math.ceil(toY(h) / step) * step; y <= toY(0); y += step) {
      const value = Number(y.toPrecision(12));
      const py = toPy(y);
      if (value !== 0 && py > LABEL_EDGE_PX && py < h - LABEL_EDGE_PX) ctx.fillText(formatNumber(value), labelX, py);
    }
  }

  /** @param {Curve} curve */
  function drawCurve(curve) {
    const w = width();
    const h = height();
    ctx.strokeStyle = curve.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let penDown = false;
    let lastPy = 0;
    for (let px = 0; px <= w; px += 0.5) {
      const y = curve.fn(toX(px));
      if (!Number.isFinite(y)) {
        penDown = false;
        continue;
      }
      const py = Math.min(Math.max(toPy(y), -h), 2 * h);
      // A jump of more than a screen between neighbouring samples is an asymptote, not a line.
      if (penDown && Math.abs(py - lastPy) > h * 1.5) penDown = false;
      if (penDown) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
      penDown = true;
      lastPy = py;
    }
    ctx.stroke();
  }

  /**
   * @param {Marker} m
   * @param {number} radius
   * @param {string} card
   */
  function drawDot(m, radius, card) {
    ctx.beginPath();
    ctx.arc(toPx(m.x), toPy(m.y), radius, 0, Math.PI * 2);
    ctx.fillStyle = card;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = m.color;
    ctx.stroke();
  }

  function updateReadout() {
    if (trace === null) {
      readout.textContent = curves.length === 0 ? 'Type a function below to plot it' : HINT;
      readout.classList.remove('active');
      return;
    }
    const unit = 1 / view.scale;
    const what = trace.kind === 'zero' ? 'Zero  ' : trace.kind === 'intersection' ? 'Crossing  ' : '';
    readout.textContent = `${what}x = ${readable(trace.x, unit)},  y = ${readable(trace.y, unit)}`;
    readout.classList.add('active');
  }

  function draw() {
    const w = width();
    const h = height();
    if (w === 0 || h === 0) return;
    if (view.scale === 0) view = { cx: 0, cy: 0, scale: w / 20 };
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const colors = palette();
    const css = getComputedStyle(canvas);
    shown = curves.map((c) => ({ fn: c.fn, color: css.getPropertyValue(c.color).trim() }));
    drawGrid(colors);
    for (const curve of shown) drawCurve(curve);
    markers = computeMarkers();
    for (const m of markers) drawDot(m, 4, colors.card);
    if (trace !== null) {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = trace.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(toPx(trace.x), 0);
      ctx.lineTo(toPx(trace.x), h);
      ctx.stroke();
      ctx.setLineDash([]);
      drawDot(trace, 6.5, colors.card);
    }
    updateReadout();
  }

  /**
   * @param {number} px
   * @param {number} py
   */
  function traceAt(px, py) {
    const near = markers
      .map((m) => ({ m, d: Math.hypot(toPx(m.x) - px, toPy(m.y) - py) }))
      .filter((c) => c.d <= MARKER_HIT_PX)
      .sort((p, q) => p.d - q.d)[0];
    if (near) {
      trace = near.m;
    } else {
      const x = toX(px);
      const hit = shown
        .map((c) => ({ c, y: c.fn(x) }))
        .filter((c) => Number.isFinite(c.y))
        .map((c) => ({ ...c, d: Math.abs(toPy(c.y) - py) }))
        .filter((c) => c.d <= CURVE_HIT_PX)
        .sort((p, q) => p.d - q.d)[0];
      trace = hit ? { x, y: hit.y, color: hit.c.color, kind: 'point' } : null;
    }
    draw();
  }

  /**
   * Zoom by `factor` keeping the graph point under (px, py) fixed.
   * @param {number} px
   * @param {number} py
   * @param {number} factor
   */
  function zoomAt(px, py, factor) {
    const gx = toX(px);
    const gy = toY(py);
    const scale = Math.min(Math.max(view.scale * factor, MIN_SCALE), MAX_SCALE);
    view = { scale, cx: gx - (px - width() / 2) / scale, cy: gy + (py - height() / 2) / scale };
  }

  /** @param {PointerEvent} e */
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) moved = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const point = local(e);
    if (pointers.size === 1) {
      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      if (!moved && Math.hypot(dx, dy) < TAP_SLOP_PX) return; // still a tap; keep the start point
      moved = true;
      view = { ...view, cx: view.cx - dx / view.scale, cy: view.cy + dy / view.scale };
      pointers.set(e.pointerId, point);
    } else if (pointers.size === 2) {
      const [other] = [...pointers.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p);
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(point.x - other.x, point.y - other.y);
      const mid = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
      const newMid = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 };
      if (before > 0) zoomAt(mid.x, mid.y, after / before);
      view = { ...view, cx: view.cx - (newMid.x - mid.x) / view.scale, cy: view.cy + (newMid.y - mid.y) / view.scale };
      moved = true;
      pointers.set(e.pointerId, point);
    }
    draw();
  });
  /** @param {PointerEvent} e */
  const release = (e) => {
    const wasTap = e.type === 'pointerup' && pointers.size === 1 && !moved;
    pointers.delete(e.pointerId);
    if (wasTap) {
      const p = local(e);
      traceAt(p.x, p.y);
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    draw();
  }, { passive: false });

  new ResizeObserver(() => draw()).observe(canvas);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => draw());

  return {
    /** @param {Curve[]} next */
    setCurves(next) {
      curves = next;
      trace = null;
      draw();
    },
    resetView() {
      view = { cx: 0, cy: 0, scale: width() / 20 };
      trace = null;
      draw();
    },
    /** Repaint, e.g. after the theme changes colours. */
    redraw() {
      draw();
    },
  };
}

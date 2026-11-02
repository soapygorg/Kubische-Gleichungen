'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type View = { xMin: number; xMax: number; yMin: number; yMax: number };

function niceStep(range: number, targetTicks: number): number {
  const raw = range / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const nice = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  return nice * pow;
}

function fmtTick(v: number, step: number): string {
  if (Math.abs(v) < step * 1e-9) return '0';
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0)) return v.toExponential(1).replace('.', ',');
  return v.toFixed(Math.min(decimals, 8)).replace('.', ',');
}

export default function Plot({
  coeffs,
  realRoots,
  fitKey,
}: {
  coeffs: [number, number, number, number];
  realRoots: number[];
  /** Ändert sich dieser Schlüssel, wird die Ansicht neu eingepasst (z. B. bei neuen Koeffizienten). */
  fitKey: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 420 });
  const [view, setView] = useState<View>({ xMin: -5, xMax: 5, yMin: -10, yMax: 10 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [scheme, setScheme] = useState(0);

  const viewRef = useRef(view);
  viewRef.current = view;

  const [a, b, c, d] = coeffs;
  const f = useMemo(() => (x: number) => ((a * x + b) * x + c) * x + d, [a, b, c, d]);

  const fit = useCallback(
    (roots: number[], fn: (x: number) => number) => {
      let xMin = -5;
      let xMax = 5;
      if (roots.length) {
        const lo = Math.min(...roots);
        const hi = Math.max(...roots);
        const pad = Math.max(hi - lo, 1) * 0.5 + 0.5;
        xMin = lo - pad;
        xMax = hi + pad;
      }
      let yMin = 0;
      let yMax = 0;
      for (let i = 0; i <= 300; i++) {
        const y = fn(xMin + ((xMax - xMin) * i) / 300);
        if (Number.isFinite(y)) {
          yMin = Math.min(yMin, y);
          yMax = Math.max(yMax, y);
        }
      }
      if (yMax - yMin < 1e-9) {
        yMin -= 1;
        yMax += 1;
      }
      const pad = (yMax - yMin) * 0.1;
      setView({ xMin, xMax, yMin: yMin - pad, yMax: yMax + pad });
    },
    [],
  );

  // aktuelle Werte für Effekte, die nur bei fitKey-Wechsel laufen
  const latest = useRef({ roots: realRoots, f });
  latest.current = { roots: realRoots, f };
  useEffect(() => {
    fit(latest.current.roots, latest.current.f);
  }, [fitKey, fit]);

  // Größe beobachten
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.max(240, Math.floor(el.clientWidth));
      const h = Math.max(260, Math.min(520, Math.round(w * 0.65)));
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Farbschema-Wechsel
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => setScheme((s) => s + 1);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const zoomAt = useCallback((cx: number, cy: number, zx: number, zy: number) => {
    const v = viewRef.current;
    const nx0 = cx - (cx - v.xMin) * zx;
    const nx1 = cx + (v.xMax - cx) * zx;
    const ny0 = cy - (cy - v.yMin) * zy;
    const ny1 = cy + (v.yMax - cy) * zy;
    if (nx1 - nx0 < 1e-9 || nx1 - nx0 > 1e9 || ny1 - ny0 < 1e-9 || ny1 - ny0 > 1e12) return;
    setView({ xMin: nx0, xMax: nx1, yMin: ny0, yMax: ny1 });
  }, []);

  // Mausrad (nicht-passiv, damit die Seite nicht scrollt)
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const v = viewRef.current;
      const cx = v.xMin + ((e.clientX - rect.left) / rect.width) * (v.xMax - v.xMin);
      const cy = v.yMax - ((e.clientY - rect.top) / rect.height) * (v.yMax - v.yMin);
      const delta = e.deltaY || e.deltaX;
      const factor = Math.exp(Math.max(-200, Math.min(200, delta)) * 0.0015);
      // Shift: nur x-Achse, Alt: nur y-Achse
      zoomAt(cx, cy, e.altKey ? 1 : factor, e.shiftKey ? 1 : factor);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Ziehen (Verschieben) und Pinch-Zoom
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const v = viewRef.current;
    const prev = pointers.current.get(e.pointerId);
    if (prev) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 1) {
        const dx = ((e.clientX - prev.x) / rect.width) * (v.xMax - v.xMin);
        const dy = ((e.clientY - prev.y) / rect.height) * (v.yMax - v.yMin);
        setView({ xMin: v.xMin - dx, xMax: v.xMax - dx, yMin: v.yMin + dy, yMax: v.yMax + dy });
      } else if (pointers.current.size === 2 && pinchDist.current) {
        const [p1, p2] = [...pointers.current.values()];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const cx = v.xMin + ((mx - rect.left) / rect.width) * (v.xMax - v.xMin);
        const cy = v.yMax - ((my - rect.top) / rect.height) * (v.yMax - v.yMin);
        const factor = pinchDist.current / dist;
        pinchDist.current = dist;
        zoomAt(cx, cy, factor, factor);
      }
    } else {
      const x = v.xMin + ((e.clientX - rect.left) / rect.width) * (v.xMax - v.xMin);
      setHover({ x, y: f(x) });
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;
  };

  // Zeichnen
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = size;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const css = getComputedStyle(canvas);
    const col = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
    const cBg = col('--plot-bg', '#fff');
    const cGrid = col('--plot-grid', '#e5e7eb');
    const cAxis = col('--plot-axis', '#6b7280');
    const cText = col('--plot-text', '#374151');
    const cCurve = col('--plot-curve', '#2563eb');
    const cRoot = col('--plot-root', '#dc2626');

    const { xMin, xMax, yMin, yMax } = view;
    const X = (x: number) => ((x - xMin) / (xMax - xMin)) * w;
    const Y = (y: number) => h - ((y - yMin) / (yMax - yMin)) * h;

    ctx.fillStyle = cBg;
    ctx.fillRect(0, 0, w, h);

    ctx.font = '12px system-ui, sans-serif';
    const xs = niceStep(xMax - xMin, Math.max(3, w / 90));
    const ys = niceStep(yMax - yMin, Math.max(3, h / 60));

    // Gitter
    ctx.lineWidth = 1;
    ctx.strokeStyle = cGrid;
    ctx.beginPath();
    for (let x = Math.ceil(xMin / xs) * xs; x <= xMax; x += xs) {
      const px = Math.round(X(x)) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
    }
    for (let y = Math.ceil(yMin / ys) * ys; y <= yMax; y += ys) {
      const py = Math.round(Y(y)) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
    }
    ctx.stroke();

    // Achsen
    ctx.strokeStyle = cAxis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (yMin <= 0 && yMax >= 0) {
      ctx.moveTo(0, Y(0));
      ctx.lineTo(w, Y(0));
    }
    if (xMin <= 0 && xMax >= 0) {
      ctx.moveTo(X(0), 0);
      ctx.lineTo(X(0), h);
    }
    ctx.stroke();

    // Beschriftung
    ctx.fillStyle = cText;
    const axisY = Math.min(Math.max(Y(0), 0), h);
    const axisX = Math.min(Math.max(X(0), 0), w);
    ctx.textAlign = 'center';
    ctx.textBaseline = axisY > h - 18 ? 'bottom' : 'top';
    for (let x = Math.ceil(xMin / xs) * xs; x <= xMax; x += xs) {
      if (Math.abs(x) < xs * 1e-9) continue;
      ctx.fillText(fmtTick(x, xs), X(x), axisY > h - 18 ? h - 4 : axisY + 4);
    }
    ctx.textAlign = axisX > w - 48 ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    for (let y = Math.ceil(yMin / ys) * ys; y <= yMax; y += ys) {
      if (Math.abs(y) < ys * 1e-9) continue;
      ctx.fillText(fmtTick(y, ys), axisX > w - 48 ? axisX - 6 : axisX + 6, Y(y));
    }

    // Kurve
    ctx.strokeStyle = cCurve;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false;
    for (let px = 0; px <= w; px++) {
      const x = xMin + (px / w) * (xMax - xMin);
      const y = f(x);
      if (!Number.isFinite(y) || Math.abs(Y(y)) > 1e7) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(px, Y(y));
      else {
        ctx.moveTo(px, Y(y));
        pen = true;
      }
    }
    ctx.stroke();

    // Nullstellen
    ctx.fillStyle = cRoot;
    ctx.strokeStyle = cBg;
    ctx.lineWidth = 2;
    for (const r of realRoots) {
      if (r < xMin || r > xMax) continue;
      ctx.beginPath();
      ctx.arc(X(r), Y(0), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Fadenkreuz
    if (hover && hover.x >= xMin && hover.x <= xMax && Number.isFinite(hover.y)) {
      ctx.strokeStyle = cAxis;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(X(hover.x), 0);
      ctx.lineTo(X(hover.x), h);
      ctx.stroke();
      ctx.setLineDash([]);
      if (hover.y >= yMin && hover.y <= yMax) {
        ctx.fillStyle = cCurve;
        ctx.beginPath();
        ctx.arc(X(hover.x), Y(hover.y), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [view, size, f, realRoots, hover, scheme]);

  const zoomCenter = (factor: number) => {
    const v = viewRef.current;
    zoomAt((v.xMin + v.xMax) / 2, (v.yMin + v.yMax) / 2, factor, factor);
  };

  const equalAxes = () => {
    const v = viewRef.current;
    const { w, h } = size;
    const cx = (v.xMin + v.xMax) / 2;
    const cy = (v.yMin + v.yMax) / 2;
    const unit = (v.xMax - v.xMin) / w; // Einheiten pro Pixel in x
    setView({ xMin: v.xMin, xMax: v.xMax, yMin: cy - (unit * h) / 2, yMax: cy + (unit * h) / 2 });
    void cx;
  };

  const num = (v: number) => String(Number(v.toPrecision(5))).replace('.', ',');

  return (
    <div className="plot-wrap" ref={wrapRef}>
      <div className="plot-toolbar">
        <button type="button" onClick={() => zoomCenter(0.7)} aria-label="Hineinzoomen">＋</button>
        <button type="button" onClick={() => zoomCenter(1 / 0.7)} aria-label="Herauszoomen">－</button>
        <button type="button" onClick={() => fit(realRoots, f)}>Ansicht anpassen</button>
        <button type="button" onClick={equalAxes}>Achsen 1:1</button>
        <span className="plot-readout" aria-live="off">
          {hover && Number.isFinite(hover.y) ? `x = ${num(hover.x)},  f(x) = ${num(hover.y)}` : 'Mit der Maus über den Plot fahren …'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="plot-canvas"
        role="img"
        aria-label="Plot des Polynoms"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
      />
      <p className="hint">
        Ziehen: verschieben · Mausrad / Pinch: zoomen · Shift + Mausrad: nur x-Achse · Alt + Mausrad: nur y-Achse
      </p>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Latex from '@/components/Latex';
import Plot from '@/components/Plot';
import CardanoFormulas from '@/components/CardanoFormulas';
import { parseCoeff, symbolicCubic } from '@/lib/expr';
import { equationTex, evalAll, linearFactorTex, realFactorTex, solveAll, symbolicFactorTex } from '@/lib/solve';
import { fmtPlain } from '@/lib/format';

type ParamState = { value: number; min: number; max: number };

const LABELS = ['a', 'b', 'c', 'd'] as const;
const POWERS = ['x^{3}', 'x^{2}', 'x', ''] as const;

const PRESETS: { label: string; tex: string; src: string[] }[] = [
  { label: 'Drei ganze Nullstellen', tex: 'x^3-6x^2+11x-6', src: ['1', '-6', '11', '-6'] },
  { label: 'Eine reelle Lösung', tex: 'x^3+x+1', src: ['1', '0', '1', '1'] },
  { label: 'Casus irreducibilis', tex: 'x^3-3x+1', src: ['1', '0', '-3', '1'] },
  { label: 'Mit Parametern t, s', tex: 'x^3+t\\,x^2-4x+s', src: ['1', 't', '-4', 's'] },
  { label: 'Mit Parameter t', tex: 'x^3-3t\\,x+1', src: ['1', '0', '-3*t', '1'] },
];

const SOURCES = [
  { label: 'Wikipedia: Kubische Gleichung', url: 'https://de.wikipedia.org/wiki/Kubische_Gleichung' },
  { label: 'Wikipedia: Cubic equation', url: 'https://en.wikipedia.org/wiki/Cubic_equation' },
];

export default function Page() {
  const [src, setSrc] = useState<string[]>(['1', '-6', '11', '-6']);
  const [pstate, setPstate] = useState<Record<string, ParamState>>({});

  const parsed = useMemo(() => src.map(parseCoeff), [src]);
  const errors = parsed.map((p) => p.error);
  const hasError = errors.some(Boolean);

  const paramNames = useMemo(
    () => [...new Set(parsed.flatMap((p) => p.params))].sort(),
    [parsed],
  );
  const params: Record<string, ParamState> = {};
  for (const n of paramNames) params[n] = pstate[n] ?? { value: 1, min: -5, max: 5 };
  const values = useMemo(
    () => Object.fromEntries(paramNames.map((n) => [n, params[n].value])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paramNames, pstate],
  );

  const nums = useMemo(() => (hasError ? [] : evalAll(parsed, values)), [hasError, parsed, values]);
  const numsOk = nums.length === 4 && nums.every(Number.isFinite);

  const solution = useMemo(() => (numsOk ? solveAll(parsed, nums) : null), [numsOk, parsed, nums]);

  const symbolic = useMemo(
    () =>
      solution && solution.status === 'ok' && solution.mode === 'numeric' && solution.degree === 3
        ? symbolicFactorTex(symbolicCubic(parsed))
        : null,
    [solution, parsed],
  );

  const realRoots = useMemo(
    () =>
      solution
        ? solution.roots.filter((r) => Math.abs(r.im) <= 1e-9 * (1 + Math.abs(r.re))).map((r) => r.re)
        : [],
    [solution],
  );

  const setParam = (name: string, patch: Partial<ParamState>) =>
    setPstate((prev) => ({ ...prev, [name]: { ...(prev[name] ?? params[name]), ...patch } }));

  const applyPreset = (s: string[]) => setSrc(s);

  const eqTex = !hasError && numsOk ? equationTex(parsed, nums) : null;
  const lfExact = solution ? linearFactorTex(solution) : '';
  const lfLong = lfExact.length > 260;
  const lfApprox = solution && solution.mode === 'exact' && lfLong ? linearFactorTex(solution, true) : '';
  const rfExact = solution ? realFactorTex(solution) : null;
  const rfShown =
    solution && rfExact ? (rfExact.length > 260 ? realFactorTex(solution, true) : rfExact) : null;
  const rfApprox = rfShown !== null && rfExact !== null && rfShown !== rfExact;

  return (
    <main className="page">
      <header className="hero">
        <h1>Kubische Gleichungen lösen</h1>
        <p>
          Analytische Lösung mit den Cardanischen Formeln – auch mit Parametern wie <Latex tex="t" /> oder{' '}
          <Latex tex="s" /> in den Koeffizienten.
        </p>
      </header>

      {/* 1. Eingabe */}
      <section className="card" aria-labelledby="h-input">
        <h2 id="h-input">1 · Eingabe</h2>
        <p className="muted">
          Koeffizienten von <Latex tex="a x^3+b x^2+c x+d=0" /> eingeben. Erlaubt sind Zahlen, Brüche (<code>1/3</code>),
          Parameter (<code>t</code>, <code>s</code>, …) und Funktionen wie <code>sqrt()</code>. Multiplikation bitte mit{' '}
          <code>*</code> schreiben (z. B. <code>2*t</code>).
        </p>

        <div className="coeff-grid">
          {LABELS.map((l, i) => (
            <label key={l} className={`coeff${errors[i] ? ' has-error' : ''}`}>
              <span className="coeff-label">
                <Latex tex={`${l}\\;(${POWERS[i] || '1'})`} />
              </span>
              <input
                type="text"
                value={src[i]}
                onChange={(e) => setSrc((s) => s.map((v, j) => (j === i ? e.target.value : v)))}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                aria-invalid={Boolean(errors[i])}
                aria-label={`Koeffizient ${l}`}
              />
              {errors[i] && <span className="error">{errors[i]}</span>}
            </label>
          ))}
        </div>

        <div className="preview">
          <span className="preview-label">Vorschau</span>
          {eqTex ? (
            <Latex display tex={eqTex} />
          ) : (
            <p className="muted">
              {hasError
                ? 'Bitte die markierten Eingaben korrigieren.'
                : 'Bei den aktuellen Parameterwerten ergibt ein Koeffizient keinen reellen Wert.'}
            </p>
          )}
        </div>

        <div className="presets">
          <span className="muted">Beispiele:</span>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="chip" onClick={() => applyPreset(p.src)} title={p.label}>
              <Latex tex={p.tex} />
            </button>
          ))}
        </div>
      </section>

      {solution && (
        <>
          {/* 2. Nullstellen */}
          <section className="card" aria-labelledby="h-roots">
            <h2 id="h-roots">2 · Nullstellen</h2>

            {paramNames.length > 0 && (
              <p className="muted">
                Werte für{' '}
                {paramNames.map((n, i) => (
                  <span key={n}>
                    {i > 0 && ', '}
                    <Latex tex={`${n}=${fmtPlain(params[n].value).replace(',', '{,}')}`} />
                  </span>
                ))}{' '}
                – die Regler stehen unter dem Plot.
              </p>
            )}

            {solution.status === 'identity' && <p className="notice">Alle Koeffizienten sind 0: Jede Zahl ist eine Lösung.</p>}
            {solution.status === 'none' && <p className="notice">Nur eine Konstante ≠ 0: Die Gleichung hat keine Lösung.</p>}

            {solution.status === 'ok' && (
              <>
                {solution.degree < 3 && (
                  <p className="notice">
                    Der Koeffizient von <Latex tex="x^3" /> ist 0 – die Gleichung ist hier{' '}
                    {solution.degree === 2 ? 'quadratisch' : 'linear'}.
                  </p>
                )}
                <ul className="roots">
                  {solution.roots.map((r, i) => {
                    const sym = solution.mode === 'exact' ? '=' : '\\approx';
                    const separate = r.tex !== r.approxTex && r.tex.length > 40;
                    const combined =
                      r.tex !== r.approxTex && !separate
                        ? `x_{${i + 1}}=${r.tex}\\approx ${r.approxTex}`
                        : `x_{${i + 1}}${sym}${r.tex}`;
                    return (
                      <li key={i}>
                        <Latex display tex={separate ? `x_{${i + 1}}=${r.tex}` : combined} />
                        {separate && <Latex display tex={`\\phantom{x_{${i + 1}}}\\approx ${r.approxTex}`} />}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <details className="way">
              <summary>Lösungsweg und Formeln anzeigen</summary>
              <CardanoFormulas />
              {solution.steps.map((s, i) => (
                <div key={i} className="step">
                  <h4>{s.title}</h4>
                  {s.lines.map((l, j) => (
                    <Latex key={j} display tex={l} />
                  ))}
                  {s.note && <p className="muted">{s.note}</p>}
                </div>
              ))}
              <p className="source">
                Quelle der Lösungsformeln:{' '}
                {SOURCES.map((s, i) => (
                  <span key={s.url}>
                    {i > 0 && ' · '}
                    <a href={s.url} target="_blank" rel="noreferrer noopener">
                      {s.label}
                    </a>
                  </span>
                ))}
              </p>
            </details>
          </section>

          {/* 3. Linearfaktordarstellung */}
          {solution.status === 'ok' && (
            <section className="card" aria-labelledby="h-lf">
              <h2 id="h-lf">3 · Linearfaktordarstellung</h2>
              <Latex
                display
                tex={String.raw`f(x)=${solution.leadTex === '1' ? '' : solution.leadTex + '\\,'}${solution.roots
                  .map((_, i) => `(x-x_{${i + 1}})`)
                  .join('')}`}
              />
              {symbolic && (
                <div className="symbolic">
                  <h3>Symbolisch, mit den Parametern</h3>
                  <p className="muted">
                    Ohne eingesetzte Parameterwerte (gültig für <Latex tex="a\neq 0" />), die Nullstellen nach den Cardanischen
                    Formeln:
                  </p>
                  <Latex display tex={symbolic.factor} />
                  {symbolic.defs.map((l, i) => (
                    <Latex key={i} display tex={l} />
                  ))}
                  <p className="muted">
                    <strong>Δ ≥ 0</strong>
                    {solution.delta !== undefined && solution.delta >= 0 ? ' (gilt aktuell)' : ''}:
                  </p>
                  {symbolic.caseDeltaGE0.map((l, i) => (
                    <Latex key={i} display tex={l} />
                  ))}
                  <p className="muted">
                    <strong>Δ &lt; 0</strong>
                    {solution.delta !== undefined && solution.delta < 0 ? ' (gilt aktuell)' : ''}:
                  </p>
                  {symbolic.caseDeltaLT0.map((l, i) => (
                    <Latex key={i} display tex={l} />
                  ))}
                  <h3>Für die aktuellen Parameterwerte</h3>
                </div>
              )}
              <Latex display tex={lfExact} />
              {lfApprox && (
                <>
                  <p className="muted">Die exakte Form ist sehr lang; hier mit gerundeten Nullstellen:</p>
                  <Latex display tex={lfApprox} />
                </>
              )}
              {rfShown && (
                <>
                  <p className="muted">
                    Über den reellen Zahlen{rfApprox ? ' (mit gerundeten Werten)' : ''} bleibt für das komplexe Paar ein
                    quadratischer Faktor:
                  </p>
                  <Latex display tex={rfShown} />
                </>
              )}
            </section>
          )}
        </>
      )}

      {/* 4. Plot */}
      {numsOk && (
        <section className="card" aria-labelledby="h-plot">
          <h2 id="h-plot">{solution?.status === 'ok' ? '4' : '3'} · Plot</h2>
          <Plot
            coeffs={nums as [number, number, number, number]}
            realRoots={realRoots}
            fitKey={src.join('\u0001')}
          />

          {paramNames.length > 0 && (
            <div className="sliders">
              <h3>Parameter</h3>
              {paramNames.map((n) => {
                const p = params[n];
                const step = (p.max - p.min) / 400 || 0.01;
                return (
                  <div key={n} className="slider-row">
                    <span className="slider-name">
                      <Latex tex={n} />
                    </span>
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={step}
                      value={Math.min(Math.max(p.value, p.min), p.max)}
                      onChange={(e) => setParam(n, { value: parseFloat(e.target.value) })}
                      aria-label={`Parameter ${n}`}
                    />
                    <label className="mini">
                      Wert
                      <input
                        type="number"
                        step="any"
                        value={Number(p.value.toFixed(6))}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v)) setParam(n, { value: v, min: Math.min(p.min, v), max: Math.max(p.max, v) });
                        }}
                      />
                    </label>
                    <label className="mini">
                      min
                      <input
                        type="number"
                        step="any"
                        value={p.min}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v) && v < p.max) setParam(n, { min: v, value: Math.max(p.value, v) });
                        }}
                      />
                    </label>
                    <label className="mini">
                      max
                      <input
                        type="number"
                        step="any"
                        value={p.max}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v) && v > p.min) setParam(n, { max: v, value: Math.min(p.value, v) });
                        }}
                      />
                    </label>
                  </div>
                );
              })}
              <p className="muted">
                Beim Bewegen der Regler aktualisieren sich Nullstellen, Linearfaktoren und Plot. Mit „Ansicht anpassen“ wird der
                Ausschnitt neu an die Kurve angepasst.
              </p>
            </div>
          )}
        </section>
      )}

      <footer className="footer">
        Lösungsformeln:{' '}
        {SOURCES.map((s, i) => (
          <span key={s.url}>
            {i > 0 && ' · '}
            <a href={s.url} target="_blank" rel="noreferrer noopener">
              {s.label}
            </a>
          </span>
        ))}
      </footer>
    </main>
  );
}

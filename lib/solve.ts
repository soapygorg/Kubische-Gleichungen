// Orchestrierung: exakt (rationale Koeffizienten) oder numerisch ausgewertete Cardano-Formeln (Parameter)
import { evalCoeff, symbolicPQ, type ParsedCoeff, type SymbolicCubic } from './expr';
import { exactSolve, type Root, type Step } from './exact';
import { solveNumeric } from './numeric';
import { complexTex, factorOf, fmtNum, fracTex, toRational, type Rat } from './format';

export type Solution = {
  status: 'ok' | 'identity' | 'none';
  mode: 'exact' | 'numeric';
  degree: number;
  /** Leitkoeffizient als LaTeX */
  leadTex: string;
  leadValue: number;
  roots: Root[];
  steps: Step[];
  note?: string;
  /** Diskriminante Δ (nur numerischer Modus, Grad 3) */
  delta?: number;
};

function sameRoot(a: Root, b: Root): boolean {
  const tol = 1e-8 * (1 + Math.abs(a.re) + Math.abs(a.im));
  return Math.abs(a.re - b.re) < tol && Math.abs(a.im - b.im) < tol;
}

/** Wertet alle Koeffizienten aus; liefert Zahlen oder NaN. */
export function evalAll(parsed: ParsedCoeff[], values: Record<string, number>): number[] {
  return parsed.map((p) => evalCoeff(p, values));
}

export function solveAll(parsed: ParsedCoeff[], nums: number[]): Solution {
  const [a, b, c, d] = nums;

  // exakter Weg: alle Koeffizienten parameterfrei und rational
  const allConst = parsed.every((p) => p.params.length === 0);
  if (allConst) {
    const rats = nums.map(toRational);
    if (rats.every((r): r is Rat => r !== null)) {
      const res = exactSolve(rats as Rat[]);
      if (res) {
        return {
          status: 'ok',
          mode: 'exact',
          degree: res.degree,
          leadTex: fracTex(res.lead),
          leadValue: Number(res.lead[0]) / Number(res.lead[1]),
          roots: res.roots,
          steps: res.steps,
        };
      }
    }
  }

  // numerischer Weg (Parameter oder irrationale Konstanten)
  const num = solveNumeric(a, b, c, d);
  if (num.degree === -1) {
    return { status: 'identity', mode: 'numeric', degree: -1, leadTex: '0', leadValue: 0, roots: [], steps: [] };
  }
  if (num.degree === 0) {
    return { status: 'none', mode: 'numeric', degree: 0, leadTex: fmtNum(num.lead), leadValue: num.lead, roots: [], steps: [] };
  }

  const roots: Root[] = num.roots.map((r) => {
    const t = complexTex(r.re, r.im);
    return { tex: t, approxTex: t, re: r.re, im: r.im, factor: factorOf(t) };
  });

  const steps: Step[] = [];
  if (num.degree === 3) {
    const { p, q } = symbolicPQ(parsed);
    steps.push({
      title: 'Reduzierte Form mit deinen Koeffizienten',
      lines: [String.raw`p=${p}`, String.raw`q=${q}`],
      note: 'Gilt für a ≠ 0. Die Wurzeln werden mit diesen p und q und den Cardanischen Formeln ausgewertet.',
    });
    steps.push({
      title: 'Werte bei den aktuellen Parameterwerten',
      lines: [
        String.raw`p\approx ${fmtNum(num.p!)},\qquad q\approx ${fmtNum(num.q!)},\qquad \Delta\approx ${fmtNum(num.delta!)}`,
      ],
      note:
        num.delta! > 0
          ? 'Δ > 0: eine reelle und zwei komplex konjugierte Lösungen.'
          : num.delta! === 0
            ? 'Δ = 0: mehrfache reelle Lösung.'
            : 'Δ < 0: drei reelle Lösungen (trigonometrische Lösung).',
    });
  } else if (num.degree === 2) {
    steps.push({
      title: 'Quadratische Gleichung',
      lines: [String.raw`x_{1,2}=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`],
      note: 'Bei diesen Parameterwerten verschwindet der Koeffizient von x³, die Gleichung ist nur quadratisch.',
    });
  } else {
    steps.push({ title: 'Lineare Gleichung', lines: [String.raw`x=-\frac{d}{c}`] });
  }

  return {
    status: 'ok',
    mode: 'numeric',
    degree: num.degree,
    leadTex: fmtNum(num.lead),
    leadValue: num.lead,
    roots,
    steps,
    delta: num.degree === 3 ? num.delta : undefined,
  };
}

const factorFor = (r: Root, approx: boolean): string => (approx ? factorOf(r.approxTex) : r.factor);
const leadFor = (sol: Solution): string =>
  sol.leadTex === '1' ? '' : sol.leadTex === '-1' ? '-' : `${sol.leadTex}\\,`;

/** Linearfaktordarstellung: f(x) = a (x - x1)^k ... ; approx = Nullstellen als Dezimalzahlen */
export function linearFactorTex(sol: Solution, approx = false): string {
  if (sol.status !== 'ok') return '';
  const groups: { root: Root; n: number }[] = [];
  for (const r of sol.roots) {
    const g = groups[groups.length - 1];
    if (g && sameRoot(g.root, r)) g.n++;
    else groups.push({ root: r, n: 1 });
  }
  const parts = groups.map((g) => {
    const f = `\\left(${factorFor(g.root, approx)}\\right)`;
    return g.n > 1 ? `${f}^{${g.n}}` : f;
  });
  return `f(x)${approx ? '\\approx' : '='}${leadFor(sol)}${parts.join('')}`;
}

/** Reelle Zerlegung (quadratische Faktoren statt komplexer Linearfaktoren), nur wenn komplexe Wurzeln existieren. */
export function realFactorTex(sol: Solution, approx = false): string | null {
  if (sol.status !== 'ok') return null;
  const tol = (r: Root) => 1e-9 * (1 + Math.abs(r.re));
  const cplx = sol.roots.filter((r) => r.im > tol(r));
  if (cplx.length === 0) return null;
  const real = sol.roots.filter((r) => Math.abs(r.im) <= tol(r));
  const lead = leadFor(sol);
  const parts: string[] = [];
  let i = 0;
  while (i < real.length) {
    let n = 1;
    while (i + n < real.length && sameRoot(real[i], real[i + n])) n++;
    const f = `\\left(${factorFor(real[i], approx)}\\right)`;
    parts.push(n > 1 ? `${f}^{${n}}` : f);
    i += n;
  }
  for (const r of cplx) {
    const beta = -2 * r.re;
    const gamma = r.re * r.re + r.im * r.im;
    const bTerm =
      Math.abs(beta) < 1e-12 ? '' : `${beta < 0 ? '-' : '+'}${Math.abs(beta) === 1 ? '' : fmtNum(Math.abs(beta))}x`;
    const gTerm = `${gamma < 0 ? '-' : '+'}${fmtNum(Math.abs(gamma))}`;
    parts.push(`\\left(x^2${bTerm}${gTerm}\\right)`);
  }
  return `f(x)${approx ? '\\approx' : '='}${lead}${parts.join('')}`;
}

/** Gleichung in LaTeX, mit eingesetzten Koeffizienten (Konstanten schön, Ausdrücke in Klammern). */
export function equationTex(parsed: ParsedCoeff[], nums: number[]): string {
  const powers = ['x^{3}', 'x^{2}', 'x', ''];
  let out = '';
  parsed.forEach((p, i) => {
    const isConst = p.params.length === 0;
    const val = nums[i];
    let term: string;
    let sign: '+' | '-' = '+';
    if (isConst && Number.isFinite(val)) {
      if (val === 0) return;
      const r = toRational(val);
      sign = val < 0 ? '-' : '+';
      const abs = Math.abs(val);
      if (r) {
        const t = fracTex([r[0] < 0n ? -r[0] : r[0], r[1]]);
        term = abs === 1 && powers[i] ? powers[i] : `${t}${powers[i]}`;
      } else {
        term = `\\left(${p.tex}\\right)${powers[i]}`;
        sign = '+';
      }
    } else {
      term = `\\left(${p.tex || '?'}\\right)${powers[i]}`;
    }
    if (out === '') out = sign === '-' ? `-${term}` : term;
    else out += ` ${sign} ${term}`;
  });
  return `${out || '0'}=0`;
}

/** Linearfaktordarstellung mit unausgewerteten Parametern (Cardano-Formeln in p, q, Δ). */
export function symbolicFactorTex(sym: SymbolicCubic): {
  factor: string;
  defs: string[];
  caseDeltaGE0: string[];
  caseDeltaLT0: string[];
} {
  const lead = sym.lead === '1' ? '' : `\\left(${sym.lead}\\right)\\,`;
  const S = sym.shift.trim() === '0' ? '' : `-\\left(${sym.shift}\\right)`;
  return {
    factor: `f(x)=${lead}(x-x_1)(x-x_2)(x-x_3)`,
    defs: [
      `p=${sym.p}`,
      `q=${sym.q}`,
      `\\Delta=\\left(\\frac{q}{2}\\right)^2+\\left(\\frac{p}{3}\\right)^3=${sym.delta}`,
    ],
    caseDeltaGE0: [
      `u=\\sqrt[3]{-\\frac{q}{2}+\\sqrt{\\Delta}},\\qquad v=\\sqrt[3]{-\\frac{q}{2}-\\sqrt{\\Delta}}`,
      `x_1=u+v${S}`,
      `x_{2,3}=-\\frac{u+v}{2}${S}\\pm\\frac{\\sqrt{3}}{2}\\,(u-v)\\,i`,
    ],
    caseDeltaLT0: [
      `x_{k+1}=2\\sqrt{-\\frac{p}{3}}\\,\\cos\\!\\left(\\frac{1}{3}\\arccos\\!\\left(\\frac{3q}{2p}\\sqrt{-\\frac{3}{p}}\\right)-\\frac{2\\pi k}{3}\\right)${S},\\quad k=0,1,2`,
    ],
  };
}

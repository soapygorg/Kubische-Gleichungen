// Exakte Lösung für rationale Koeffizienten (Brüche als BigInt)
import {
  absB,
  complexTex,
  fracTex,
  factorOf,
  gcdB,
  lcmB,
  rat,
  radd,
  rmul,
  rneg,
  rinv,
  rnum,
  rsign,
  R,
  type Rat,
} from './format';
import { depressedRoots, sortRoots } from './numeric';

export type Root = {
  /** exakter Ausdruck (LaTeX) bzw. Zahl */
  tex: string;
  /** Näherung (LaTeX) */
  approxTex: string;
  re: number;
  im: number;
  /** LaTeX des Linearfaktors (x - x_k) ohne Klammern */
  factor: string;
};

export type Step = { title: string; lines: string[]; note?: string };

export type ExactResult = {
  degree: number;
  lead: Rat;
  roots: Root[];
  steps: Step[];
  delta?: Rat;
  p?: Rat;
  q?: Rat;
};

function mkRoot(tex: string, re: number, im: number): Root {
  return { tex, approxTex: complexTex(re, im), re, im, factor: factorOf(tex) };
}

function divisors(n: bigint): bigint[] {
  const N = Number(n);
  const out: bigint[] = [];
  for (let i = 1; i * i <= N; i++) {
    if (N % i === 0) {
      out.push(BigInt(i));
      if (i * i !== N) out.push(BigInt(N / i));
    }
  }
  return out;
}

/** Zerlegung n = s^2 * m (m möglichst quadratfrei), n > 0 */
function squareFree(n: bigint): { s: bigint; m: bigint } {
  let s = 1n;
  let m = n;
  for (let i = 2n; i * i <= m && i <= 100000n; i++) {
    const i2 = i * i;
    while (m % i2 === 0n) {
      s *= i;
      m /= i2;
    }
  }
  if (m < 2n ** 52n) {
    const r = BigInt(Math.round(Math.sqrt(Number(m))));
    if (r * r === m) {
      s *= r;
      m = 1n;
    }
  }
  return { s, m };
}

/** Exakte Lösungen von A x² + B x + C = 0 (A ≠ 0) */
export function quadExact(A: bigint, B: bigint, C: bigint): Root[] {
  const D = B * B - 4n * A * C;
  const twoA = 2n * A;
  const realPart = Number(-B) / Number(twoA);

  if (D === 0n) {
    const t = fracTex(rat(-B, twoA));
    return [mkRoot(t, realPart, 0), mkRoot(t, realPart, 0)];
  }
  const neg = D < 0n;
  const { s, m } = squareFree(neg ? -D : D);

  if (!neg && m === 1n) {
    const r1 = rat(-B + s, twoA);
    const r2 = rat(-B - s, twoA);
    return [mkRoot(fracTex(r1), rnum(r1), 0), mkRoot(fracTex(r2), rnum(r2), 0)];
  }

  const g = gcdB(gcdB(B, s), twoA) || 1n;
  let Bn = -B / g;
  const sn = s / g;
  let den = twoA / g;
  if (den < 0n) {
    den = -den;
    Bn = -Bn;
  }
  const rad =
    m === 1n
      ? `${sn === 1n ? '' : sn.toString()}${neg ? 'i' : ''}`
      : `${sn === 1n ? '' : sn.toString()}\\sqrt{${m}}${neg ? '\\,i' : ''}`;

  const build = (sign: '+' | '-'): string => {
    if (Bn === 0n) {
      const body = den === 1n ? rad : `\\frac{${rad}}{${den}}`;
      return sign === '+' ? body : `-${body}`;
    }
    const num = `${Bn}${sign}${rad}`;
    return den === 1n ? num : `\\frac{${num}}{${den}}`;
  };

  const dd = (Number(sn) * Math.sqrt(Number(m))) / Number(den);
  return [
    mkRoot(build('+'), neg ? realPart : realPart + dd, neg ? dd : 0),
    mkRoot(build('-'), neg ? realPart : realPart - dd, neg ? -dd : 0),
  ];
}

function findRationalRoot(A: bigint, B: bigint, C: bigint, D: bigint): Rat | null {
  if (D === 0n) return [0n, 1n];
  for (const q of divisors(absB(A))) {
    for (const p0 of divisors(absB(D))) {
      for (const p of [p0, -p0]) {
        if (gcdB(p, q) !== 1n) continue;
        const v = A * p ** 3n + B * p * p * q + C * p * q * q + D * q ** 3n;
        if (v === 0n) return [p, q];
      }
    }
  }
  return null;
}

const shiftTex = (s: Rat): string => {
  // x = z - s, also  "- s" bzw. "+ |s|"
  const sg = rsign(s);
  if (sg === 0) return '';
  return sg > 0 ? `-${fracTex(s)}` : `+${fracTex(rneg(s))}`;
};

/** Wurzel aus einem positiven Bruch: vereinfacht, rational wenn möglich. */
function sqrtRat(r: Rat): { rational: Rat | null; tex: string; value: number } {
  const [n, d] = r;
  const { s, m } = squareFree(n * d);
  const value = Math.sqrt(Number(n) / Number(d));
  if (m === 1n) {
    const q = rat(s, d);
    return { rational: q, tex: fracTex(q), value };
  }
  const q = rat(s, d);
  const coef = q[0] === 1n && q[1] === 1n ? '' : q[1] === 1n ? q[0].toString() : '';
  const tex =
    q[1] === 1n
      ? `${coef}\\sqrt{${m}}`
      : `\\frac{${q[0] === 1n ? '' : q[0]}\\sqrt{${m}}}{${q[1]}}`;
  return { rational: null, tex, value };
}

function sortExact(roots: Root[]): Root[] {
  return sortRoots(roots);
}

export function exactSolve(coeffs: Rat[]): ExactResult | null {
  // auf ganze Zahlen skalieren
  const L = coeffs.reduce((l, x) => lcmB(l, x[1]), 1n);
  let ints = coeffs.map((x) => x[0] * (L / x[1]));
  const g = ints.reduce((acc, x) => gcdB(acc, x), 0n);
  if (g === 0n) return null;
  ints = ints.map((x) => x / g);
  if (ints.some((x) => absB(x) > 1_000_000n)) return null;
  const [A, B, C, D] = ints;
  const steps: Step[] = [];

  if (A === 0n) {
    if (B !== 0n) {
      steps.push({
        title: 'Quadratische Gleichung (a = 0)',
        lines: [
          String.raw`x_{1,2}=\frac{-b\pm\sqrt{b^2-4ac}}{2a}\quad\text{mit}\quad a=${B},\;b=${C},\;c=${D}`,
        ],
        note: 'Da der Koeffizient von x³ gleich 0 ist, ist die Gleichung nur quadratisch.',
      });
      return { degree: 2, lead: rat(coeffs[1][0], coeffs[1][1]), roots: sortExact(quadExact(B, C, D)), steps };
    }
    if (C !== 0n) {
      const r = rat(-D, C);
      steps.push({
        title: 'Lineare Gleichung',
        lines: [String.raw`${C}\,x+${D}=0\;\Rightarrow\;x=${fracTex(r)}`],
      });
      return {
        degree: 1,
        lead: rat(coeffs[2][0], coeffs[2][1]),
        roots: [mkRoot(fracTex(r), rnum(r), 0)],
        steps,
      };
    }
    return null;
  }

  const lead = rat(coeffs[0][0], coeffs[0][1]);

  // p, q, Δ exakt
  const p = rat(3n * A * C - B * B, 3n * A * A);
  const q = rat(2n * B ** 3n - 9n * A * B * C + 27n * A * A * D, 27n * A ** 3n);
  const shift = rat(B, 3n * A);
  const qh = rmul(q, rat(1n, 2n));
  const p3 = rmul(p, rat(1n, 3n));
  const delta = radd(rmul(qh, qh), rmul(rmul(p3, p3), p3));
  const ds = rsign(delta);

  steps.push({
    title: 'Reduzierte Form',
    lines: [
      String.raw`p=${fracTex(p)},\qquad q=${fracTex(q)},\qquad x=z${shiftTex(shift) || ''}`,
      String.raw`\Delta=\left(\frac{q}{2}\right)^2+\left(\frac{p}{3}\right)^3=${fracTex(delta)}`,
    ],
    note:
      ds > 0
        ? 'Δ > 0: eine reelle und zwei komplex konjugierte Lösungen.'
        : ds === 0
          ? 'Δ = 0: mehrfache reelle Lösung.'
          : 'Δ < 0: drei verschiedene reelle Lösungen (casus irreducibilis, trigonometrische Lösung).',
  });

  // 1) rationale Nullstelle?
  const rr = findRationalRoot(A, B, C, D);
  if (rr) {
    const [pn, qn] = rr;
    const A2 = A / qn;
    const B2 = (B + pn * A2) / qn;
    const C2 = (C + pn * B2) / qn;
    const r0 = rat(pn, qn);
    const first = mkRoot(fracTex(r0), rnum(r0), 0);
    steps.push({
      title: 'Rationale Nullstelle und Abspalten des Linearfaktors',
      lines: [
        String.raw`x_0=${fracTex(r0)}`,
        String.raw`${A}x^3+${B}x^2+${C}x+${D}=\left(${qn === 1n ? '' : qn}x${pn < 0n ? '+' : '-'}${absB(pn)}\right)\left(${A2}x^2+${B2}x+${C2}\right)`,
      ],
      note: 'Die rationale Nullstelle wurde mit dem Satz über rationale Nullstellen gefunden. Die verbleibenden Nullstellen folgen aus der quadratischen Gleichung – das ist die vereinfachte Form der Cardanischen Lösung.',
    });
    const quad = quadExact(A2, B2, C2);
    steps.push({
      title: 'Restliche Nullstellen (Mitternachtsformel)',
      lines: [String.raw`x_{2,3}=\frac{-${B2 < 0n ? `(${B2})` : B2}\pm\sqrt{${B2 < 0n ? `(${B2})` : B2}^2-4\cdot ${A2 < 0n ? `(${A2})` : A2}\cdot ${C2 < 0n ? `(${C2})` : C2}}}{2\cdot ${A2 < 0n ? `(${A2})` : A2}}`],
    });
    return {
      degree: 3,
      lead,
      roots: sortExact([first, ...quad]),
      steps,
      delta,
      p,
      q,
    };
  }

  // 2) keine rationale Nullstelle -> Cardano exakt
  const pf = rnum(p);
  const qf = rnum(q);
  const sf = rnum(shift);
  const num = depressedRoots(pf, qf).z;
  const sh = shiftTex(shift);

  if (ds > 0) {
    const mq = rneg(qh);
    const sq = sqrtRat(delta).tex;
    const mqT = rsign(mq) === 0 ? '' : fracTex(mq);
    const U = String.raw`\sqrt[3]{${mqT}+${sq}}`;
    const V = String.raw`\sqrt[3]{${mqT}-${sq}}`;
    const U2 = mqT === '' ? String.raw`\sqrt[3]{${sq}}` : U;
    const V2 = mqT === '' ? String.raw`\sqrt[3]{-${sq}}` : V;
    steps.push({
      title: 'Cardanische Formel',
      lines: [String.raw`u=${U2},\qquad v=${V2}`, String.raw`x_1=u+v${sh},\qquad x_{2,3}=-\frac{u+v}{2}${sh}\pm\frac{\sqrt{3}}{2}\,(u-v)\,i`],
    });
    const x1 = String.raw`${U2}+${V2}${sh}`;
    const x2 = String.raw`-\frac{${U2}+${V2}}{2}${sh}+\frac{\sqrt{3}}{2}\left(${U2}-${V2}\right)i`;
    const x3 = String.raw`-\frac{${U2}+${V2}}{2}${sh}-\frac{\sqrt{3}}{2}\left(${U2}-${V2}\right)i`;
    const roots = [
      mkRoot(x1, num[0].re - sf, 0),
      mkRoot(x2, num[1].re - sf, num[1].im),
      mkRoot(x3, num[2].re - sf, num[2].im),
    ];
    return { degree: 3, lead, roots, steps, delta, p, q };
  }

  // Δ < 0: trigonometrische Lösung
  const argR = rmul(rmul(R(3), q), rinv(rmul(R(2), p)));
  const radR = rneg(rmul(R(3), rinv(p)));
  const sp = sqrtRat(rneg(p3));
  const sr = sqrtRat(radR);
  const pre = sp.rational ? fracTex(rmul(R(2), sp.rational)) : String.raw`2${sp.tex.startsWith('\\frac') ? '' : ''}${sp.tex.startsWith('\\frac') ? `\\left(${sp.tex}\\right)` : sp.tex}`;
  const arccosArg = sr.rational
    ? fracTex(rmul(argR, sr.rational))
    : String.raw`${fracTex(argR)}\cdot${sr.tex.startsWith('\\frac') ? `\\left(${sr.tex}\\right)` : sr.tex}`;
  const inner = String.raw`\frac{1}{3}\arccos\left(${arccosArg}\right)`;
  steps.push({
    title: 'Trigonometrische Lösung',
    lines: [
      String.raw`z_k=2\sqrt{-\frac{p}{3}}\cos\left(\frac{1}{3}\arccos\left(\frac{3q}{2p}\sqrt{-\frac{3}{p}}\right)-\frac{2\pi k}{3}\right),\quad k=0,1,2`,
      String.raw`x_k=z_k${sh}`,
    ],
  });
  const roots = [0, 1, 2].map((k) => {
    const ang = k === 0 ? '' : String.raw`-\frac{${2 * k}\pi}{3}`;
    const tex = String.raw`${pre}\cos\left(${inner}${ang}\right)${sh}`;
    return mkRoot(tex, num[k].re - sf, 0);
  });
  return { degree: 3, lead, roots: sortExact(roots), steps, delta, p, q };
}

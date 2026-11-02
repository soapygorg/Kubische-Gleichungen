// Numerische Auswertung der analytischen Lösungsformeln (Cardano / trigonometrische Lösung)

export type C = { re: number; im: number };

/** Lösungen von z^3 + p z + q = 0 nach den Cardanischen Formeln (Reihenfolge wie in den Formeln). */
export function depressedRoots(p: number, q: number): { delta: number; z: C[] } {
  let delta = (q / 2) ** 2 + (p / 3) ** 3;
  const scale = Math.max((q / 2) ** 2, Math.abs((p / 3) ** 3));
  if (Math.abs(delta) <= 1e-13 * scale) delta = 0;

  if (delta >= 0) {
    const sd = Math.sqrt(delta);
    // numerisch stabil: den betragsgrößeren Radikanden zuerst, den anderen über u*v = -p/3
    const u = Math.cbrt(q >= 0 ? -q / 2 - sd : -q / 2 + sd);
    const v = u !== 0 ? -p / (3 * u) : 0;
    const im = (Math.sqrt(3) / 2) * Math.abs(u - v);
    const re = -(u + v) / 2;
    return {
      delta,
      z: [
        { re: u + v, im: 0 },
        { re, im },
        { re, im: -im },
      ],
    };
  }
  // delta < 0  =>  p < 0, drei reelle Lösungen (trigonometrische Lösung)
  const r = 2 * Math.sqrt(-p / 3);
  const arg = Math.max(-1, Math.min(1, ((3 * q) / (2 * p)) * Math.sqrt(-3 / p)));
  const phi = Math.acos(arg) / 3;
  const z: C[] = [0, 1, 2].map((k) => ({ re: r * Math.cos(phi - (2 * Math.PI * k) / 3), im: 0 }));
  return { delta, z };
}

export function sortRoots<T extends C>(roots: T[]): T[] {
  const tol = (r: T) => 1e-9 * (1 + Math.abs(r.re));
  const real = roots.filter((r) => Math.abs(r.im) <= tol(r)).sort((x, y) => x.re - y.re);
  const cplx = roots.filter((r) => Math.abs(r.im) > tol(r)).sort((x, y) => y.im - x.im);
  return [...real, ...cplx];
}

export type NumericResult = {
  /** Grad nach Wegfall (numerisch) verschwindender Leitkoeffizienten, -1 = Nullpolynom, 0 = konstant ≠ 0 */
  degree: number;
  lead: number;
  roots: C[];
  p?: number;
  q?: number;
  delta?: number;
};

export function solveNumeric(a: number, b: number, c: number, d: number): NumericResult {
  const m = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d));
  if (m === 0) return { degree: -1, lead: 0, roots: [] };
  const eps = 1e-14 * m;

  if (Math.abs(a) > eps) {
    const p = (3 * a * c - b * b) / (3 * a * a);
    const q = (2 * b ** 3 - 9 * a * b * c + 27 * a * a * d) / (27 * a ** 3);
    const { delta, z } = depressedRoots(p, q);
    const shift = b / (3 * a);
    return {
      degree: 3,
      lead: a,
      roots: sortRoots(z.map((r) => ({ re: r.re - shift, im: r.im }))),
      p,
      q,
      delta,
    };
  }
  if (Math.abs(b) > eps) {
    return { degree: 2, lead: b, roots: sortRoots(solveQuadratic(b, c, d)) };
  }
  if (Math.abs(c) > eps) {
    return { degree: 1, lead: c, roots: [{ re: -d / c, im: 0 }] };
  }
  return { degree: 0, lead: d, roots: [] };
}

export function solveQuadratic(a: number, b: number, c: number): C[] {
  const disc = b * b - 4 * a * c;
  if (disc >= 0) {
    const sq = Math.sqrt(disc);
    const qq = -(b + (b >= 0 ? 1 : -1) * sq) / 2;
    if (qq === 0) return [{ re: 0, im: 0 }, { re: 0, im: 0 }];
    return [
      { re: qq / a, im: 0 },
      { re: c / qq, im: 0 },
    ];
  }
  const re = -b / (2 * a);
  const im = Math.sqrt(-disc) / (2 * Math.abs(a));
  return [
    { re, im },
    { re, im: -im },
  ];
}

export function polyEval(coeffs: number[], x: number): number {
  return coeffs.reduce((acc, c) => acc * x + c, 0);
}

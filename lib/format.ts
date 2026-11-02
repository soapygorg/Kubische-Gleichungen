// Hilfsfunktionen: Brüche (BigInt), Zahlenformatierung für LaTeX

export type Rat = [bigint, bigint];

export const absB = (x: bigint): bigint => (x < 0n ? -x : x);

export function gcdB(a: bigint, b: bigint): bigint {
  a = absB(a);
  b = absB(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function lcmB(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return absB(a * b) / gcdB(a, b);
}

export function rat(n: bigint, d: bigint = 1n): Rat {
  if (d === 0n) throw new Error('Division durch 0');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcdB(n, d) || 1n;
  return [n / g, d / g];
}

export const radd = (x: Rat, y: Rat): Rat => rat(x[0] * y[1] + y[0] * x[1], x[1] * y[1]);
export const rmul = (x: Rat, y: Rat): Rat => rat(x[0] * y[0], x[1] * y[1]);
export const rneg = (x: Rat): Rat => rat(-x[0], x[1]);
export const rinv = (x: Rat): Rat => rat(x[1], x[0]);
export const rnum = (x: Rat): number => Number(x[0]) / Number(x[1]);
export const rsign = (x: Rat): number => (x[0] > 0n ? 1 : x[0] < 0n ? -1 : 0);
export const R = (n: number | bigint): Rat => rat(BigInt(n), 1n);

/** Zahl in einen Bruch umwandeln (falls sie hinreichend genau rational ist). */
export function toRational(v: number): Rat | null {
  if (!Number.isFinite(v)) return null;
  if (Number.isInteger(v)) return Math.abs(v) <= 1e15 ? [BigInt(v), 1n] : null;
  for (let d = 2; d <= 10000; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v - n / d) < 1e-12 * Math.max(1, Math.abs(v))) return rat(BigInt(n), BigInt(d));
  }
  return null;
}

/** LaTeX eines Bruchs, z. B. -\frac{1}{2} oder 3 */
export function fracTex(r: Rat): string {
  const [n, d] = r;
  if (d === 1n) return n.toString();
  return `${n < 0n ? '-' : ''}\\frac{${absB(n)}}{${d}}`;
}

/** Dezimalzahl in LaTeX (deutsches Komma, 6 signifikante Stellen) */
export function fmtNum(x: number, sig = 6): string {
  if (!Number.isFinite(x)) return '\\text{nicht definiert}';
  if (x === 0 || Math.abs(x) < 1e-14) return '0';
  const s = String(Number(x.toPrecision(sig)));
  if (s.includes('e')) {
    const [m, e] = s.split('e');
    return `${m.replace('.', '{,}')}\\cdot 10^{${parseInt(e, 10)}}`;
  }
  return s.replace('.', '{,}');
}

/** Dezimalzahl als normaler Text (deutsches Komma) */
export function fmtPlain(x: number, sig = 6): string {
  if (!Number.isFinite(x)) return 'n. d.';
  if (x === 0 || Math.abs(x) < 1e-14) return '0';
  return String(Number(x.toPrecision(sig))).replace('.', ',');
}

/** Komplexe Zahl in LaTeX */
export function complexTex(re: number, im: number): string {
  const imZero = Math.abs(im) < 1e-12 * (1 + Math.abs(re));
  if (imZero) return fmtNum(re);
  const reZero = Math.abs(re) < 1e-12 * (1 + Math.abs(im));
  const imAbs = fmtNum(Math.abs(im));
  const imPart = `${imAbs === '1' ? '' : imAbs}\\,i`;
  if (reZero) return `${im < 0 ? '-' : ''}${imPart}`;
  return `${fmtNum(re)} ${im < 0 ? '-' : '+'} ${imPart}`;
}

/**
 * LaTeX-Faktor (x - Nullstelle) für eine Nullstelle in LaTeX-Schreibweise.
 * Berücksichtigt negative Zahlen und Summen auf oberster Ebene.
 */
export function factorOf(tex: string): string {
  let depth = 0;
  let top = '';
  for (const ch of tex) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (depth === 0) top += ch;
  }
  if (tex === '0') return 'x';
  const neg = top.startsWith('-');
  const rest = neg ? top.slice(1) : top;
  const isSum = /[+\-]/.test(rest);
  if (neg && !isSum) return `x+${tex.slice(1)}`;
  if (isSum) return `x-\\left(${tex}\\right)`;
  return `x-${tex}`;
}

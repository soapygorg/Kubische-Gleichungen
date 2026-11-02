// Parser für Koeffizienten-Ausdrücke mit Parametern (z. B. "2*t", "s^2-1", "sqrt(3)/2")
import {
  create,
  parseDependencies,
  addDependencies,
  subtractDependencies,
  multiplyDependencies,
  divideDependencies,
  powDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  sqrtDependencies,
  cbrtDependencies,
  absDependencies,
  sinDependencies,
  cosDependencies,
  tanDependencies,
  expDependencies,
  logDependencies,
  piDependencies,
  eDependencies,
  simplifyDependencies,
  type MathNode,
  type EvalFunction,
} from 'mathjs';

const math = create(
  {
    parseDependencies,
    addDependencies,
    subtractDependencies,
    multiplyDependencies,
    divideDependencies,
    powDependencies,
    unaryMinusDependencies,
    unaryPlusDependencies,
    sqrtDependencies,
    cbrtDependencies,
    absDependencies,
    sinDependencies,
    cosDependencies,
    tanDependencies,
    expDependencies,
    logDependencies,
    piDependencies,
    eDependencies,
    simplifyDependencies,
  },
  {},
);

const CONSTANTS = new Set(['pi', 'e']);
const FUNCS = new Set(['sqrt', 'cbrt', 'abs', 'sin', 'cos', 'tan', 'exp', 'log']);

export type ParsedCoeff = {
  src: string;
  tex: string;
  params: string[];
  error?: string;
  fn?: EvalFunction;
  node?: MathNode;
  /** Quelltext, bereinigt (Dezimalkomma -> Punkt) */
  clean: string;
};

export function parseCoeff(src: string): ParsedCoeff {
  let clean = src.trim() === '' ? '0' : src.trim();
  // Dezimalkomma erlauben, solange keine Funktionsaufrufe mit Argumenttrennern vorliegen
  if (!/[a-zA-Z]\(/.test(clean)) clean = clean.replace(/(\d),(\d)/g, '$1.$2');
  try {
    const node = math.parse(clean);
    const params = new Set<string>();
    let bad: string | undefined;
    node.traverse((n: MathNode, path: string, parent: MathNode | null) => {
      const any = n as any;
      switch (n.type) {
        case 'ConstantNode':
          if (typeof any.value !== 'number') bad = 'Nur Zahlen sind erlaubt.';
          break;
        case 'SymbolNode': {
          const isFnName = parent && (parent as any).type === 'FunctionNode' && path === 'fn';
          if (isFnName) {
            if (!FUNCS.has(any.name)) bad = `Funktion „${any.name}“ ist nicht erlaubt.`;
          } else if (!CONSTANTS.has(any.name)) {
            params.add(any.name);
          }
          break;
        }
        case 'OperatorNode':
        case 'ParenthesisNode':
        case 'FunctionNode':
          break;
        default:
          bad = 'Dieser Ausdruck ist nicht erlaubt.';
      }
    });
    if (!bad && params.has('x')) bad = 'Die Variable x ist die Unbekannte und kann hier nicht verwendet werden.';
    if (bad) return { src, clean, tex: '', params: [], error: bad };
    const tex = cleanTex(node.toTex({ parenthesis: 'keep', implicit: 'hide' }));
    return { src, clean, tex, params: [...params].sort(), fn: node.compile(), node };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { src, clean, tex: '', params: [], error: 'Ungültiger Ausdruck: ' + msg.replace(/\s*\(char \d+\)/, '') };
  }
}

export function evalCoeff(p: ParsedCoeff, values: Record<string, number>): number {
  if (!p.fn) return NaN;
  try {
    const r = p.fn.evaluate({ ...values });
    return typeof r === 'number' ? r : NaN;
  } catch {
    return NaN;
  }
}

/** einbuchstabige Symbole kursiv statt \mathrm{t} */
function cleanTex(tex: string): string {
  return tex.replace(/\\mathrm\{([A-Za-z])\}/g, ' $1 ');
}

/** TeX eines beliebigen Ausdrucks (Quelltext) */
export function texOf(expr: string): string {
  try {
    return cleanTex(math.parse(expr).toTex({ parenthesis: 'keep', implicit: 'hide' }));
  } catch {
    return '\\text{?}';
  }
}

/** Vereinfachter Ausdruck (Quelltext + TeX); fällt bei Fehlern auf den Originalausdruck zurück. */
function simp(expr: string): { str: string; tex: string } {
  try {
    const n = math.simplify(expr);
    return { str: n.toString(), tex: cleanTex(n.toTex({ parenthesis: 'keep', implicit: 'hide' })) };
  } catch {
    return { str: expr, tex: texOf(expr) };
  }
}

export type SymbolicCubic = { p: string; q: string; delta: string; shift: string; lead: string };

/** Symbolische (in den Parametern vereinfachte) Größen p, q, Δ, b/(3a) und a. */
export function symbolicCubic(c: ParsedCoeff[]): SymbolicCubic {
  const [a, b, cc, d] = c.map((x) => `(${x.clean})`);
  const p = simp(`(3*${a}*${cc} - ${b}^2)/(3*${a}^2)`);
  const q = simp(`(2*${b}^3 - 9*${a}*${b}*${cc} + 27*${a}^2*${d})/(27*${a}^3)`);
  let deltaTex = simp(`(${q.str})^2/4 + (${p.str})^3/27`).tex;
  // unschöne Gleitkomma-Konstanten vermeiden: dann lieber die unvereinfachte Formel in p und q
  if (/10\^|\d\.\d/.test(deltaTex)) {
    deltaTex = `\\frac{\\left(${q.tex}\\right)^{2}}{4}+\\frac{\\left(${p.tex}\\right)^{3}}{27}`;
  }
  const delta = { tex: deltaTex };
  const shift = simp(`${b}/(3*${a})`);
  return { p: p.tex, q: q.tex, delta: delta.tex, shift: shift.tex, lead: c[0].tex };
}

/** Symbolische Ausdrücke für p und q in den (parametrischen) Koeffizienten. */
export function symbolicPQ(c: ParsedCoeff[]): { p: string; q: string } {
  const s = symbolicCubic(c);
  return { p: s.p, q: s.q };
}

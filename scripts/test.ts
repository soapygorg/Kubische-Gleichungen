import { parseCoeff } from '../lib/expr';
import { evalAll, solveAll, linearFactorTex, realFactorTex, equationTex } from '../lib/solve';
import { polyEval } from '../lib/numeric';

type Case = { name: string; src: string[]; values?: Record<string, number> };

const cases: Case[] = [
  { name: 'drei ganze Nullstellen', src: ['1', '-6', '11', '-6'] },
  { name: 'Cardano, eine reelle', src: ['1', '0', '1', '1'] },
  { name: 'casus irreducibilis', src: ['1', '0', '-3', '1'] },
  { name: 'Brüche', src: ['2', '-3', '-3', '2'] },
  { name: 'komplexes Paar + rationale NS', src: ['1', '0', '0', '-1'] },
  { name: 'Doppelnullstelle', src: ['1', '-5', '8', '-4'] },
  { name: 'Dreifach', src: ['1', '-3', '3', '-1'] },
  { name: 'quadratisch', src: ['0', '1', '2', '5'] },
  { name: 'linear', src: ['0', '0', '2', '4'] },
  { name: 'Wurzel in rat. NS', src: ['1', '0', '-2', '0'] },
  { name: 'Dezimal', src: ['0,5', '1.5', '-2', '1'] },
  { name: 'Parameter t', src: ['1', 't', '-4', 's'], values: { t: 1.5, s: 2 } },
  { name: 'Parameter casus', src: ['1', '0', '-3*t', '1'], values: { t: 1 } },
  { name: 'Parameter a=0', src: ['t', '1', '-1', '-6'], values: { t: 0 } },
  { name: 'irrational', src: ['1', '0', '-sqrt(2)', '1'] },
];

let fail = 0;
for (const c of cases) {
  const parsed = c.src.map(parseCoeff);
  const err = parsed.find((p) => p.error);
  if (err) {
    console.log('FEHLER', c.name, err.error);
    fail++;
    continue;
  }
  const values = c.values ?? {};
  const nums = evalAll(parsed, values);
  const sol = solveAll(parsed, nums);
  let maxRes = 0;
  for (const r of sol.roots) {
    // Residuum für komplexe Wurzeln: Re und Im der Polynomauswertung
    let re = 0;
    let im = 0;
    for (const co of nums) {
      const nre = re * r.re - im * r.im + co;
      const nim = re * r.im + im * r.re;
      re = nre;
      im = nim;
    }
    const scale = Math.max(1, ...nums.map(Math.abs)) * Math.max(1, Math.hypot(r.re, r.im)) ** 3;
    maxRes = Math.max(maxRes, Math.hypot(re, im) / scale);
  }
  const ok = maxRes < 1e-9;
  if (!ok) fail++;
  console.log(`${ok ? 'OK ' : 'FAIL'} ${c.name} [${sol.mode}, Grad ${sol.degree}] res=${maxRes.toExponential(1)}`);
  console.log('   Gl:', equationTex(parsed, nums));
  sol.roots.forEach((r, i) => console.log(`   x${i + 1} = ${r.tex}   ≈ ${r.approxTex}`));
  console.log('   LF:', linearFactorTex(sol));
  const rf = realFactorTex(sol);
  if (rf) console.log('   RF:', rf);
  void polyEval;
}
console.log(fail === 0 ? '\nAlle Tests bestanden' : `\n${fail} Fehler`);
process.exit(fail ? 1 : 0);

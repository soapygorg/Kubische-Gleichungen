# Kubische Gleichungen lösen

Next.js-App (App Router, TypeScript), die kubische Gleichungen `a·x³ + b·x² + c·x + d = 0` analytisch löst.

## Start

```bash
npm install
npm run dev      # http://localhost:3000
# oder
npm run build && npm start
npm test         # Testfälle für den Löser (Residuen-Check)
```

## Funktionen

- Eingabefelder für a, b, c, d mit LaTeX-Vorschau (KaTeX). Koeffizienten dürfen Parameter wie `t`, `s` enthalten (`2*t`, `s^2-1`, `sqrt(3)/2`).
- Nullstellen einzeln, Lösungsweg einklappbar.
  - **Rationale Koeffizienten:** exakte Lösung (rationale Nullstelle abspalten + Mitternachtsformel; sonst Cardano bzw. trigonometrische Form mit eingesetzten Werten).
  - **Parameter / irrationale Konstanten:** Cardanische Formeln mit symbolischem p und q, numerisch ausgewertet bei den aktuellen Reglerwerten.
- Linearfaktordarstellung (mit Vielfachheiten, bei komplexen Wurzeln zusätzlich die reelle Zerlegung).
- Plot (Canvas): Ziehen = verschieben, Mausrad/Pinch = zoomen, Shift+Rad = nur x, Alt+Rad = nur y.
- Pro Parameter ein Regler (Wert, min, max einstellbar) unter dem Plot.
- Hell-/Dunkelmodus.

## Quellen

- https://de.wikipedia.org/wiki/Kubische_Gleichung
- https://en.wikipedia.org/wiki/Cubic_equation

## Aufbau

- `lib/expr.ts` – Ausdrucksparser (mathjs, eingeschränkt), Parameter-Erkennung, LaTeX
- `lib/numeric.ts` – Cardano / trigonometrische Lösung in Gleitkommazahlen
- `lib/exact.ts` – exakte Lösung mit Brüchen (BigInt)
- `lib/solve.ts` – Auswahl exakt/numerisch, Linearfaktoren, Gleichungs-LaTeX
- `components/Plot.tsx` – Canvas-Plot mit Zoom/Pan
- `app/page.tsx` – Oberfläche

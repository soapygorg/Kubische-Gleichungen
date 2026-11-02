import Latex from './Latex';

/** Allgemeine Lösungsformeln (Cardano), wie im Wikipedia-Artikel „Kubische Gleichung“ beschrieben. */
export default function CardanoFormulas() {
  return (
    <div className="formulas">
      <h4>Cardanische Formeln</h4>
      <p>
        Für <Latex tex="ax^3+bx^2+cx+d=0" /> mit <Latex tex="a\neq 0" /> wird mit <Latex tex="x=z-\frac{b}{3a}" /> das
        quadratische Glied beseitigt (reduzierte Form <Latex tex="z^3+pz+q=0" />):
      </p>
      <Latex
        display
        tex={String.raw`p=\frac{3ac-b^2}{3a^2},\qquad q=\frac{2b^3-9abc+27a^2d}{27a^3},\qquad \Delta=\left(\frac{q}{2}\right)^2+\left(\frac{p}{3}\right)^3`}
      />
      <p>
        <strong>Δ ≥ 0</strong> (eine reelle Lösung, bei Δ = 0 mehrfach):
      </p>
      <Latex
        display
        tex={String.raw`u=\sqrt[3]{-\frac{q}{2}+\sqrt{\Delta}},\quad v=\sqrt[3]{-\frac{q}{2}-\sqrt{\Delta}},\qquad z_1=u+v,\quad z_{2,3}=-\frac{u+v}{2}\pm\frac{\sqrt{3}}{2}\,(u-v)\,i`}
      />
      <p>
        <strong>Δ &lt; 0</strong> (drei reelle Lösungen, trigonometrische Form):
      </p>
      <Latex
        display
        tex={String.raw`z_k=2\sqrt{-\frac{p}{3}}\;\cos\!\left(\frac{1}{3}\arccos\!\left(\frac{3q}{2p}\sqrt{-\frac{3}{p}}\right)-\frac{2\pi k}{3}\right),\quad k=0,1,2`}
      />
      <p>
        Rücksubstitution: <Latex tex="x_k=z_k-\frac{b}{3a}" />
      </p>
    </div>
  );
}

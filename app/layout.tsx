import type { Metadata, Viewport } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kubische Gleichungen lösen',
  description:
    'Löst kubische Gleichungen analytisch (Cardanische Formeln), auch mit Parametern, zeigt Nullstellen, Linearfaktoren und einen interaktiven Plot.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}

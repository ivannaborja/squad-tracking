import type { Metadata } from "next";
import Link from "next/link";
import { Poppins, Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";

// Poppins para títulos, Roboto para cuerpo, Roboto Mono para cifras/fechas: el
// trío que fija el Design System.
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["500", "600", "700"] });
const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["400", "500", "700"] });
const robotoMono = Roboto_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Seguimiento de Squads",
  description: "Pre-informe y comparativo semanal de los squads",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${poppins.variable} ${roboto.variable} ${robotoMono.variable} h-full`}>
      <body className="min-h-full">
        <div
          className="no-print"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            padding: "8px 24px",
            background: "#ffffff",
            borderBottom: "1px solid #e6e8eb",
          }}
        >
          <Link
            href="/"
            style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", fontSize: 14, fontWeight: 600, color: "#0a2f5c", textDecoration: "none" }}
          >
            Seguimiento de Squads
          </Link>
        </div>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}

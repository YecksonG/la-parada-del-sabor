import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Parada del Sabor | POS & Arepas Gourmet",
  description: "Sistema gastronómico de comandas, punto de venta y control de recetas en gramos",
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

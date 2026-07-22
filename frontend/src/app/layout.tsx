import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { TestModeToggle } from "@/components/TestModeToggle";

export const metadata: Metadata = {
  title: "Onramp BOB > USDT | Convierte tus Bolivianos",
  description: "Compra USDT con Bolivianos de forma segura y rapida en Polygon",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-mesh">
        <Providers>
          <header className="sticky top-0 z-50 border-b border-white/5">
            <div className="absolute inset-0 bg-[#0a0f1a]/80 backdrop-blur-xl" />
            <div className="relative max-w-6xl mx-auto px-4 py-3.5 flex justify-between items-center">
              <a href="/comprar" className="flex items-center gap-3 group">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow duration-300">
                  <span className="text-white font-bold text-sm">O</span>
                </div>
                <span className="text-xl font-bold text-gradient">Onramp</span>
              </a>
              <nav className="flex gap-1 items-center">
                <a
                  href="/kyc"
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all duration-200"
                >
                  KYC
                </a>
                <a
                  href="/comprar"
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all duration-200"
                >
                  Comprar
                </a>
                <a
                  href="/dashboard"
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all duration-200"
                >
                  Historial
                </a>
                <a
                  href="/lp"
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all duration-200"
                >
                  LP
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-white/5 py-6 mt-auto">
            <div className="max-w-6xl mx-auto px-4 text-center space-y-2">
              <p className="text-xs text-slate-500">Onramp no custodia fondos. Tasa P2P de Stereum Pay. Powered by Polygon.</p>
              <div className="flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-xs text-slate-600">Testnet Amoy &bull; Datos con fines de demostracion</p>
              </div>
            </div>
          </footer>
          <TestModeToggle />
        </Providers>
      </body>
    </html>
  );
}

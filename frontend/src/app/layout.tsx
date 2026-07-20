import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onramp BOB > USDC",
  description: "Compra USDC con Bolivianos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <h1>Test Layout</h1>
        {children}
      </body>
    </html>
  );
}

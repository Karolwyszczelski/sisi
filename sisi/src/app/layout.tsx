import "./globals.css";

export const metadata = {
  title: "SISI Ordering",
  description: "Zamów najlepsze burgery i pancakes w Ciechanowie!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body className="bg-red-500 text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}

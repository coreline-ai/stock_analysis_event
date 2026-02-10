import "./globals.css";

export const metadata = {
  title: "Mahoraga Research-Only",
  description: "Signal & Timing Engine (Research-Only)"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}

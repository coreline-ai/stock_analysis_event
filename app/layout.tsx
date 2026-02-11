import "./globals.css";
import WebVitalsProbe from "./_components/web_vitals_probe";

export const metadata = {
  title: "리서치 전용 시그널·타이밍 엔진",
  description: "리서치 전용 시그널 및 타이밍 분석 대시보드"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">{children}</div>
        <WebVitalsProbe />
      </body>
    </html>
  );
}

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Comanda",
    template: "%s | Comanda",
  },
  description:
    "Sistema de comanda digital para atendimento, cozinha, copa, caixa e gestão de restaurante.",
  applicationName: "Comanda",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Comanda",
  },
};

export const viewport = {
  themeColor: "#171714",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

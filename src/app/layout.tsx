import "./globals.css";
import { Inter as FontSans } from "next/font/google";
import { RootLayoutClient } from "@/components/providers/RootLayoutClient";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Stellaris",
  description: "一次Swap，一次承诺，尽在AptOS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`min-h-screen font-sans antialiased ${fontSans.variable}`}>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
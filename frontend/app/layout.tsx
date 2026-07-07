import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Atkinson_Hyperlegible_Mono } from "next/font/google";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-atkinson",
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  variable: "--font-atkinson-mono",
});

export const metadata: Metadata = {
  title: "82-0",
  description: "Build the greatest 10-man NBA lineup of all time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${atkinson.variable} ${atkinsonMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
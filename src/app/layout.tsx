import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Text, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const display = DM_Serif_Text({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hearth",
  description: "Ten seconds means ten. Live Veo and Gemini from Google AI Studio.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(sans.variable, display.variable, mono.variable)}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}

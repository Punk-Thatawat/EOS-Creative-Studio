import type { Metadata } from "next";
import "./globals.css";
import { Kanit, Noto_Sans_Thai } from "next/font/google";
import { cn } from "@/lib/utils";

const kanit = Kanit({ subsets: ["thai", "latin"], variable: "--font-kanit", display: "swap", weight: ["400", "500", "600", "700", "800"] });
const notoSansThai = Noto_Sans_Thai({ subsets: ["thai", "latin"], variable: "--font-noto-sans-thai", display: "swap", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: {
    default: "EOS Creative Studio",
    template: "%s · EOS Creative Studio",
  },
  description: "A focused workspace for creating, organizing, and monitoring AI content.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans", kanit.variable, notoSansThai.variable)}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

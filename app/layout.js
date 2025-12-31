import { Outfit, Fira_Code } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const firaCode = Fira_Code({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata = {
  title: "DocScan - Document Boundary Detection",
  description: "Lightweight, on-device document detection using classical computer vision. No AI, no cloud - just pure image processing.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${firaCode.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

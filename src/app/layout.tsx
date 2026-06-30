import type { Metadata } from "next";
import { Instrument_Serif, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aline — where people meet",
  description:
    "A modern replacement for when2meet: availability, location voting, itineraries, and attendance in one editorial flow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

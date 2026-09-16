import type { Metadata } from "next";
import { Lora, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AlertSounds } from "@/components/AlertSounds";
import { BackendSync } from "@/components/BackendSync";

// Lora is the display serif: soft, rounded strokes with conventional letterforms,
// and real weights — 400 for display sizes, 500 for headings under 28px (set in
// globals.css). Variable, so every weight in between is one file.
const lora = Lora({
  variable: "--font-lora",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hourelle: find the hour everyone can keep",
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
      className={`${lora.variable} ${instrumentSans.variable} h-full`}
    >
      {/* suppressHydrationWarning: browser extensions (Grammarly and friends) stamp
          attributes on body before React loads; that is not a mismatch of ours */}
      <body className="min-h-full flex flex-col bg-bg text-text font-sans" suppressHydrationWarning>
        {/* apply the saved appearance before anything paints, the same way next-themes
            applies data-theme — otherwise non-default palettes flash the Hourelle look */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var m={gcal:"daylight",pro:"studio",drain:"aline",pride:"aline"};var p=localStorage.getItem("aline.palette");p=m[p]||p;if(["studio","daylight","contrast"].indexOf(p)>=0)document.documentElement.setAttribute("data-palette",p)}catch(e){}`,
          }}
        />
        <Providers>
          <BackendSync />
          <AlertSounds />
          {children}
        </Providers>
      </body>
    </html>
  );
}

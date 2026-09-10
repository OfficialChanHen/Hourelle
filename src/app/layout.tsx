import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { BackendSync } from "@/components/BackendSync";

// Fraunces is variable: real weights (400 for display, 500 for headings under 28px,
// set in globals.css) and an optical-size axis, so the strokes stay sturdy at
// heading sizes and only go fine where the size can carry it
const fraunces = Fraunces({
  variable: "--font-fraunces",
  axes: ["opsz"],
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
      className={`${fraunces.variable} ${instrumentSans.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text font-sans">
        {/* apply the saved appearance before anything paints, the same way next-themes
            applies data-theme — otherwise non-default palettes flash the Aline look */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=localStorage.getItem("aline.palette");if(["gcal","drain","pride","pro","contrast"].indexOf(p)>=0)document.documentElement.setAttribute("data-palette",p)}catch(e){}`,
          }}
        />
        <Providers>
          <BackendSync />
          {children}
        </Providers>
      </body>
    </html>
  );
}

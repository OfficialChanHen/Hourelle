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
        {/* apply the saved appearance before anything paints, the same way next-themes
            applies data-theme — otherwise non-default palettes flash the Aline look */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=localStorage.getItem("aline.palette");if(["gcal","drain","pride","pro","contrast"].indexOf(p)>=0)document.documentElement.setAttribute("data-palette",p)}catch(e){}`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

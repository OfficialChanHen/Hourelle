import type { Metadata } from "next";
import { Lora, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AlertSounds } from "@/components/AlertSounds";
import { BackendSync } from "@/components/BackendSync";
import { NoticeRail } from "@/components/NoticeRail";

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
  title: "Hourelle: find the hour everyone can meet",
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
        {/* two things before anything paints. First, everything this browser saved under
            the old name moves to the new one, once, so a rename never empties anyone's
            events. Then the saved appearance and accessibility choices are applied, the same way next-themes applies
            data-theme — otherwise non-default palettes flash the house look. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var ks=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf("aline.")===0)ks.push(k)}for(var j=0;j<ks.length;j++){var nk="hourelle."+ks[j].slice(6);if(localStorage.getItem(nk)===null)localStorage.setItem(nk,localStorage.getItem(ks[j]));localStorage.removeItem(ks[j])}var m={gcal:"daylight",pro:"studio",drain:"hourelle",pride:"hourelle",aline:"hourelle"};var p=localStorage.getItem("hourelle.palette");p=m[p]||p;if(["studio","daylight","contrast"].indexOf(p)>=0)document.documentElement.setAttribute("data-palette",p);var a=JSON.parse(localStorage.getItem("hourelle.pref.a11y")||"{}"),r=document.documentElement;if(a.motion==="reduce")r.setAttribute("data-motion","reduce");if(a.links)r.setAttribute("data-links","underline");if(a.focus)r.setAttribute("data-focus","strong")}catch(e){}`,
          }}
        />
        <Providers>
          <BackendSync />
          <AlertSounds />
          <NoticeRail />
          {children}
        </Providers>
      </body>
    </html>
  );
}

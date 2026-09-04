import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";

// Self-hosted from app/fonts rather than fetched from Google at build time.
// next/font/google downloads the files during every build, so an outage or a
// file rotation on Google's CDN failed the whole production build. These are
// the same three families, latin subset, variable weight axes.

const playfair = localFont({
  src: "./fonts/playfair-display-latin-variable.woff2",
  variable: "--font-playfair",
  weight: "400 900",
  display: "swap",
});

const montserrat = localFont({
  src: "./fonts/montserrat-latin-variable.woff2",
  variable: "--font-montserrat",
  weight: "100 900",
  display: "swap",
});

const cormorant = localFont({
  src: "./fonts/cormorant-garamond-latin-variable.woff2",
  variable: "--font-cormorant",
  weight: "300 700",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://walters-pierce-wedding.com"),
  title: {
    default: "Emme & Connor Wedding",
    template: "%s | Emme & Connor Wedding"
  },
  description: "Join us for our wedding celebration in the beautiful Colorado Mountains - September 2026",
  keywords: ["wedding", "Emme", "Connor", "Colorado", "September 2026"],
  authors: [{ name: "Emme & Connor" }],
  openGraph: {
    title: "Emme & Connor Wedding",
    description: "Join us for our wedding celebration in the beautiful Colorado Mountains - September 2026",
    type: "website",
    images: [
      {
        url: "/images/engagement/DSC01845-100.jpg",
        width: 2000,
        height: 1333,
        alt: "Emme & Connor Engagement Photo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Emme & Connor Wedding",
    description: "Join us for our wedding celebration in the beautiful Colorado Mountains - September 2026"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${playfair.variable} ${montserrat.variable} ${cormorant.variable} font-montserrat antialiased`}
        suppressHydrationWarning={true}
      >
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

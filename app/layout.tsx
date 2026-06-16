import type { Metadata } from "next";
import { Playfair_Display, Montserrat, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: 'swap',
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: "Emme & Connor Wedding",
    template: "%s | Emme & Connor Wedding"
  },
  description: "Join us for our wedding celebration in the beautiful Colorado Mountains - September 2026",
  keywords: ["wedding", "Emme", "Connor", "Colorado", "September 2026", "Blackstone Rivers Ranch"],
  authors: [{ name: "Emme & Connor" }],
  openGraph: {
    title: "Emme & Connor Wedding",
    description: "Join us for our wedding celebration in the beautiful Colorado Mountains - September 2026",
    type: "website",
    images: [
      {
        // Must point at a file that exists in public/images/engagement (the old
        // photo1.jpg did not, so every social share showed a broken preview).
        url: "/images/engagement/Proposal-173.jpg",
        width: 1200,
        height: 630,
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

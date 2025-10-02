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
    default: "Emme & CeeJay Wedding",
    template: "%s | Emme & CeeJay Wedding"
  },
  description: "Join us for our wedding celebration in the beautiful Colorado Mountains - September 2026",
  keywords: ["wedding", "Emme", "CeeJay", "Colorado", "September 2026", "Blackstone Rivers Ranch"],
  authors: [{ name: "Emme & CeeJay" }],
  openGraph: {
    title: "Emme & CeeJay Wedding",
    description: "Join us for our wedding celebration in the beautiful Colorado Mountains - September 2026",
    type: "website",
    images: [
      {
        url: "/images/engagement/photo1.jpg",
        width: 1200,
        height: 630,
        alt: "Emme & CeeJay Engagement Photo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Emme & CeeJay Wedding",
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
      >
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

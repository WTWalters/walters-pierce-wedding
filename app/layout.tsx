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

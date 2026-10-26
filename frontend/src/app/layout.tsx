import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { FavouritesProvider } from "@/lib/favourites";
import { ThemeProvider, themeInitScript } from "@/lib/theme";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { AiAssistant } from "@/components/ai-assistant";
import { ToastProvider } from "@/components/toast";
import { ChatProvider } from "@/lib/chat-store";
import { ScrollProgress, BackToTop } from "@/components/ui";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "DriveEdge - Find Your Car. Compare Dealers. Buy with Confidence.",
  description:
    "Discover cars across India, compare specifications and dealership quotations, and buy with AI-powered guidance.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>
            <FavouritesProvider>
              <ToastProvider>
                <ChatProvider>
                  <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-pop"
                  >
                    Skip to content
                  </a>
                  <ScrollProgress />
                  <div className="flex min-h-screen flex-col">
                    <Header />
                    <main id="main-content" className="flex-1 pb-24 lg:pb-8">{children}</main>
                    <Footer />
                  </div>
                  <AiAssistant />
                  <BackToTop />
                </ChatProvider>
              </ToastProvider>
            </FavouritesProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

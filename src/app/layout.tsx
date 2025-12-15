import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "KumaView - Uptime Kuma Dashboard",
  description: "Monitor your Uptime Kuma instances",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={cn(inter.className, "min-h-screen bg-background font-sans antialiased")}>
        <div className="relative flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
          <footer className="border-t py-6 md:py-0 bg-background">
            <div className="max-w-[1600px] mx-auto flex flex-col items-center justify-between gap-4 md:h-14 md:flex-row px-4 sm:px-6 lg:px-8">
              <p className="text-sm text-muted-foreground text-center md:text-left">
                KumaView open source on{" "}
                <a
                  href="https://github.com/tonyliuzj/kumaview"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-4 hover:text-primary transition-colors"
                >
                  GitHub
                </a>{" "}
                by{" "}
                <a
                  href="https://tony-liu.com"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-4 hover:text-primary transition-colors"
                >
                  tony-liu.com
                </a>
                .
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}

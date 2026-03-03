import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Sniply – Find Your Perfect Stylist",
  description: "Sniply is the premium marketplace connecting you with professionals who understand your unique texture and style goals.",
};

const themeScript = `(function(){try{if(localStorage.getItem('sniply_theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}

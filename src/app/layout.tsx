import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbit News Curator",
  description: "Your personalized news curator.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/logo.png" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
                darkMode: "class",
                theme: {
                  extend: {
                    colors: {
                      "surface-container-lowest": "#0e0e0e", "on-surface": "#e5e2e1", 
                      "primary": "#d0bcff", "secondary": "#89ceff", 
                      "surface-container-high": "#2a2a2a", "on-surface-variant": "#cbc3d7", 
                      "surface-bright": "#3a3939", "surface-container": "#201f1f", 
                      "outline-variant": "#494454", "on-primary-fixed": "#23005c", 
                      "surface-container-highest": "#353534","surface-variant": "#353534",
                      "background": "#131313", "tertiary": "#ffb869"
                    },
                    fontFamily: {
                      "headline": ["Space Grotesk", "sans-serif"],
                      "body": ["Inter", "sans-serif"],
                      "label": ["Inter", "sans-serif"]
                    }
                  }
                }
              }
            `
          }}
        />
        <style dangerouslySetInnerHTML={{
          __html: `
            .material-symbols-outlined {
                font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            }
            .mesh-gradient {
                background-color: #0e0e0e;
                background-image: 
                    radial-gradient(at 0% 0%, rgba(139, 92, 246, 0.05) 0px, transparent 50%),
                    radial-gradient(at 100% 100%, rgba(14, 165, 233, 0.05) 0px, transparent 50%);
            }
            .glass-card {
                background: rgba(42, 42, 42, 0.4);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(149, 142, 160, 0.15);
            }
            .orbit-gradient-text {
                background: linear-gradient(135deg, #d0bcff 0%, #89ceff 100%);
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
            }
          `
        }} />
      </head>
      <body className="bg-surface-container-lowest font-body text-on-surface selection:bg-primary/30 min-h-screen mesh-gradient">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

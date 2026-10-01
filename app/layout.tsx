import type { Metadata } from 'next';
import React from 'react';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'A4 Print Kiosk — Fast & Affordable Printing',
  description: 'Self-service A4 document printing kiosk. Upload your PDF, choose options, pay and print.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="min-h-screen bg-gradient">
          {/* Top bar */}
          <header className="header-bar">
            <div className="header-inner">
              <div className="logo">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  <rect width="28" height="28" rx="8" fill="#4F46E5"/>
                  <path d="M7 8h14M7 12h14M7 16h9" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="21" cy="19" r="4" fill="#A5B4FC"/>
                  <path d="M21 17v2l1 1" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span>PrintKiosk</span>
              </div>
              <span className="header-tag">A4 Self-Service</span>
            </div>
          </header>

          <main className="page-main">
            {children}
          </main>

          <footer className="page-footer">
            <p>© 2024 PrintKiosk · Secure payments via Razorpay · All uploads are private and deleted after printing</p>
          </footer>
        </div>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import React from 'react';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'A4 Print Kiosk',
  description: 'Self-service A4 document printing kiosk',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen flex flex-col items-center justify-start p-4 antialiased text-gray-900">
        <main className="w-full max-w-xl mx-auto py-6">
          {children}
        </main>
      </body>
    </html>
  );
}

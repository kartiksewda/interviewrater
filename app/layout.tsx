import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'InterviewIQ — Brutally Honest Interview Feedback in 3 Minutes',
  description:
    'Record your answer to a real interview question. Get instant AI feedback on structure, filler words, confidence, and specificity. Built for SDE, Bank PO, and MBA GD-PI candidates in India.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

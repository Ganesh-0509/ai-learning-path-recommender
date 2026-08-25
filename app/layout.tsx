import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import NavHeader from '@/components/NavHeader';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Learning Path Recommender',
  description:
    "AI-powered personalized learning path recommender — a conversational assistant that turns a learner's goal into a structured, explained, adaptive roadmap.",
};

export default function RootLayout({children}: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NavHeader />
        {children}
      </body>
    </html>
  );
}

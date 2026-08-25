'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

// Fixes a real gap the impeccable design review caught: once a learner has a
// profile, the only route back to chat was an empty-state link that
// disappears the moment a profile exists. This header is present everywhere.

const LINKS = [
  {href: '/', label: 'Chat'},
  {href: '/dashboard', label: 'Dashboard'},
];

export default function NavHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-4xl items-center gap-1 px-6 py-3">
        {LINKS.map(link => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? 'page' : undefined}
              className={
                isActive
                  ? 'rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

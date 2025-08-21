'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  // On mount, determine theme from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored) {
      const isDark = stored === 'dark';
      setDark(isDark);
      document.documentElement.classList.toggle('dark', isDark);
    } else {
      // Default to system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDark(prefersDark);
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, []);

  const toggleTheme = () => {
    if (dark === null) return;
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.classList.toggle('dark', nextDark);
    localStorage.setItem('theme', nextDark ? 'dark' : 'light');
  };

  // Avoid rendering until theme is known to prevent flash
  if (dark === null) return null;

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 text-xs sm:text-sm px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.97] transition-all"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? '☀️ Light Mode' : '🌙 Dark Mode'}
    </button>
  );
}

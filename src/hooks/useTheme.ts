import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

export function useTheme(initial: ThemePreference = 'light') {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem('tuitio_theme') as ThemePreference | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch {
      // ignore
    }
    return initial;
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;
    let frame = 0;

    const apply = () => {
      const isDark = preference === 'dark' || (preference === 'system' && mq.matches);
      if (root.classList.contains('dark') !== isDark) {
        root.classList.add('theme-switching');
        root.classList.toggle('dark', isDark);
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => root.classList.remove('theme-switching'));
        });
      }
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#071321' : '#e7f2fc');
      setResolvedTheme(isDark ? 'dark' : 'light');
      try {
        localStorage.setItem('tuitio_theme', preference);
      } catch {
        // ignore
      }
    };

    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      cancelAnimationFrame(frame);
      root.classList.remove('theme-switching');
    };
  }, [preference]);

  return { preference, setPreference, resolvedTheme };
}

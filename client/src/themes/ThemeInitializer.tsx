import { useEffect } from 'react';
import { useTheme } from 'next-themes';

export function ThemeInitializer() {
  const { theme } = useTheme();

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else if (theme === 'light') document.documentElement.classList.remove('dark');
  }, [theme]);

  return null;
}

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { ThemeMode } from '@/types'
import { ThemeContext } from '@/hooks/useTheme'

const getInitialTheme = (): ThemeMode => {
  const savedTheme = localStorage.getItem('classy_theme')
  return savedTheme === 'dark' ? 'dark' : 'light'
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('classy_theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'))
  }, [])

  const contextValue = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

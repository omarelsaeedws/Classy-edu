import React from 'react'
import { AppRouter } from '@/routes'
import { ThemeProvider } from '@/providers/ThemeProvider'

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  )
}

export default App

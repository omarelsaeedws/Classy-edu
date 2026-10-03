import React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] dark:hover:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] transition-colors cursor-pointer"
      title={theme === 'dark' ? 'التحويل إلى الوضع الفاتح' : 'التحويل إلى الوضع الداكن'}
      aria-label="تبديل المظهر"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-[#F59E0B]" />
      ) : (
        <Moon className="w-4 h-4 text-[#64748B]" />
      )}
    </button>
  )
}

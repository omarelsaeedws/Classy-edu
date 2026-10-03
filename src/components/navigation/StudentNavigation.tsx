import React from 'react'
import { LogOut, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { BrandLogo } from '@/components/brand/BrandLogo'

export const StudentNavigation: React.FC = () => {
  const { logout } = useAuth()
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white px-4 py-3 dark:border-[#334155] dark:bg-[#1E293B] sm:px-6" dir="rtl" aria-label="تنقل الطالب">
      <Link to="/student" aria-label="Classy - الرئيسية"><BrandLogo className="h-8" /></Link>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link className="rounded-lg px-3 py-2 hover:bg-[#F8FAFC] dark:hover:bg-[#111827]" to="/student">الرئيسية</Link>
        <Link className="rounded-lg px-3 py-2 hover:bg-[#F8FAFC] dark:hover:bg-[#111827]" to="/student/teachers">المدرسون</Link>
        <Link className="rounded-lg px-3 py-2 hover:bg-[#F8FAFC] dark:hover:bg-[#111827]" to="/student/subscriptions">اشتراكاتي</Link>
        <Link className="flex items-center gap-1 rounded-lg px-3 py-2 hover:bg-[#F8FAFC] dark:hover:bg-[#111827]" to="/student/settings"><Settings className="h-4 w-4" />الإعدادات</Link>
        <Button variant="ghost" size="sm" onClick={() => void logout()}><LogOut className="h-4 w-4" />خروج</Button>
      </div>
    </nav>
  )
}

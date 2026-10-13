import React, { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { LogOut, Menu, Settings, X } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { useAuth } from '@/features/auth/hooks/useAuth'

interface RoleNavigationProps {
  role: 'STUDENT' | 'TEACHER'
}

const linkClass = ({ isActive }: { isActive: boolean }) => `rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-[#EFF6FF] font-semibold text-[#2563EB] dark:bg-[#1E3A8A]/40 dark:text-[#93C5FD]' : 'text-[#334155] hover:bg-[#F8FAFC] dark:text-[#CBD5E1] dark:hover:bg-[#111827]'}`

export const RoleNavigation: React.FC<RoleNavigationProps> = ({ role }) => {
  const { profile, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const studentLinks = [
    { to: '/student', label: 'الرئيسية', end: true },
    { to: '/student/teachers', label: 'المدرسون' },
    { to: '/student/subscriptions', label: 'اشتراكاتي' },
    { to: '/student/attendance/history', label: 'سجل الحضور' },
    { to: '/student/id', label: 'بطاقة الطالب' },
  ]
  const teacherLinks = profile?.teacher_status === 'ACTIVE'
    ? [
        { to: '/teacher', label: 'الرئيسية', end: true },
        { to: '/teacher/profile', label: 'بيانات المدرس والمجموعات' },
        { to: '/teacher/sessions', label: 'الحصص والحضور' },
        { to: '/teacher/students', label: 'طلبات الاشتراك' },
        { to: '/teacher/attendance/history', label: 'سجلات الحضور' },
        { to: '/teacher/verify-subscription', label: 'التحقق من اشتراك طالب' },
      ]
    : [
        { to: '/teacher/pending', label: 'الرئيسية', end: true },
        { to: '/teacher/subscription', label: 'اشتراك Classy' },
      ]
  const links = role === 'STUDENT' ? studentLinks : teacherLinks
  const settingsPath = role === 'STUDENT' ? '/student/settings' : '/teacher/settings'
  const homePath = role === 'STUDENT' ? '/student' : profile?.teacher_status === 'ACTIVE' ? '/teacher' : '/teacher/pending'

  const closeMenu = () => setMenuOpen(false)

  return <header dir="rtl" className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-white/95 text-[#0F172A] shadow-sm backdrop-blur dark:border-[#334155] dark:bg-[#0F172A]/95 dark:text-[#F8FAFC]">
    <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
      <Link to={homePath} aria-label="Classy - الرئيسية" className="shrink-0"><BrandLogo className="h-8" /></Link>

      <div className="hidden min-w-0 sm:block">
        <p className="max-w-40 truncate text-sm font-semibold">{profile?.full_name ?? 'حسابي'}</p>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{role === 'STUDENT' ? 'حساب الطالب' : 'حساب المدرس'}</p>
      </div>

      <nav aria-label={role === 'STUDENT' ? 'تنقل الطالب' : 'تنقل المدرس'} className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
        {links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>{link.label}</NavLink>)}
      </nav>

      <div className="mr-auto flex shrink-0 items-center gap-2">
        <Link to={settingsPath} aria-label="الإعدادات" title="الإعدادات" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#334155] transition-colors hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] dark:border-[#334155] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]"><Settings className="h-4 w-4" /></Link>
        <button type="button" aria-label="تسجيل الخروج" title="تسجيل الخروج" onClick={() => void logout()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] px-3 text-sm text-[#334155] transition-colors hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] dark:border-[#334155] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]"><LogOut className="h-4 w-4" /><span className="hidden xl:inline">تسجيل الخروج</span></button>
        <button type="button" aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] lg:hidden dark:border-[#334155]">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        <div><NotificationBell /></div>
      </div>
    </div>

    {menuOpen && <nav aria-label="روابط التنقل" className="border-t border-[#E2E8F0] bg-white px-4 py-3 shadow-md lg:hidden dark:border-[#334155] dark:bg-[#1E293B]">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 sm:flex-row sm:flex-wrap">
        {links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} onClick={closeMenu} className={linkClass}>{link.label}</NavLink>)}
      </div>
    </nav>}
  </header>
}

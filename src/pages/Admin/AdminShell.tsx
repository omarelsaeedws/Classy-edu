import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Activity, BookOpenCheck, CalendarDays, CreditCard, GraduationCap, LayoutDashboard, MessageSquareText, Settings, Users, Wallet } from 'lucide-react'

const links = [
  ['/admin', 'الرئيسية', LayoutDashboard], ['/admin/teachers', 'المدرسون', GraduationCap], ['/admin/students', 'الطلاب', Users],
  ['/admin/teacher-subscriptions', 'اشتراكات المدرسين', CreditCard], ['/admin/student-subscriptions', 'اشتراكات الطلاب', Wallet],
  ['/admin/groups', 'المجموعات', BookOpenCheck], ['/admin/sessions', 'الجلسات', CalendarDays], ['/admin/reviews', 'التقييمات', MessageSquareText],
  ['/admin/settings', 'إعدادات المنصة', Settings], ['/admin/audit-logs', 'سجل العمليات', Activity],
] as const

export const AdminShell = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation()
  return <div dir="rtl" className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC]">
    <nav aria-label="قائمة الإدارة" className="border-b border-[#E2E8F0] bg-white px-3 py-3 dark:border-[#334155] dark:bg-[#111827] sm:px-6">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1">
        {links.map(([to, label, Icon]) => <Link key={to} to={to} aria-current={pathname === to ? 'page' : undefined}
          className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm ${pathname === to ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
          <Icon className="h-4 w-4" />{label}
        </Link>)}
      </div>
    </nav>
    {children}
  </div>
}

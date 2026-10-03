import React from 'react'
import { Clock, ShieldAlert, LogOut, CreditCard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/features/auth/hooks/useAuth'

export const TeacherPendingPage: React.FC = () => {
  const { profile, logout } = useAuth()

  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC] dark:bg-[#0F172A] transition-colors">
      <div className="max-w-lg w-full bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl p-8 sm:p-10 shadow-xs text-right">
        {/* Header Icon & Status */}
        <div className="flex items-center justify-between pb-6 border-b border-[#E2E8F0] dark:border-[#334155] mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#FFFBEB] dark:bg-[#78350F]/30 text-[#D97706] flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <Badge variant="warning">قيد التفعيل</Badge>
        </div>

        <h1 className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight mb-2">
          أهلاً بك يا أستاذ {profile?.full_name || ''}
        </h1>

        <div className="space-y-4 text-sm text-[#64748B] dark:text-[#94A3B8] leading-relaxed my-6">
          <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            حسابك تم إنشاؤه بنجاح.
          </p>

          <p>
            لاستكمال تفعيل حساب المدرس، يجب الاشتراك في إحدى خطط Classy.
          </p>

          <p>
            بعد إرسال طلب الاشتراك وتحويل الرسوم، سيقوم فريق الإدارة بمراجعة الطلب وتفعيل الحساب.
          </p>

          <div className="p-3.5 rounded-lg bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] flex items-start gap-2.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <ShieldAlert className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
            <span>
              لا يمكن الوصول إلى لوحة تحكم المجموعات والطلاب حتى تتم مراجعة وتفعيل الحساب من قبل الإدارة.
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#334155] space-y-3">
          <Link to="/teacher/subscription" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 text-base font-medium text-white shadow-xs transition-colors hover:bg-[#1D4ED8] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB]">
            <CreditCard className="h-4 w-4" />متابعة الاشتراك
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full justify-center text-[#DC2626] hover:text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[#7F1D1D]/20 gap-2"
          >
            <LogOut className="w-4 h-4 rtl:rotate-180" />
            <span>تسجيل الخروج</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

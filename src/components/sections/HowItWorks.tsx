import React from 'react'
import { UserPlus, UserCheck, CalendarCheck } from 'lucide-react'

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      number: '01',
      title: 'أنشئ حسابك',
      description: 'سجّل حسابك كطالب واستكمل بيانات مرحلتك الدراسية وصفك التعليمي.',
      icon: UserPlus,
    },
    {
      number: '02',
      title: 'اختر مدرسك ومجموعتك',
      description: 'استعرض المدرسين المتاحين في أبو كبير واختر المجموعة والمواعيد المناسبة لك.',
      icon: UserCheck,
    },
    {
      number: '03',
      title: 'اشترك وتابع حضورك',
      description: 'أرسل طلب الاشتراك وحوّل الرسوم وسجل حضورك بكود الحصة الذكي.',
      icon: CalendarCheck,
    },
  ]

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-[#F8FAFC] dark:bg-[#111827] border-y border-[#E2E8F0] dark:border-[#334155] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-right">
        {/* Section Heading */}
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
            كيف تعمل Classy؟
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#64748B] dark:text-[#94A3B8]">
            ثلاث خطوات سهلة ومباشرة لبدء رحلتك التعليمية المنظمة
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((step, idx) => {
            const Icon = step.icon
            return (
              <div
                key={idx}
                className="relative bg-white dark:bg-[#1E293B] p-8 rounded-xl border border-[#E2E8F0] dark:border-[#334155] text-right flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-3xl font-black text-[#2563EB]/25 dark:text-[#3B82F6]/30">
                      {step.number}
                    </span>
                    <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA]">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

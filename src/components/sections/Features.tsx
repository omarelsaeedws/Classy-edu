import React from 'react'
import { Search, Send, Activity, QrCode } from 'lucide-react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'

export const Features: React.FC = () => {
  const features = [
    {
      icon: Search,
      title: 'اكتشف المدرسين',
      description: 'استعرض المدرسين المتاحين واختر حسب المادة والمرحلة والصف.',
    },
    {
      icon: Send,
      title: 'اشترك بسهولة',
      description: 'اختر المجموعة المناسبة وأرسل طلب الاشتراك وتحويل الرسوم بسهولة.',
    },
    {
      icon: Activity,
      title: 'تابع اشتراكك',
      description: 'تابع حالة اشتراكك وطلبات الدفع من حسابك.',
    },
    {
      icon: QrCode,
      title: 'سجل حضورك',
      description: 'سجل حضورك في موعد الحصة باستخدام QR Code أو كود الحضور.',
    },
  ]

  return (
    <section className="py-16 md:py-24 bg-[#F8FAFC] dark:bg-[#111827] border-y border-[#E2E8F0] dark:border-[#334155] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-right">
        {/* Section Heading */}
        <div className="max-w-2xl mx-auto text-center mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
            كل ما تحتاجه في مكان واحد
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#64748B] dark:text-[#94A3B8]">
            منظومة متكاملة لربط الطلاب والمعلمين في أبو كبير وإدارة الدروس بكل وضوح
          </p>
        </div>

        {/* 4 Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon
            return (
              <Card
                key={idx}
                className="hover:border-[#2563EB]/40 dark:hover:border-[#3B82F6]/50 transition-all duration-200"
              >
                <CardHeader className="pb-3">
                  <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA] mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {feature.title}
                  </h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

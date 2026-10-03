import React from 'react'
import { MapPin, Compass } from 'lucide-react'

export const LocalFocus: React.FC = () => {
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl p-8 md:p-12 text-right relative overflow-hidden">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#2563EB] dark:text-[#93C5FD] text-xs font-semibold mb-4 border border-[#BFDBFE] dark:border-[#1E40AF]/50">
              <MapPin className="w-3.5 h-3.5" />
              <span>نطاق العمل الأولي</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight mb-4">
              ابدأ من أبو كبير
            </h2>

            <p className="text-base sm:text-lg text-[#64748B] dark:text-[#94A3B8] leading-relaxed mb-6">
              Classy تبدأ من مركز أبو كبير لتسهّل الوصول إلى المدرسين والحصص المناسبة للطلاب في منطقتك.
            </p>

            <div className="flex flex-wrap gap-4 text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
              <span className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-[#2563EB] dark:text-[#3B82F6]" />
                مركز أبو كبير — محافظة الشرقية
              </span>
              <span>•</span>
              <span>مجموعات تعليمية حضورية معتمدة</span>
              <span>•</span>
              <span>تواصل مباشر مع أفضل الكفاءات التعليمية</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

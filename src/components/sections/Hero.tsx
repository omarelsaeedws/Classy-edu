import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export const Hero: React.FC = () => {
  return (
    <section id="hero" className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Main Hero Content */}
          <div className="text-right">
            {/* Small Label Badge */}
            <div className="inline-flex items-center gap-2 mb-6">
              <Badge variant="primary" className="py-1 px-3 text-xs md:text-sm font-semibold">
                منصة التعليم في أبو كبير
              </Badge>
            </div>

            {/* Main Heading */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC] leading-[1.25] mb-6">
              ابحث عن مدرسك المناسب
              <br />
              <span className="text-[#2563EB] dark:text-[#3B82F6]">واحجز حصتك بسهولة</span>
            </h1>

            {/* Supporting Text */}
            <p className="text-base sm:text-lg text-[#64748B] dark:text-[#94A3B8] leading-relaxed max-w-2xl mb-8">
              Classy تربطك بالمدرسين المتاحين في أبو كبير، وتساعدك على متابعة اشتراكاتك وحضورك من مكان واحد.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4">
              <a href="#teachers">
                <Button variant="primary" size="lg" className="w-full sm:w-auto">
                  <span>ابحث عن مدرس</span>
                  <ArrowLeft className="w-4 h-4 mr-1 rtl:rotate-0" />
                </Button>
              </a>
              <Link to="/register?role=teacher">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  أنا مدرس
                </Button>
              </Link>
            </div>

            {/* Value Highlights */}
            <div className="mt-12 pt-8 border-t border-[#E2E8F0] dark:border-[#334155] grid grid-cols-3 gap-4 text-right">
              <div>
                <div className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  أبو كبير
                </div>
                <div className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                  تغطية محلية مركزة
                </div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-[#2563EB] dark:text-[#3B82F6]">
                  100%
                </div>
                <div className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                  تنظيم ومتابعة
                </div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-[#16A34A]">
                  QR Code
                </div>
                <div className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                  تسجيل حضور ذكي
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}

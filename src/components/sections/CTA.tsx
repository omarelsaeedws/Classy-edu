import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export const CTA: React.FC = () => {
  return (
    <section className="py-16 md:py-24 bg-[#F8FAFC] dark:bg-[#111827] border-t border-[#E2E8F0] dark:border-[#334155] transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight mb-4">
          جاهز تبدأ؟
        </h2>
        <p className="text-base sm:text-lg text-[#64748B] dark:text-[#94A3B8] max-w-xl mx-auto mb-8 leading-relaxed">
          أنشئ حسابك واكتشف المدرسين المتاحين على Classy.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/register">
            <Button variant="primary" size="lg" className="w-full sm:w-auto">
              <span>ابدأ كطالب</span>
              <ArrowLeft className="w-4 h-4 mr-1 rtl:rotate-0" />
            </Button>
          </Link>
          <Link to="/register?role=teacher">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
              سجل كمدرس
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

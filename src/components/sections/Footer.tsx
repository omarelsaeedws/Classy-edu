import React from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/brand/BrandLogo'

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-[#0F172A] border-t border-[#E2E8F0] dark:border-[#334155] py-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-right">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start justify-between pb-12 border-b border-[#E2E8F0] dark:border-[#334155]">
          {/* Brand & Description */}
          <div className="md:col-span-6">
            <div className="flex items-center gap-2.5 mb-4">
              <BrandLogo className="h-9" />
            </div>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] max-w-sm leading-relaxed">
              منصة تعليمية تربط الطلاب بالمدرسين في أبو كبير.
            </p>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-6 flex flex-wrap gap-x-8 gap-y-3 md:justify-end text-sm font-medium">
            <a
              href="#hero"
              className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors"
            >
              الرئيسية
            </a>
            <a
              href="#teachers"
              className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors"
            >
              المدرسون
            </a>
            <a
              href="#how-it-works"
              className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors"
            >
              كيف تعمل المنصة
            </a>
            <Link
              to="/login"
              className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors"
            >
              تسجيل الدخول
            </Link>
            <Link
              to="/register"
              className="text-[#2563EB] dark:text-[#3B82F6] hover:underline transition-colors"
            >
              إنشاء حساب
            </Link>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8] gap-4">
          <div>
            © 2026 Classy. جميع الحقوق محفوظة.
          </div>
          <div>
            مركز أبو كبير — محافظة الشرقية
          </div>
        </div>
      </div>
    </footer>
  )
}

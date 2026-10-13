import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { BrandLogo } from '@/components/brand/BrandLogo'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-[#0F172A]/45 md:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="القائمة الرئيسية" className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col justify-between border-l border-[#E2E8F0] bg-white p-6 text-[#0F172A] shadow-xl dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC]">
        <div>
          <div className="flex items-center justify-between pb-6 border-b border-[#E2E8F0] dark:border-[#334155]">
            <Link to="/" onClick={onClose} aria-label="Classy - الصفحة الرئيسية"><BrandLogo className="h-8" /></Link>
            <button
              onClick={onClose}
              className="p-2 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white rounded-lg cursor-pointer"
              aria-label="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="mt-6 flex flex-col space-y-4">
            <a
              href="#hero"
              onClick={onClose}
              className="text-base font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:text-[#2563EB] dark:hover:text-[#3B82F6] py-2 transition-colors"
            >
              الرئيسية
            </a>
            <a
              href="#teachers"
              onClick={onClose}
              className="text-base font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] py-2 transition-colors"
            >
              المدرسون
            </a>
            <a
              href="#how-it-works"
              onClick={onClose}
              className="text-base font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] py-2 transition-colors"
            >
              كيف تعمل المنصة
            </a>
          </nav>
        </div>

        <div className="pt-6 border-t border-[#E2E8F0] dark:border-[#334155] space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-[#64748B] dark:text-[#94A3B8]">المظهر</span>
            <ThemeToggle />
          </div>
          <Link to="/login" onClick={onClose}>
            <Button variant="outline" className="w-full justify-center">
              تسجيل الدخول
            </Button>
          </Link>
          <Link to="/register" onClick={onClose}>
            <Button variant="primary" className="w-full justify-center">
              إنشاء حساب
            </Button>
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  )
}

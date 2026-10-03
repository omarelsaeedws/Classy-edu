import React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'error' | 'primary'
  children: React.ReactNode
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'neutral',
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'

  const variantStyles = {
    neutral:
      'bg-[#F1F5F9] text-[#475569] dark:bg-[#334155]/60 dark:text-[#CBD5E1] border border-[#E2E8F0] dark:border-[#475569]/30',
    primary:
      'bg-[#EFF6FF] text-[#2563EB] dark:bg-[#1E3A8A]/40 dark:text-[#93C5FD] border border-[#BFDBFE] dark:border-[#1E40AF]/50',
    success:
      'bg-[#F0FDF4] text-[#16A34A] dark:bg-[#14532D]/40 dark:text-[#86EFAC] border border-[#BBF7D0] dark:border-[#15803D]/50',
    warning:
      'bg-[#FFFBEB] text-[#D97706] dark:bg-[#78350F]/40 dark:text-[#FDE68A] border border-[#FDE68A] dark:border-[#B45309]/50',
    error:
      'bg-[#FEF2F2] text-[#DC2626] dark:bg-[#7F1D1D]/40 dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#991B1B]/50',
  }

  return (
    <span className={cn(baseStyles, variantStyles[variant], className)} {...props}>
      {children}
    </span>
  )
}

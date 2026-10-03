import React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer'

    const sizeStyles = {
      sm: 'h-9 px-3 text-xs rounded-lg gap-1.5',
      md: 'h-10 px-4 text-sm rounded-lg gap-2',
      lg: 'h-12 px-6 text-base rounded-lg gap-2.5',
    }

    const variantStyles = {
      primary:
        'bg-[#2563EB] text-white hover:bg-[#1D4ED8] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] shadow-xs',
      secondary:
        'bg-[#F8FAFC] text-[#0F172A] hover:bg-[#E2E8F0] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:hover:bg-[#334155] border border-[#E2E8F0] dark:border-[#334155]',
      outline:
        'border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#334155] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]',
      ghost:
        'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] dark:hover:bg-[#1E293B]',
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

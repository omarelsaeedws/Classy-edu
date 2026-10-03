import React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, helperText, id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined)

    return (
      <div className="w-full text-right">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            type={type}
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full h-11 px-3.5 text-sm rounded-lg bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] border transition-colors',
              'placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B]',
              'focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:focus:ring-[#3B82F6] focus:border-transparent',
              'disabled:bg-[#F8FAFC] dark:disabled:bg-[#111827] disabled:text-[#94A3B8] disabled:cursor-not-allowed',
              error
                ? 'border-[#DC2626] focus:ring-[#DC2626]'
                : 'border-[#E2E8F0] dark:border-[#334155]',
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <p className="mt-1.5 text-xs text-[#DC2626] font-medium flex items-center gap-1">
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="mt-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">{helperText}</p>
        ) : null}
      </div>
    )
  }
)

Input.displayName = 'Input'

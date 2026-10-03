import React from 'react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, disabled, ...props }, ref) => {
    const selectId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined)

    return (
      <div className="w-full text-right">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC] mb-1.5"
          >
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full h-11 px-3.5 text-sm rounded-lg bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] border transition-colors cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:focus:ring-[#3B82F6] focus:border-transparent',
            'disabled:bg-[#F8FAFC] dark:disabled:bg-[#111827] disabled:text-[#94A3B8] disabled:cursor-not-allowed',
            error
              ? 'border-[#DC2626] focus:ring-[#DC2626]'
              : 'border-[#E2E8F0] dark:border-[#334155]',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1.5 text-xs text-[#DC2626] font-medium">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

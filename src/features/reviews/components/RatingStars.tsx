import React from 'react'
import { Star } from 'lucide-react'

interface RatingStarsProps {
  rating: number
  className?: string
}

export const RatingStars: React.FC<RatingStarsProps> = ({ rating, className = '' }) => (
  <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`التقييم ${rating} من 5`}>
    {Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        aria-hidden="true"
        className={`h-4 w-4 ${index < Math.round(rating) ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#CBD5E1] dark:text-[#475569]'}`}
      />
    ))}
  </span>
)

interface RatingInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

export const RatingInput: React.FC<RatingInputProps> = ({ value, onChange, disabled = false }) => (
  <div className="flex items-center gap-1" role="group" aria-label="اختر تقييمًا من نجمة إلى خمس نجوم">
    {Array.from({ length: 5 }, (_, index) => {
      const rating = index + 1
      return (
        <button
          key={rating}
          type="button"
          aria-pressed={value === rating}
          aria-label={`${rating} من 5`}
          disabled={disabled}
          onClick={() => onChange(rating)}
          className="rounded p-1 text-[#F59E0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Star className={`h-7 w-7 ${rating <= value ? 'fill-current' : ''}`} />
        </button>
      )
    })}
  </div>
)

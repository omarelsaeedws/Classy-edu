import React from 'react'
import { RatingStars } from './RatingStars'
import type { PublicTeacherReview } from '../types'

interface ReviewCardProps {
  review: PublicTeacherReview
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => (
  <article className="space-y-2 border-b border-[#E2E8F0] py-4 last:border-0 dark:border-[#334155]">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="font-medium">{review.display_name}</span>
        <RatingStars rating={review.rating} />
      </div>
      <time className="text-xs text-[#64748B] dark:text-[#94A3B8]" dateTime={review.created_at}>
        {new Date(review.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
      </time>
    </div>
    {review.comment && <p className="whitespace-pre-wrap text-sm leading-6 text-[#475569] dark:text-[#CBD5E1]">{review.comment}</p>}
  </article>
)

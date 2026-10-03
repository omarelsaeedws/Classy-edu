import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { getReviewErrorMessage, reviewService } from '../reviewService'
import type { EditableTeacherReview, PublicTeacherReview, PublicTeacherReviewPage, StudentTeacherReviewStatus } from '../types'
import { RatingInput, RatingStars } from './RatingStars'
import { ReviewCard } from './ReviewCard'

const pageSize = 10

interface TeacherReviewsSectionProps {
  teacherId: string
}

export const TeacherReviewsSection: React.FC<TeacherReviewsSectionProps> = ({ teacherId }) => {
  const { profile, loading: authLoading } = useAuth()
  const canReview = profile?.role === 'STUDENT'
  const [page, setPage] = useState<PublicTeacherReviewPage | null>(null)
  const [reviews, setReviews] = useState<PublicTeacherReview[]>([])
  const [status, setStatus] = useState<StudentTeacherReviewStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [reviewPage, studentStatus] = await Promise.all([
        reviewService.getPublicPage(teacherId, 0, pageSize),
        canReview ? reviewService.getMyStatus(teacherId) : Promise.resolve(null),
      ])
      setPage(reviewPage)
      setReviews(reviewPage.reviews)
      setStatus(studentStatus)
      setRating(studentStatus?.review?.rating ?? 0)
      setComment(studentStatus?.review?.comment ?? '')
      setEditing(false)
    } catch (loadError) {
      console.error('Could not load teacher reviews:', loadError)
      setError('تعذّر تحميل التقييمات الآن. حاول مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }, [canReview, teacherId])

  useEffect(() => {
    if (authLoading) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [authLoading, load])

  const loadMore = async () => {
    if (!page || loadingMore) return
    setLoadingMore(true)
    try {
      const nextPage = await reviewService.getPublicPage(teacherId, reviews.length, pageSize)
      setReviews((current) => [...current, ...nextPage.reviews])
      setPage(nextPage)
    } catch (loadError) {
      console.error('Could not load more teacher reviews:', loadError)
      setError('تعذّر تحميل المزيد من التقييمات.')
    } finally {
      setLoadingMore(false)
    }
  }

  const saveReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!rating || saving) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (status?.review) await reviewService.update(status.review.id, rating, comment)
      else await reviewService.create(teacherId, rating, comment)
      setSuccess('تم حفظ تقييمك بنجاح.')
      setEditing(false)
      await load()
    } catch (saveError) {
      console.error('Could not save student teacher review:', saveError)
      setError(getReviewErrorMessage(saveError instanceof Error ? saveError.message : ''))
    } finally {
      setSaving(false)
    }
  }

  const ownReview: EditableTeacherReview | null = status?.review ?? null

  return (
    <section className="space-y-5" aria-labelledby="teacher-reviews-heading">
      <div>
        <h2 id="teacher-reviews-heading" className="text-xl font-semibold">التقييمات</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {page?.summary.review_count ? <>
            <RatingStars rating={page.summary.average_rating ?? 0} />
            <strong>{page.summary.average_rating?.toFixed(1)} / 5</strong>
            <span className="text-[#64748B] dark:text-[#94A3B8]">({page.summary.review_count} تقييم)</span>
          </> : <span className="text-[#64748B] dark:text-[#94A3B8]">لا توجد تقييمات بعد.</span>}
        </div>
        {page?.distribution && page.summary.review_count > 0 && <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2" aria-label="توزيع التقييمات">
          {[...page.distribution].sort((left, right) => right.rating - left.rating).map((item) => <div key={item.rating} className="flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8]"><span>{item.rating} نجوم</span><span>{item.count}</span></div>)}
        </div>}
      </div>

      {error && <p role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {success && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">{success}</p>}

      {canReview && status && (
        <div className="rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]">
          {ownReview && !editing ? <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">تقييمك</h3><RatingStars rating={ownReview.rating} /></div>
            {ownReview.comment && <p className="whitespace-pre-wrap text-sm text-[#475569] dark:text-[#CBD5E1]">{ownReview.comment}</p>}
            {status?.eligible && <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>تعديل التقييم</Button>}
          </div> : status.eligible ? <form className="space-y-3" onSubmit={(event) => void saveReview(event)}>
            <h3 className="font-semibold">{ownReview ? 'تعديل تقييمك' : 'شاركنا رأيك في المدرس'}</h3>
            <label className="block text-sm font-medium">ما تقييمك للمدرس؟</label>
            <RatingInput value={rating} onChange={setRating} disabled={saving} />
            <label htmlFor={`review-comment-${teacherId}`} className="block text-sm font-medium">تعليقك (اختياري)</label>
            <textarea
              id={`review-comment-${teacherId}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC]"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{comment.length}/1000</span>
              <div className="flex items-center gap-2">{ownReview && <Button type="button" variant="ghost" onClick={() => { setEditing(false); setRating(ownReview.rating); setComment(ownReview.comment ?? '') }}>إلغاء</Button>}<Button type="submit" disabled={!rating || saving}>{saving ? 'جارٍ حفظ التقييم...' : ownReview ? 'حفظ التعديل' : 'إرسال التقييم'}</Button></div>
            </div>
          </form> : <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">يمكنك تقييم المدرسين الذين اشتركت معهم.</p>}
        </div>
      )}

      {loading ? <p className="py-6 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">جارٍ تحميل التقييمات...</p> : reviews.length === 0 ? <p className="rounded-lg border border-[#E2E8F0] p-4 text-sm text-[#64748B] dark:border-[#334155] dark:text-[#94A3B8]">لا توجد تقييمات بعد.</p> : <div>{reviews.map((review, index) => <ReviewCard key={`${review.created_at}-${index}`} review={review} />)}</div>}
      {!loading && page?.has_more && <div className="text-center"><Button type="button" variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'جارٍ التحميل...' : 'عرض المزيد'}</Button></div>}
    </section>
  )
}

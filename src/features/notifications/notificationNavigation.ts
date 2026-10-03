import type { UserRole } from '@/lib/supabase/types'
import type { AppNotification } from './types'

const metadataOf = (notification: AppNotification): Record<string, unknown> =>
  typeof notification.metadata === 'object' && notification.metadata !== null && !Array.isArray(notification.metadata)
    ? notification.metadata as Record<string, unknown>
    : {}

export const getNotificationPath = (notification: AppNotification, role: UserRole | undefined): string | null => {
  const metadata = metadataOf(notification)
  const subscriptionId = typeof metadata.subscription_id === 'string' ? metadata.subscription_id : null
  const sessionId = typeof metadata.session_id === 'string' ? metadata.session_id : null

  if (role === 'STUDENT') {
    if ((notification.type === 'STUDENT_SUBSCRIPTION_APPROVED' || notification.type === 'STUDENT_SUBSCRIPTION_REJECTED') && subscriptionId) {
      return `/student/subscriptions/${encodeURIComponent(subscriptionId)}`
    }
    if (notification.type === 'SESSION_OPENED' || notification.type === 'SESSION_UPCOMING' || notification.type === 'SESSION_CANCELLED' || notification.type === 'SESSION_UPDATED') {
      return sessionId ? `/student/attendance/${encodeURIComponent(sessionId)}` : '/student/attendance'
    }
    if (notification.type === 'ATTENDANCE_RECORDED' || notification.type.startsWith('SUBSCRIPTION_') || notification.type.startsWith('GROUP_')) {
      return notification.type === 'ATTENDANCE_RECORDED' ? '/student/attendance/history' : '/student/subscriptions'
    }
  }

  if (role === 'TEACHER') {
    if (notification.type === 'NEW_STUDENT_SUBSCRIPTION_REQUEST' || notification.type === 'STUDENT_PAYMENT_SUBMITTED') return '/teacher/students'
    if (notification.type === 'NEW_REVIEW') return '/teacher'
    if (notification.type.startsWith('TEACHER_SUBSCRIPTION_') || notification.type === 'SUBSCRIPTION_EXPIRING' || notification.type === 'SUBSCRIPTION_EXPIRED') return '/teacher/subscription'
    if (notification.type.startsWith('SESSION_')) {
      return sessionId ? `/teacher/sessions/${encodeURIComponent(sessionId)}/attendance` : '/teacher/sessions'
    }
  }

  if (role === 'ADMIN' && (notification.type === 'TEACHER_PAYMENT_SUBMITTED' || notification.type === 'ADMIN_REVIEW_REQUIRED')) {
    return '/admin/subscriptions'
  }
  return null
}

export const formatNotificationTime = (date: string): string => {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000))
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800],
    ['day', 86_400], ['hour', 3_600], ['minute', 60], ['second', 1],
  ]
  const formatter = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' })
  const [unit, seconds] = units.find(([, size]) => elapsedSeconds >= size) ?? ['second', 1]
  return formatter.format(-Math.floor(elapsedSeconds / seconds), unit)
}

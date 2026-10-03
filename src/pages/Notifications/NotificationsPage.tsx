import React from 'react'
import { Bell, Check, CheckCheck, Circle, Inbox, LoaderCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useNotifications } from '@/features/notifications/notificationContext'
import { formatNotificationTime, getNotificationPath } from '@/features/notifications/notificationNavigation'
import type { NotificationFilter } from '@/features/notifications/types'

const filters: Array<{ id: NotificationFilter; label: string }> = [
  { id: 'ALL', label: 'الكل' },
  { id: 'UNREAD', label: 'غير المقروءة' },
  { id: 'READ', label: 'المقروءة' },
]

export const NotificationsPage: React.FC = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { notifications, unreadCount, loading, hasMore, error, filter, markAsRead, markAsUnread, markAllAsRead, loadMore, refresh, setFilter, clearError } = useNotifications()
  const visible = notifications

  const openNotification = async (id: string) => {
    const item = notifications.find((notification) => notification.id === id)
    if (!item) return
    if (!item.is_read && !(await markAsRead(id))) return
    const path = getNotificationPath(item, profile?.role)
    if (path) navigate(path)
  }

  return <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:px-6" dir="rtl">
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB] dark:bg-[#1E3A8A]/50 dark:text-[#60A5FA]"><Bell className="h-5 w-5" /></span><div><h1 className="text-2xl font-bold">الإشعارات</h1><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">تابع التحديثات المهمة المتعلقة بحسابك.</p></div></div>
        <button type="button" onClick={() => void markAllAsRead()} disabled={unreadCount === 0 || loading} className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#334155] dark:bg-[#1E293B]"><CheckCheck className="h-4 w-4" />تحديد الكل كمقروء</button>
      </header>

      <section className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white dark:border-[#334155] dark:bg-[#1E293B]">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3 dark:border-[#334155]">
          <div className="flex gap-2" role="tablist" aria-label="تصفية الإشعارات">{filters.map((option) => <button key={option.id} type="button" role="tab" aria-selected={filter === option.id} onClick={() => setFilter(option.id)} className={`rounded-lg px-3 py-2 text-sm ${filter === option.id ? 'bg-[#EFF6FF] font-semibold text-[#1D4ED8] dark:bg-[#1E3A8A]/40 dark:text-[#BFDBFE]' : 'text-[#64748B] hover:bg-[#F8FAFC] dark:text-[#94A3B8] dark:hover:bg-[#111827]'}`}>{option.label}{option.id === 'UNREAD' && unreadCount > 0 ? ` (${unreadCount})` : ''}</button>)}</div>
          <button type="button" onClick={() => { clearError(); void refresh() }} className="text-xs text-[#2563EB] dark:text-[#60A5FA]">تحديث</button>
        </div>

        {error && <p role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        {loading && notifications.length === 0 ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#64748B] dark:text-[#94A3B8]"><LoaderCircle className="h-4 w-4 animate-spin" />جارٍ تحميل الإشعارات...</div>
          : visible.length === 0 ? <div className="px-4 py-16 text-center"><Inbox className="mx-auto h-9 w-9 text-[#94A3B8]" /><h2 className="mt-3 font-semibold">{filter === 'UNREAD' ? 'لا توجد إشعارات غير مقروءة' : filter === 'READ' ? 'لا توجد إشعارات مقروءة' : 'لا توجد إشعارات'}</h2><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">ستظهر هنا الإشعارات المهمة المتعلقة بحسابك واشتراكاتك وجلساتك.</p></div>
            : <ul className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">{visible.map((item) => <li key={item.id} className="flex items-center gap-2 px-3">
              <button type="button" onClick={() => void openNotification(item.id)} className="flex min-w-0 flex-1 gap-3 py-4 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB]">
                {!item.is_read ? <Circle aria-label="غير مقروء" className="mt-1 h-3 w-3 shrink-0 fill-[#2563EB] text-[#2563EB]" /> : <span className="mt-1 h-3 w-3 shrink-0" aria-hidden="true" />}
                <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2"><span className={`text-sm ${item.is_read ? 'font-medium' : 'font-semibold'}`}>{item.title}</span><time className="text-xs text-[#64748B] dark:text-[#94A3B8]" dateTime={item.created_at}>{formatNotificationTime(item.created_at)}</time></span><span className="mt-1 block text-sm text-[#64748B] dark:text-[#94A3B8]">{item.message}</span></span>
              </button>
              <button type="button" onClick={() => void (item.is_read ? markAsUnread(item.id) : markAsRead(item.id))} aria-label={item.is_read ? 'تحديد كغير مقروء' : 'تحديد كمقروء'} title={item.is_read ? 'تحديد كغير مقروء' : 'تحديد كمقروء'} className="rounded-lg p-2 text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] dark:text-[#94A3B8] dark:hover:bg-[#111827] dark:hover:text-[#60A5FA]">
                <Check className="h-4 w-4" />
              </button>
            </li>)}</ul>}

        {hasMore && <div className="border-t border-[#E2E8F0] p-4 text-center dark:border-[#334155]"><button type="button" disabled={loading} onClick={() => void loadMore()} className="rounded-lg px-4 py-2 text-sm font-medium text-[#2563EB] hover:bg-[#F8FAFC] disabled:opacity-50 dark:text-[#60A5FA] dark:hover:bg-[#111827]">{loading ? 'جارٍ التحميل...' : 'تحميل المزيد'}</button></div>}
      </section>
    </div>
  </main>
}

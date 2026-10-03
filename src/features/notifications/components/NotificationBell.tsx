import React, { useState } from 'react'
import { Bell, Circle, Inbox } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useNotifications } from '../notificationContext'
import { formatNotificationTime, getNotificationPath } from '../notificationNavigation'

export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false)
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { notifications, unreadCount, loading, error, markAsRead, refresh, clearError } = useNotifications()

  const openNotification = async (id: string) => {
    const item = notifications.find((notification) => notification.id === id)
    if (!item) return
    if (!item.is_read && !(await markAsRead(item.id))) return
    setOpen(false)
    const path = getNotificationPath(item, profile?.role)
    if (path) navigate(path)
  }

  return <div className="relative" dir="rtl">
    <button
      type="button"
      aria-label={unreadCount > 0 ? `الإشعارات، ${unreadCount} غير مقروءة` : 'الإشعارات'}
      aria-expanded={open}
      onClick={() => { setOpen((value) => !value); clearError() }}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC] dark:hover:bg-[#111827]"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && <span className="absolute -left-1 -top-1 min-w-5 rounded-full bg-[#2563EB] px-1 text-center text-[10px] font-semibold leading-5 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>

    {open && <section className="absolute left-0 top-12 z-50 max-h-[calc(100dvh-5rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white shadow-lg dark:border-[#334155] dark:bg-[#1E293B]" aria-label="أحدث الإشعارات">
      <header className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3 dark:border-[#334155]">
        <h2 className="font-semibold">الإشعارات</h2>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="text-xs text-[#2563EB] disabled:opacity-50 dark:text-[#60A5FA]">تحديث</button>
      </header>
      {error && <p role="alert" className="px-4 pt-3 text-xs text-red-700 dark:text-red-300">{error}</p>}
      {loading && notifications.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">جارٍ تحميل الإشعارات...</p>
        : notifications.length === 0 ? <div className="px-4 py-8 text-center text-sm text-[#64748B] dark:text-[#94A3B8]"><Inbox className="mx-auto mb-2 h-6 w-6" />لا توجد إشعارات</div>
          : <ul className="max-h-[60vh] divide-y divide-[#E2E8F0] overflow-y-auto dark:divide-[#334155]">
            {notifications.slice(0, 5).map((item) => <li key={item.id}>
              <button type="button" onClick={() => void openNotification(item.id)} className="flex w-full gap-3 px-4 py-3 text-right hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB] dark:hover:bg-[#111827]">
                {!item.is_read && <Circle aria-label="غير مقروء" className="mt-1 h-2.5 w-2.5 shrink-0 fill-[#2563EB] text-[#2563EB]" />}
                {item.is_read && <span className="mt-1 h-2.5 w-2.5 shrink-0" aria-hidden="true" />}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="mt-1 line-clamp-2 block text-xs text-[#64748B] dark:text-[#94A3B8]">{item.message}</span><span className="mt-1 block text-[11px] text-[#64748B] dark:text-[#94A3B8]">{formatNotificationTime(item.created_at)}</span></span>
              </button>
            </li>)}
          </ul>}
      <footer className="border-t border-[#E2E8F0] p-3 text-center dark:border-[#334155]">
        <button type="button" onClick={() => { setOpen(false); navigate('/notifications') }} className="text-sm font-medium text-[#2563EB] hover:underline dark:text-[#60A5FA]">عرض كل الإشعارات</button>
      </footer>
    </section>}
  </div>
}

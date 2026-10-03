import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { notificationService } from './notificationService'
import type { AppNotification, NotificationFilter } from './types'
import { NotificationContext } from './notificationContext'
import type { NotificationContextValue } from './notificationContext'

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [dataUserId, setDataUserId] = useState<string | null>(null)
  const [filter, setFilterState] = useState<NotificationFilter>('ALL')
  const [dataFilter, setDataFilter] = useState<NotificationFilter>('ALL')
  const activeUserId = useRef(userId)
  const activeQueryKey = useRef(`${userId ?? ''}:${filter}`)
  const clearError = useCallback(() => setError(''), [])
  const visibleNotifications = useMemo(() => dataUserId === userId && userId !== null && dataFilter === filter ? notifications : [], [dataFilter, dataUserId, filter, notifications, userId])
  const visibleUnreadCount = dataUserId === userId && userId !== null ? unreadCount : 0
  const visibleLoading = loading || (!!userId && (dataUserId !== userId || dataFilter !== filter))
  const visibleError = dataUserId === userId && userId !== null ? error : ''

  const refreshUnread = useCallback(async (id: string) => {
    const count = await notificationService.unreadCount(id)
    if (activeUserId.current === id) setUnreadCount(count)
  }, [])

  const refresh = useCallback(async () => {
    if (!userId) return
    const queryKey = `${userId}:${filter}`
    setLoading(true)
    setError('')
    try {
      const [rows, count] = await Promise.all([
        notificationService.list(userId, 0, filter),
        notificationService.unreadCount(userId),
      ])
      if (activeUserId.current !== userId || activeQueryKey.current !== queryKey) return
      setNotifications(rows)
      setUnreadCount(count)
      setHasMore(rows.length === notificationService.pageSize)
      setDataUserId(userId)
      setDataFilter(filter)
    } catch (loadError) {
      if (activeQueryKey.current !== queryKey) return
      console.error('Could not load notifications:', loadError)
      setError('تعذّر تحميل الإشعارات. حاول مرة أخرى.')
    } finally {
      if (activeQueryKey.current === queryKey) setLoading(false)
    }
  }, [filter, userId])

  const loadMore = useCallback(async () => {
    if (!userId || loading || !hasMore || dataUserId !== userId || dataFilter !== filter) return
    const queryKey = `${userId}:${filter}`
    setLoading(true)
    setError('')
    try {
      const rows = await notificationService.list(userId, notifications.length, filter)
      if (activeUserId.current !== userId || activeQueryKey.current !== queryKey) return
      setNotifications((current) => {
        const seen = new Set(current.map((item) => item.id))
        return [...current, ...rows.filter((item) => !seen.has(item.id))]
      })
      setHasMore(rows.length === notificationService.pageSize)
      setDataUserId(userId)
      setDataFilter(filter)
    } catch (loadError) {
      if (activeQueryKey.current !== queryKey) return
      console.error('Could not load more notifications:', loadError)
      setError('تعذّر تحميل المزيد من الإشعارات.')
    } finally {
      if (activeQueryKey.current === queryKey) setLoading(false)
    }
  }, [dataFilter, dataUserId, filter, hasMore, loading, notifications.length, userId])

  const setReadState = useCallback(async (id: string, isRead: boolean) => {
    const current = visibleNotifications.find((item) => item.id === id)
    if (!userId || !current) return false
    if (current.is_read === isRead) return true
    setNotifications((items) => items.flatMap((item) => {
      if (item.id !== id) return [item]
      const updated = { ...item, is_read: isRead }
      if (filter === 'UNREAD' && isRead) return []
      if (filter === 'READ' && !isRead) return []
      return [updated]
    }))
    setUnreadCount((count) => Math.max(0, count + (isRead ? -1 : 1)))
    setError('')
    try {
      await notificationService.setReadState(id, isRead)
    } catch (markError) {
      console.error('Could not update notification read state:', markError)
      await refresh()
      setError('تعذّر تحديث حالة الإشعار.')
      return false
    }
    return true
  }, [filter, refresh, userId, visibleNotifications])

  const markAsRead = useCallback((id: string) => setReadState(id, true), [setReadState])
  const markAsUnread = useCallback((id: string) => setReadState(id, false), [setReadState])

  const markAllAsRead = useCallback(async () => {
    if (!userId || visibleUnreadCount === 0) return
    setNotifications((items) => filter === 'UNREAD' ? [] : items.map((item) => ({ ...item, is_read: true })))
    if (filter === 'UNREAD') setHasMore(false)
    setUnreadCount(0)
    setError('')
    try {
      await notificationService.markAllAsRead(userId)
      if (filter === 'READ') await refresh()
    } catch (markError) {
      console.error('Could not mark all notifications as read:', markError)
      await refresh()
      setError('تعذّر تحديد الإشعارات كمقروءة.')
    }
  }, [filter, refresh, userId, visibleUnreadCount])

  const setFilter = useCallback((next: NotificationFilter) => {
    setError('')
    setFilterState(next)
  }, [])

  useEffect(() => {
    activeUserId.current = userId
    activeQueryKey.current = `${userId ?? ''}:${filter}`
    if (!userId) return
    let active = true
    const initialLoad = window.setTimeout(() => { void refresh() }, 0)
    const channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as unknown as AppNotification
        if (!active) return
        const matchesFilter = filter === 'ALL' || (filter === 'UNREAD' ? !row.is_read : row.is_read)
        if (matchesFilter) {
          setNotifications((items) => [row, ...items.filter((item) => item.id !== row.id)].slice(0, Math.max(items.length, 10)))
        }
        void refreshUnread(userId).catch((countError: unknown) => {
          console.error('Could not refresh unread notification count:', countError)
          setError('تعذّر تحديث عدد الإشعارات غير المقروءة.')
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as unknown as AppNotification
        if (!active) return
        setNotifications((items) => items.flatMap((item) => {
          if (item.id !== row.id) return [item]
          const matchesFilter = filter === 'ALL' || (filter === 'UNREAD' ? !row.is_read : row.is_read)
          return matchesFilter ? [row] : []
        }))
        void refreshUnread(userId).catch((countError: unknown) => {
          console.error('Could not refresh unread notification count:', countError)
          setError('تعذّر تحديث عدد الإشعارات غير المقروءة.')
        })
      })
      .subscribe((status) => {
        if (!active) return
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('توقّف تحديث الإشعارات المباشر. يمكنك تحديث الصفحة للمزامنة.')
        }
      })
    return () => {
      active = false
      window.clearTimeout(initialLoad)
      void supabase.removeChannel(channel)
    }
  }, [filter, refresh, refreshUnread, userId])

  const value = useMemo<NotificationContextValue>(() => ({
    notifications: visibleNotifications, unreadCount: visibleUnreadCount, loading: visibleLoading, hasMore, error: visibleError, filter,
    markAsRead, markAsUnread, markAllAsRead, loadMore, refresh, setFilter,
    clearError,
  }), [clearError, filter, hasMore, loadMore, markAllAsRead, markAsRead, markAsUnread, refresh, setFilter, visibleError, visibleLoading, visibleNotifications, visibleUnreadCount])

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

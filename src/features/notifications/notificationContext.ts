import { createContext, useContext } from 'react'
import type { AppNotification, NotificationFilter } from './types'

export interface NotificationContextValue {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  hasMore: boolean
  error: string
  filter: NotificationFilter
  markAsRead: (id: string) => Promise<boolean>
  markAsUnread: (id: string) => Promise<boolean>
  markAllAsRead: () => Promise<void>
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  setFilter: (filter: NotificationFilter) => void
  clearError: () => void
}

export const NotificationContext = createContext<NotificationContextValue | null>(null)

export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used within NotificationProvider')
  return context
}

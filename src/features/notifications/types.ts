import type { Json, NotificationType } from '@/lib/supabase/types'

export type { NotificationType } from '@/lib/supabase/types'

export interface AppNotification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  is_read: boolean
  metadata: Json
  created_at: string
}

export type NotificationFilter = 'ALL' | 'UNREAD' | 'READ'

import { supabase } from '@/lib/supabase/client'
import type { AppNotification, NotificationFilter } from './types'

const PAGE_SIZE = 20

export const notificationService = {
  async list(userId: string, offset = 0, filter: NotificationFilter = 'ALL'): Promise<AppNotification[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (filter === 'UNREAD') query = query.eq('is_read', false)
    if (filter === 'READ') query = query.eq('is_read', true)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as AppNotification[]
  },

  async unreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    if (error) throw error
    return count ?? 0
  },

  async setReadState(id: string, isRead: boolean): Promise<void> {
    const { error } = await supabase.from('notifications').update({ is_read: isRead }).eq('id', id)
    if (error) throw error
  },

  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    if (error) throw error
  },

  get pageSize(): number {
    return PAGE_SIZE
  },
}

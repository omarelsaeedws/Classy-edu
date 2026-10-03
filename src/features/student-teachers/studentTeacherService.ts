import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/types'
import type {
  StudentSubscriptionDetails,
  StudentSubscriptionSummary,
  StudentTeacherDetails,
  StudentTeacherDirectoryItem,
  PublicTeacherProfile,
  StudentTeacherFilters,
  TeacherStudentRequest,
  StudentSubscriptionRenewalSummary,
  StudentSubscriptionRenewalDetails,
  TeacherStudentRenewal,
} from './types'

const asJsonObject = <T,>(value: Json | null): T | null => value === null ? null : value as unknown as T

const signedAvatar = async (avatarPath: string | null) => {
  if (!avatarPath) return null
  const { data, error } = await supabase.storage.from('teacher-avatars').createSignedUrl(avatarPath, 3600)
  if (error) {
    console.error('Could not create signed teacher portrait URL:', error)
    return null
  }
  return data.signedUrl
}

const signedReceipt = async (receiptPath: string | null) => {
  if (!receiptPath) return null
  const { data, error } = await supabase.storage.from('student-payment-receipts').createSignedUrl(receiptPath, 3600)
  if (error) throw error
  return data.signedUrl
}

export const studentTeacherService = {
  async listTeachers(filters: StudentTeacherFilters): Promise<StudentTeacherDirectoryItem[]> {
    const { data, error } = await supabase.rpc('list_student_teachers', {
      p_stage: filters.stage || null,
      p_grade: filters.grade || null,
      p_subject: filters.subject || null,
      p_area: filters.area.trim() || null,
      p_search: filters.search.trim() || null,
    })
    if (error) throw error
    return Promise.all((data ?? []).map(async (teacher) => ({
      ...teacher,
      avatar_url: await signedAvatar(teacher.avatar_path),
      groups: teacher.groups as unknown as StudentTeacherDirectoryItem['groups'],
    })))
  },

  async getTeacherDetails(teacherId: string): Promise<StudentTeacherDetails | null> {
    const { data, error } = await supabase.rpc('get_student_teacher_details', { p_teacher_id: teacherId })
    if (error) throw error
    const teacher = asJsonObject<StudentTeacherDetails>(data)
    if (!teacher) return null
    return { ...teacher, avatar_url: await signedAvatar(teacher.avatar_path) }
  },

  async getPublicTeacherProfile(teacherId: string): Promise<PublicTeacherProfile | null> {
    const { data, error } = await supabase.rpc('get_public_teacher_profile', { p_teacher_id: teacherId })
    if (error) throw error
    const teacher = asJsonObject<PublicTeacherProfile>(data)
    if (!teacher) return null
    return { ...teacher, avatar_url: null, avatar_path: null }
  },

  async createRequest(groupId: string): Promise<string> {
    const { data, error } = await supabase.rpc('create_student_subscription_request', { p_group_id: groupId })
    if (error) throw error
    return data
  },

  async listSubscriptions(): Promise<StudentSubscriptionSummary[]> {
    const { data, error } = await supabase.rpc('list_student_teacher_subscriptions')
    if (error) throw error
    return Promise.all((data ?? []).map(async (subscription) => ({
      ...subscription,
      status: subscription.status as StudentSubscriptionSummary['status'],
      teacher_avatar_url: await signedAvatar(subscription.teacher_avatar_path),
    })))
  },

  async getSubscription(subscriptionId: string): Promise<StudentSubscriptionDetails | null> {
    const { data, error } = await supabase.rpc('get_student_teacher_subscription', {
      p_subscription_id: subscriptionId,
    })
    if (error) throw error
    const subscription = asJsonObject<StudentSubscriptionDetails>(data)
    if (!subscription) return null
    return {
      ...subscription,
      teacher_avatar_url: await signedAvatar(subscription.teacher_avatar_path),
      payment: subscription.payment
        ? { ...subscription.payment, receipt_url: await signedReceipt(subscription.payment.receipt_path) }
        : null,
    }
  },

  async submitPayment(input: {
    subscriptionId: string
    paymentMethodId: string
    transferredAmount: number
    receipt: File
    notes: string
  }): Promise<string> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.receipt.type)) {
      throw new Error('Unsupported receipt type.')
    }
    if (input.receipt.size > 5 * 1024 * 1024) throw new Error('Receipt exceeds the 5 MB limit.')
    if (!Number.isFinite(input.transferredAmount) || input.transferredAmount <= 0) {
      throw new Error('Transferred amount must be positive.')
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Authentication is required.')

    const paymentId = crypto.randomUUID()
    const extension = input.receipt.type === 'image/jpeg'
      ? (input.receipt.name.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'jpg')
      : input.receipt.type.split('/')[1]
    const receiptPath = `${user.id}/${input.subscriptionId}/${paymentId}.${extension}`
    const { error: uploadError } = await supabase.storage.from('student-payment-receipts').upload(receiptPath, input.receipt, {
      cacheControl: '3600',
      contentType: input.receipt.type,
      upsert: false,
    })
    if (uploadError) throw uploadError

    const { data, error } = await supabase.rpc('submit_student_teacher_payment', {
      p_payment_id: paymentId,
      p_subscription_id: input.subscriptionId,
      p_payment_method_id: input.paymentMethodId,
      p_transferred_amount: input.transferredAmount,
      p_receipt_path: receiptPath,
      p_notes: input.notes.trim() || null,
    })
    if (error) {
      const { error: cleanupError } = await supabase.storage.from('student-payment-receipts').remove([receiptPath])
      if (cleanupError) console.warn('Could not remove an unsubmitted receipt:', cleanupError)
      throw error
    }
    return data
  },

  async listTeacherRequests(): Promise<TeacherStudentRequest[]> {
    const { data, error } = await supabase.rpc('list_teacher_student_subscriptions')
    if (error) throw error
    return Promise.all((data ?? []).map(async (request) => ({
      ...request,
      subscription_status: request.subscription_status as TeacherStudentRequest['subscription_status'],
      payment_provider: request.payment_provider as TeacherStudentRequest['payment_provider'],
      payment_status: request.payment_status as TeacherStudentRequest['payment_status'],
      receipt_url: await signedReceipt(request.receipt_path),
    })))
  },

  async reviewRequest(subscriptionId: string, approve: boolean, rejectionReason?: string): Promise<void> {
    const { error } = await supabase.rpc('review_student_teacher_subscription', {
      p_subscription_id: subscriptionId,
      p_approve: approve,
      p_rejection_reason: rejectionReason?.trim() || null,
    })
    if (error) throw error
  },

  async listStudentRenewals(): Promise<StudentSubscriptionRenewalSummary[]> {
    const { data, error } = await supabase.rpc('list_student_teacher_subscription_renewals')
    if (error) throw error
    return Array.isArray(data) ? data as unknown as StudentSubscriptionRenewalSummary[] : []
  },

  async createRenewal(subscriptionId: string): Promise<string> {
    const { data, error } = await supabase.rpc('create_student_teacher_subscription_renewal', {
      p_subscription_id: subscriptionId,
    })
    if (error) throw error
    return data
  },

  async getRenewal(renewalId: string): Promise<StudentSubscriptionRenewalDetails> {
    const { data, error } = await supabase.rpc('get_student_teacher_subscription_renewal', {
      p_renewal_id: renewalId,
    })
    if (error) throw error
    const renewal = asJsonObject<StudentSubscriptionRenewalDetails>(data)
    if (!renewal) throw new Error('Renewal not found.')
    return {
      ...renewal,
      payment: renewal.payment
        ? { ...renewal.payment, receipt_url: await signedReceipt(renewal.payment.receipt_path) }
        : null,
    }
  },

  async submitRenewalPayment(input: {
    renewalId: string
    paymentMethodId: string
    transferredAmount: number
    receipt: File
    notes: string
  }): Promise<void> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.receipt.type)) throw new Error('Unsupported receipt type.')
    if (input.receipt.size > 5 * 1024 * 1024) throw new Error('Receipt exceeds the 5 MB limit.')
    if (!Number.isFinite(input.transferredAmount) || input.transferredAmount <= 0) throw new Error('Transferred amount must be positive.')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Authentication is required.')

    const paymentId = crypto.randomUUID()
    const extension = input.receipt.type === 'image/jpeg'
      ? (input.receipt.name.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'jpg')
      : input.receipt.type.split('/')[1]
    const receiptPath = `${user.id}/${input.renewalId}/${paymentId}.${extension}`
    const { error: uploadError } = await supabase.storage.from('student-payment-receipts').upload(receiptPath, input.receipt, {
      cacheControl: '3600', contentType: input.receipt.type, upsert: false,
    })
    if (uploadError) throw uploadError

    const { error } = await supabase.rpc('submit_student_teacher_renewal_payment', {
      p_renewal_id: input.renewalId,
      p_payment_id: paymentId,
      p_payment_method_id: input.paymentMethodId,
      p_transferred_amount: input.transferredAmount,
      p_receipt_path: receiptPath,
      p_notes: input.notes.trim() || null,
    })
    if (error) {
      const { error: cleanupError } = await supabase.storage.from('student-payment-receipts').remove([receiptPath])
      if (cleanupError) console.warn('Could not remove an unsubmitted renewal receipt:', cleanupError)
      throw error
    }
  },

  async listTeacherRenewals(): Promise<TeacherStudentRenewal[]> {
    const { data, error } = await supabase.rpc('list_teacher_student_renewals')
    if (error) throw error
    const renewals = Array.isArray(data) ? data as unknown as TeacherStudentRenewal[] : []
    return Promise.all(renewals.map(async (renewal) => ({
      ...renewal,
      receipt_url: await signedReceipt(renewal.receipt_path),
    })))
  },

  async reviewRenewal(renewalId: string, approve: boolean, rejectionReason?: string): Promise<void> {
    const { error } = await supabase.rpc('review_student_teacher_subscription_renewal', {
      p_renewal_id: renewalId,
      p_approve: approve,
      p_rejection_reason: rejectionReason?.trim() || null,
    })
    if (error) throw error
  },

  async cancelStudentSubscription(subscriptionId: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_student_teacher_subscription', {
      p_subscription_id: subscriptionId,
    })
    if (error) throw error
  },
}

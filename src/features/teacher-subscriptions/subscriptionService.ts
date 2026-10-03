import { supabase } from '@/lib/supabase/client'
import type {
  AdminTeacherPayment,
  PlatformPaymentMethod,
  SubscriptionPlan,
  TeacherPlatformPayment,
  TeacherPlatformSubscription,
} from './types'

const RECEIPT_BUCKET = 'teacher-payment-receipts'
export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024
export const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const subscriptionService = {
  async getTeacherOverview(teacherId: string) {
    const [planResult, methodResult, subscriptionResult, paymentResult] = await Promise.all([
      supabase.from('platform_subscription_plans').select('*').order('duration_months'),
      supabase.from('platform_payment_methods').select('*').order('provider'),
      supabase
        .from('teacher_platform_subscriptions')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false }),
      supabase
        .from('teacher_platform_payments')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('submitted_at', { ascending: false }),
    ])

    const error = planResult.error || methodResult.error || subscriptionResult.error || paymentResult.error
    if (error) throw error

    return {
      plans: (planResult.data ?? []) as SubscriptionPlan[],
      paymentMethods: (methodResult.data ?? []) as PlatformPaymentMethod[],
      subscriptions: (subscriptionResult.data ?? []) as TeacherPlatformSubscription[],
      payments: (paymentResult.data ?? []) as TeacherPlatformPayment[],
    }
  },

  async hasActiveSubscription() {
    const { data, error } = await supabase.rpc('is_teacher_platform_subscription_active')
    if (error) throw error
    return data === true
  },

  async createSubscription(durationMonths: number) {
    const { data, error } = await supabase.rpc('create_teacher_platform_subscription', {
      p_duration_months: durationMonths,
    })
    if (error) throw error
    return data
  },

  async cancelSubscription(subscriptionId: string) {
    const { error } = await supabase.rpc('cancel_teacher_platform_subscription', {
      p_subscription_id: subscriptionId,
    })
    if (error) throw error
  },

  async submitPayment(input: {
    teacherId: string
    subscriptionId: string
    paymentMethodId: string
    transferredAmount: number
    receipt: File
    notes: string
  }) {
    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }
    const extension = extensionByType[input.receipt.type]
    if (!extension || input.receipt.size > MAX_RECEIPT_SIZE) {
      throw new Error('تحقق من نوع الإيصال وحجمه قبل الرفع.')
    }
    const bytes = new Uint8Array(await input.receipt.slice(0, 12).arrayBuffer())
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const isPng = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)
    const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    if (!(isJpeg || isPng || isWebp)) {
      throw new Error('ملف الإيصال ليس صورة JPG أو PNG أو WebP صالحة.')
    }

    const paymentId = crypto.randomUUID()
    const path = `${input.teacherId}/${input.subscriptionId}/${paymentId}.${extension}`
    const { error: uploadError } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .upload(path, input.receipt, { contentType: input.receipt.type, upsert: false })
    if (uploadError) throw uploadError

    const { data, error } = await supabase.rpc('submit_teacher_platform_payment', {
      p_payment_id: paymentId,
      p_subscription_id: input.subscriptionId,
      p_payment_method_id: input.paymentMethodId,
      p_transferred_amount: input.transferredAmount,
      p_receipt_path: path,
      p_notes: input.notes.trim() || null,
    })

    if (error) {
      const { error: cleanupError } = await supabase.storage.from(RECEIPT_BUCKET).remove([path])
      if (cleanupError) console.error('Could not remove an unsubmitted receipt:', cleanupError)
      throw error
    }
    return data
  },

  async getAdminPaymentQueue() {
    const { data, error } = await supabase.rpc('admin_get_teacher_payment_queue')
    if (error) throw error
    return (data ?? []) as AdminTeacherPayment[]
  },

  async getReceiptUrl(path: string) {
    const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 60)
    if (error) throw error
    return data.signedUrl
  },

  async reviewPayment(paymentId: string, approve: boolean, rejectionReason = '') {
    const { error } = await supabase.rpc('admin_review_teacher_payment', {
      p_payment_id: paymentId,
      p_approve: approve,
      p_rejection_reason: rejectionReason || null,
    })
    if (error) throw error
  },

  async savePlan(durationMonths: number, price: number, active: boolean) {
    const { error } = await supabase.rpc('admin_save_subscription_plan', {
      p_duration_months: durationMonths,
      p_price: price,
      p_is_active: active,
    })
    if (error) throw error
  },

  async getAdminPlans() {
    const { data, error } = await supabase
      .from('platform_subscription_plans')
      .select('*')
      .order('duration_months')
    if (error) throw error
    return (data ?? []) as SubscriptionPlan[]
  },

  async savePaymentMethod(input: {
    id: string | null
    provider: string
    accountHolder: string
    accountIdentifier: string
    instructions: string
    active: boolean
  }) {
    const { error } = await supabase.rpc('admin_save_payment_method', {
      p_id: input.id,
      p_provider: input.provider,
      p_account_holder: input.accountHolder,
      p_account_identifier: input.accountIdentifier,
      p_instructions: input.instructions || null,
      p_is_active: input.active,
    })
    if (error) throw error
  },

  async getAdminPaymentMethods() {
    const { data, error } = await supabase
      .from('platform_payment_methods')
      .select('*')
      .order('provider')
    if (error) throw error
    return (data ?? []) as PlatformPaymentMethod[]
  },
}

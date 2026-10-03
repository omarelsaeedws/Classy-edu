export type PaymentProvider =
  | 'INSTAPAY'
  | 'VODAFONE_CASH'
  | 'ORANGE_CASH'
  | 'ETISALAT_CASH'
  | 'WE_PAY'

export type TeacherSubscriptionStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'

export interface SubscriptionPlan {
  id: string
  duration_months: number
  price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PlatformPaymentMethod {
  id: string
  provider: PaymentProvider
  account_holder: string
  account_identifier: string
  instructions: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TeacherPlatformSubscription {
  id: string
  teacher_id: string
  plan_id: string
  duration_months: number
  amount_due: number
  status: TeacherSubscriptionStatus
  created_at: string
  submitted_at: string | null
  approved_at: string | null
  rejected_at: string | null
  expires_at: string | null
  updated_at: string
}

export interface TeacherPlatformPayment {
  id: string
  subscription_id: string
  teacher_id: string
  payment_method_id: string
  transferred_amount: number
  receipt_path: string
  notes: string | null
  status: 'PAYMENT_SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
  rejection_reason: string | null
  created_at: string
  submitted_at: string
  updated_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

export interface AdminTeacherPayment {
  payment_id: string
  subscription_id: string
  teacher_id: string
  teacher_name: string
  teacher_email: string | null
  duration_months: number
  amount_due: number
  transferred_amount: number
  payment_provider: PaymentProvider
  payment_account_identifier: string
  receipt_path: string
  notes: string | null
  payment_status: TeacherPlatformPayment['status']
  subscription_status: TeacherSubscriptionStatus
  rejection_reason: string | null
  submitted_at: string
}

export const PAYMENT_PROVIDERS: { value: PaymentProvider; label: string }[] = [
  { value: 'INSTAPAY', label: 'إنستا باي' },
  { value: 'VODAFONE_CASH', label: 'فودافون كاش' },
  { value: 'ORANGE_CASH', label: 'أورنج كاش' },
  { value: 'ETISALAT_CASH', label: 'اتصالات كاش' },
  { value: 'WE_PAY', label: 'وي باي' },
]

export const getPaymentProviderLabel = (provider: PaymentProvider) =>
  PAYMENT_PROVIDERS.find((item) => item.value === provider)?.label ?? provider

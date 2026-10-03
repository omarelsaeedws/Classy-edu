export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN'
export type TeacherStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'
export type NotificationType =
  | 'STUDENT_SUBSCRIPTION_APPROVED' | 'STUDENT_SUBSCRIPTION_REJECTED' | 'NEW_STUDENT_SUBSCRIPTION_REQUEST'
  | 'TEACHER_PAYMENT_SUBMITTED' | 'TEACHER_SUBSCRIPTION_APPROVED' | 'TEACHER_SUBSCRIPTION_REJECTED'
  | 'STUDENT_PAYMENT_SUBMITTED' | 'SESSION_UPCOMING' | 'SESSION_OPENED' | 'SESSION_CANCELLED'
  | 'SESSION_UPDATED' | 'ATTENDANCE_RECORDED' | 'SUBSCRIPTION_EXPIRING' | 'SUBSCRIPTION_EXPIRED'
  | 'NEW_REVIEW' | 'GROUP_UPDATED' | 'GROUP_ACTIVATED' | 'GROUP_DEACTIVATED' | 'ADMIN_REVIEW_REQUIRED'

export interface Database {
  public: {
    Tables: {
      platform_subscription_plans: {
        Row: { id: string; duration_months: number; price: number; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; duration_months: number; price: number; is_active?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; duration_months?: number; price?: number; is_active?: boolean; created_at?: string; updated_at?: string }
        Relationships: []
      }
      platform_payment_methods: {
        Row: { id: string; provider: string; account_holder: string; account_identifier: string; instructions: string | null; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; provider: string; account_holder: string; account_identifier: string; instructions?: string | null; is_active?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; provider?: string; account_holder?: string; account_identifier?: string; instructions?: string | null; is_active?: boolean; created_at?: string; updated_at?: string }
        Relationships: []
      }
      teacher_platform_subscriptions: {
        Row: { id: string; teacher_id: string; plan_id: string; duration_months: number; amount_due: number; status: string; created_at: string; submitted_at: string | null; approved_at: string | null; rejected_at: string | null; expires_at: string | null; updated_at: string }
        Insert: { id?: string; teacher_id: string; plan_id: string; duration_months: number; amount_due: number; status?: string; created_at?: string; submitted_at?: string | null; approved_at?: string | null; rejected_at?: string | null; expires_at?: string | null; updated_at?: string }
        Update: { id?: string; teacher_id?: string; plan_id?: string; duration_months?: number; amount_due?: number; status?: string; created_at?: string; submitted_at?: string | null; approved_at?: string | null; rejected_at?: string | null; expires_at?: string | null; updated_at?: string }
        Relationships: []
      }
      teacher_platform_payments: {
        Row: { id: string; subscription_id: string; teacher_id: string; payment_method_id: string; transferred_amount: number; receipt_path: string; notes: string | null; status: string; rejection_reason: string | null; created_at: string; submitted_at: string; updated_at: string; reviewed_at: string | null; reviewed_by: string | null }
        Insert: { id?: string; subscription_id: string; teacher_id: string; payment_method_id: string; transferred_amount: number; receipt_path: string; notes?: string | null; status?: string; rejection_reason?: string | null; created_at?: string; submitted_at?: string; updated_at?: string; reviewed_at?: string | null; reviewed_by?: string | null }
        Update: { id?: string; subscription_id?: string; teacher_id?: string; payment_method_id?: string; transferred_amount?: number; receipt_path?: string; notes?: string | null; status?: string; rejection_reason?: string | null; created_at?: string; submitted_at?: string; updated_at?: string; reviewed_at?: string | null; reviewed_by?: string | null }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          role: UserRole
          teacher_status: TeacherStatus | null
          onboarding_completed: boolean
          profile_setup_completed: boolean
          stage: string | null
          grade: string | null
          subjects: string[] | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          phone?: string | null
          role?: UserRole
          teacher_status?: TeacherStatus | null
          onboarding_completed?: boolean
          profile_setup_completed?: boolean
          stage?: string | null
          grade?: string | null
          subjects?: string[] | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string | null
          role?: UserRole
          teacher_status?: TeacherStatus | null
          onboarding_completed?: boolean
          profile_setup_completed?: boolean
          stage?: string | null
          grade?: string | null
          subjects?: string[] | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: { id: string; user_id: string; type: NotificationType; title: string; message: string; is_read: boolean; metadata: Json; dedupe_key: string; created_at: string }
        Insert: { id?: string; user_id: string; type: NotificationType; title: string; message: string; is_read?: boolean; metadata?: Json; dedupe_key: string; created_at?: string }
        Update: { id?: string; user_id?: string; type?: NotificationType; title?: string; message?: string; is_read?: boolean; metadata?: Json; dedupe_key?: string; created_at?: string }
        Relationships: []
      }
      teacher_profiles: {
        Row: { teacher_id: string; subject: string; subjects: string[]; semester: 'FIRST' | 'SECOND' | 'BOTH'; teaching_address: string; bio: string; lesson_title: string | null; monthly_price: number | null; teaching_area: string; created_at: string; updated_at: string }
        Insert: { teacher_id: string; subject: string; subjects?: string[]; semester: 'FIRST' | 'SECOND' | 'BOTH'; teaching_address: string; bio?: string; lesson_title?: string | null; monthly_price?: number | null; teaching_area?: string; created_at?: string; updated_at?: string }
        Update: { teacher_id?: string; subject?: string; subjects?: string[]; semester?: 'FIRST' | 'SECOND' | 'BOTH'; teaching_address?: string; bio?: string; lesson_title?: string | null; monthly_price?: number | null; teaching_area?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      teacher_schedule_slots: {
        Row: { id: string; teacher_id: string; weekday: number; starts_at: string; ends_at: string; created_at: string }
        Insert: { id?: string; teacher_id: string; weekday: number; starts_at: string; ends_at: string; created_at?: string }
        Update: { id?: string; teacher_id?: string; weekday?: number; starts_at?: string; ends_at?: string; created_at?: string }
        Relationships: []
      }
      teacher_groups: {
        Row: { id: string; teacher_id: string; name: string; subject: string; educational_stage: string | null; grade: string | null; max_students: number; status: 'ACTIVE' | 'INACTIVE'; created_at: string; updated_at: string }
        Insert: { id?: string; teacher_id: string; name: string; subject: string; educational_stage?: string | null; grade?: string | null; max_students: number; status?: 'ACTIVE' | 'INACTIVE'; created_at?: string; updated_at?: string }
        Update: { id?: string; teacher_id?: string; name?: string; subject?: string; educational_stage?: string | null; grade?: string | null; max_students?: number; status?: 'ACTIVE' | 'INACTIVE'; created_at?: string; updated_at?: string }
        Relationships: []
      }
      teacher_group_schedule_slots: {
        Row: { id: string; group_id: string; weekday: number; start_time: string; end_time: string; created_at: string }
        Insert: { id?: string; group_id: string; weekday: number; start_time: string; end_time: string; created_at?: string }
        Update: { id?: string; group_id?: string; weekday?: number; start_time?: string; end_time?: string; created_at?: string }
        Relationships: []
      }
      teacher_student_payment_methods: {
        Row: { id: string; teacher_id: string; provider: string; account_holder: string; account_identifier: string; instructions: string | null; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; teacher_id: string; provider: string; account_holder: string; account_identifier: string; instructions?: string | null; is_active?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; teacher_id?: string; provider?: string; account_holder?: string; account_identifier?: string; instructions?: string | null; is_active?: boolean; created_at?: string; updated_at?: string }
        Relationships: []
      }
      student_teacher_subscriptions: {
        Row: { id: string; student_id: string; teacher_id: string; group_id: string; monthly_price_snapshot: number; status: 'PENDING_PAYMENT' | 'UNDER_REVIEW' | 'ACTIVE' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'; created_at: string; updated_at: string; submitted_at: string | null; approved_at: string | null; rejected_at: string | null; started_at: string | null; expires_at: string | null; reviewed_by: string | null; rejection_reason: string | null }
        Insert: { id?: string; student_id: string; teacher_id: string; group_id: string; monthly_price_snapshot: number; status?: 'PENDING_PAYMENT' | 'UNDER_REVIEW' | 'ACTIVE' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'; created_at?: string; updated_at?: string; submitted_at?: string | null; approved_at?: string | null; rejected_at?: string | null; started_at?: string | null; expires_at?: string | null; reviewed_by?: string | null; rejection_reason?: string | null }
        Update: { id?: string; student_id?: string; teacher_id?: string; group_id?: string; monthly_price_snapshot?: number; status?: 'PENDING_PAYMENT' | 'UNDER_REVIEW' | 'ACTIVE' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'; created_at?: string; updated_at?: string; submitted_at?: string | null; approved_at?: string | null; rejected_at?: string | null; started_at?: string | null; expires_at?: string | null; reviewed_by?: string | null; rejection_reason?: string | null }
        Relationships: []
      }
      student_teacher_payments: {
        Row: { id: string; subscription_id: string; student_id: string; teacher_id: string; payment_method_id: string; transferred_amount: number; receipt_path: string; provider_snapshot: string; account_holder_snapshot: string; account_identifier_snapshot: string; instructions_snapshot: string | null; notes: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED'; rejection_reason: string | null; created_at: string; submitted_at: string; updated_at: string; reviewed_at: string | null; reviewed_by: string | null }
        Insert: { id: string; subscription_id: string; student_id: string; teacher_id: string; payment_method_id: string; transferred_amount: number; receipt_path: string; provider_snapshot: string; account_holder_snapshot: string; account_identifier_snapshot: string; instructions_snapshot?: string | null; notes?: string | null; status?: 'PENDING' | 'APPROVED' | 'REJECTED'; rejection_reason?: string | null; created_at?: string; submitted_at?: string; updated_at?: string; reviewed_at?: string | null; reviewed_by?: string | null }
        Update: { id?: string; subscription_id?: string; student_id?: string; teacher_id?: string; payment_method_id?: string; transferred_amount?: number; receipt_path?: string; provider_snapshot?: string; account_holder_snapshot?: string; account_identifier_snapshot?: string; instructions_snapshot?: string | null; notes?: string | null; status?: 'PENDING' | 'APPROVED' | 'REJECTED'; rejection_reason?: string | null; created_at?: string; submitted_at?: string; updated_at?: string; reviewed_at?: string | null; reviewed_by?: string | null }
        Relationships: []
      }
      reviews: {
        Row: { id: string; student_id: string; teacher_id: string; subscription_id: string; rating: number; comment: string | null; is_visible: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; student_id: string; teacher_id: string; subscription_id: string; rating: number; comment?: string | null; is_visible?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; student_id?: string; teacher_id?: string; subscription_id?: string; rating?: number; comment?: string | null; is_visible?: boolean; created_at?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: 'reviews_student_id_fkey'; columns: ['student_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'reviews_teacher_id_fkey'; columns: ['teacher_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'reviews_subscription_owner_fk'; columns: ['subscription_id', 'student_id', 'teacher_id']; isOneToOne: false; referencedRelation: 'student_teacher_subscriptions'; referencedColumns: ['id', 'student_id', 'teacher_id'] }
        ]
      }
      class_sessions: {
        Row: { id: string; group_id: string; teacher_id: string; session_date: string; start_time: string; end_time: string; status: 'SCHEDULED' | 'OPEN' | 'COMPLETED' | 'CANCELLED'; attendance_open: boolean; attendance_code: string | null; attendance_code_expires_at: string | null; opened_at: string | null; closed_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; group_id: string; teacher_id: string; session_date: string; start_time: string; end_time: string; status?: 'SCHEDULED' | 'OPEN' | 'COMPLETED' | 'CANCELLED'; attendance_open?: boolean; attendance_code?: string | null; attendance_code_expires_at?: string | null; opened_at?: string | null; closed_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; group_id?: string; teacher_id?: string; session_date?: string; start_time?: string; end_time?: string; status?: 'SCHEDULED' | 'OPEN' | 'COMPLETED' | 'CANCELLED'; attendance_open?: boolean; attendance_code?: string | null; attendance_code_expires_at?: string | null; opened_at?: string | null; closed_at?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      class_attendance: {
        Row: { id: string; session_id: string; student_id: string; status: 'PRESENT' | 'LATE' | 'ABSENT'; attended_at: string; created_at: string; updated_at: string }
        Insert: { id?: string; session_id: string; student_id: string; status?: 'PRESENT' | 'LATE' | 'ABSENT'; attended_at?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; session_id?: string; student_id?: string; status?: 'PRESENT' | 'LATE' | 'ABSENT'; attended_at?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      update_my_account_profile: { Args: { p_full_name: string; p_phone: string }; Returns: undefined }
      get_teacher_phase09_analytics: { Args: { p_start?: string | null; p_end?: string | null; p_group_id?: string | null }; Returns: Json }
      get_admin_phase09_analytics: { Args: { p_start?: string | null; p_end?: string | null }; Returns: Json }
      admin_list_records: { Args: { p_entity: string; p_query?: string | null; p_status?: string | null; p_secondary_status?: string | null; p_stage?: string | null; p_subject?: string | null; p_from?: string | null; p_to?: string | null; p_offset?: number; p_limit?: number }; Returns: Json }
      admin_get_record_details: { Args: { p_entity: string; p_id: string }; Returns: Json }
      admin_set_review_visibility: { Args: { p_review_id: string; p_is_visible: boolean }; Returns: undefined }
      admin_list_audit_logs: { Args: { p_query?: string | null; p_action?: string | null; p_target_type?: string | null; p_from?: string | null; p_to?: string | null; p_offset?: number; p_limit?: number }; Returns: Json }
      is_classy_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_teacher_platform_subscription_active: { Args: Record<PropertyKey, never>; Returns: boolean }
      create_teacher_platform_subscription: { Args: { p_duration_months: number }; Returns: string }
      submit_teacher_platform_payment: {
        Args: { p_payment_id: string; p_subscription_id: string; p_payment_method_id: string; p_transferred_amount: number; p_receipt_path: string; p_notes?: string | null }
        Returns: string
      }
      cancel_teacher_platform_subscription: { Args: { p_subscription_id: string }; Returns: undefined }
      admin_save_subscription_plan: { Args: { p_duration_months: number; p_price: number; p_is_active: boolean }; Returns: undefined }
      admin_save_payment_method: {
        Args: { p_id: string | null; p_provider: string; p_account_holder: string; p_account_identifier: string; p_instructions: string | null; p_is_active: boolean }
        Returns: string
      }
      admin_get_teacher_payment_queue: {
        Args: Record<PropertyKey, never>
        Returns: { payment_id: string; subscription_id: string; teacher_id: string; teacher_name: string; teacher_email: string | null; duration_months: number; amount_due: number; transferred_amount: number; payment_provider: string; payment_account_identifier: string; receipt_path: string; notes: string | null; payment_status: string; subscription_status: string; rejection_reason: string | null; submitted_at: string }[]
      }
      admin_review_teacher_payment: { Args: { p_payment_id: string; p_approve: boolean; p_rejection_reason?: string | null }; Returns: undefined }
      expire_teacher_platform_subscriptions: { Args: Record<PropertyKey, never>; Returns: number }
      is_active_teacher_profile: { Args: { p_teacher_id: string }; Returns: boolean }
      save_teacher_profile: { Args: { p_subject: string; p_semester: 'FIRST' | 'SECOND' | 'BOTH'; p_teaching_address: string; p_schedule: Json }; Returns: undefined }
      save_teacher_group: { Args: { p_group_id: string | null; p_name: string; p_subject: string; p_educational_stage: string; p_grade: string; p_schedule: Json; p_max_students: number }; Returns: string }
      set_teacher_group_status: { Args: { p_group_id: string; p_status: 'ACTIVE' | 'INACTIVE' }; Returns: undefined }
      delete_teacher_group: { Args: { p_group_id: string }; Returns: string }
      save_teacher_workspace: { Args: { p_full_name: string; p_phone: string; p_avatar_url: string | null; p_subjects: string[]; p_semester: 'FIRST' | 'SECOND' | 'BOTH'; p_teaching_address: string; p_availability: Json }; Returns: undefined }
      save_teacher_workspace_phase05: { Args: { p_full_name: string; p_phone: string; p_avatar_path: string | null; p_subjects: string[]; p_semester: 'FIRST' | 'SECOND' | 'BOTH'; p_teaching_address: string; p_bio: string; p_lesson_title: string; p_teaching_area: string; p_monthly_price: number }; Returns: undefined }
      complete_student_onboarding: { Args: { p_stage: string; p_grade: string; p_subjects?: string[] }; Returns: undefined }
      list_student_teachers: { Args: { p_stage?: string | null; p_grade?: string | null; p_subject?: string | null; p_area?: string | null; p_search?: string | null }; Returns: { teacher_id: string; full_name: string; avatar_path: string | null; subjects: string[]; teaching_area: string; teaching_address: string; lesson_title: string; bio: string; monthly_price: number; groups: Json }[] }
      get_student_teacher_details: { Args: { p_teacher_id: string }; Returns: Json }
      create_student_subscription_request: { Args: { p_group_id: string }; Returns: string }
      submit_student_teacher_payment: { Args: { p_payment_id: string; p_subscription_id: string; p_payment_method_id: string; p_transferred_amount: number; p_receipt_path: string; p_notes?: string | null }; Returns: string }
      list_student_teacher_subscriptions: { Args: Record<PropertyKey, never>; Returns: { subscription_id: string; teacher_id: string; teacher_name: string; teacher_avatar_path: string | null; group_id: string; group_name: string; subject: string; educational_stage: string; grade: string; monthly_price: number; status: string; requested_at: string; started_at: string | null; expires_at: string | null; rejection_reason: string | null }[] }
      get_student_teacher_subscription: { Args: { p_subscription_id: string }; Returns: Json }
      list_teacher_student_subscriptions: { Args: Record<PropertyKey, never>; Returns: { subscription_id: string; student_name: string; group_name: string; subject: string; educational_stage: string; grade: string; monthly_price: number; subscription_status: string; payment_id: string | null; transferred_amount: number | null; payment_provider: string | null; account_holder: string | null; account_identifier: string | null; payment_status: string | null; submitted_at: string | null; receipt_path: string | null; rejection_reason: string | null }[] }
      review_student_teacher_subscription: { Args: { p_subscription_id: string; p_approve: boolean; p_rejection_reason?: string | null }; Returns: undefined }
      create_teacher_class_session: { Args: { p_group_id: string; p_session_date: string; p_start_time: string; p_end_time: string }; Returns: string }
      open_teacher_class_attendance: { Args: { p_session_id: string }; Returns: Json }
      close_teacher_class_session: { Args: { p_session_id: string }; Returns: undefined }
      extend_teacher_class_attendance: { Args: { p_session_id: string }; Returns: Json }
      cancel_teacher_class_session: { Args: { p_session_id: string }; Returns: undefined }
      list_teacher_class_sessions: { Args: Record<PropertyKey, never>; Returns: Json }
      get_teacher_class_session: { Args: { p_session_id: string }; Returns: Json }
      get_teacher_session_attendance: { Args: { p_session_id: string }; Returns: Json }
      list_student_class_sessions: { Args: Record<PropertyKey, never>; Returns: Json }
      list_student_weekly_group_schedules: { Args: Record<PropertyKey, never>; Returns: Json }
      get_student_attendance_summary: { Args: Record<PropertyKey, never>; Returns: Json }
      list_student_attendance_subjects: { Args: Record<PropertyKey, never>; Returns: Json }
      get_student_subject_attendance: { Args: { p_subject: string }; Returns: Json }
      get_student_subscription_attendance: { Args: { p_subscription_id: string }; Returns: Json }
      list_teacher_attendance_students: { Args: { p_search?: string | null }; Returns: Json }
      get_teacher_student_attendance: { Args: { p_student_id: string }; Returns: Json }
      create_student_teacher_subscription_renewal: { Args: { p_subscription_id: string }; Returns: string }
      submit_student_teacher_renewal_payment: { Args: { p_renewal_id: string; p_payment_id: string; p_payment_method_id: string; p_transferred_amount: number; p_receipt_path: string; p_notes?: string | null }; Returns: string }
      get_student_teacher_subscription_renewal: { Args: { p_renewal_id: string }; Returns: Json }
      list_student_teacher_subscription_renewals: { Args: Record<PropertyKey, never>; Returns: Json }
      list_teacher_student_renewals: { Args: Record<PropertyKey, never>; Returns: Json }
      review_student_teacher_subscription_renewal: { Args: { p_renewal_id: string; p_approve: boolean; p_rejection_reason?: string | null }; Returns: undefined }
      cancel_student_teacher_subscription: { Args: { p_subscription_id: string }; Returns: undefined }
      purge_account_related_data: { Args: { p_user_id: string }; Returns: undefined }
      get_public_teacher_reviews: { Args: { p_teacher_id: string; p_offset?: number; p_limit?: number }; Returns: Json }
      get_public_teacher_review_summaries: { Args: { p_teacher_ids: string[] }; Returns: Json }
      get_landing_teacher_preview: { Args: Record<PropertyKey, never>; Returns: Json }
      get_public_teacher_profile: { Args: { p_teacher_id: string }; Returns: Json }
      get_student_teacher_review: { Args: { p_teacher_id: string }; Returns: Json }
      create_student_teacher_review: { Args: { p_teacher_id: string; p_rating: number; p_comment?: string | null }; Returns: string }
      update_student_teacher_review: { Args: { p_review_id: string; p_rating: number; p_comment?: string | null }; Returns: undefined }
      list_student_reviews: { Args: Record<PropertyKey, never>; Returns: Json }
      get_teacher_review_dashboard: { Args: Record<PropertyKey, never>; Returns: Json }
      process_classy_notification_schedule: { Args: Record<PropertyKey, never>; Returns: undefined }
      record_student_attendance: { Args: { p_student_id: string; p_session_id: string | null; p_attendance_code: string }; Returns: Json }
      complete_google_profile_setup: {
        Args: { selected_role: 'STUDENT' | 'TEACHER'; full_name: string; phone: string }
        Returns: undefined
      }
    }
    Enums: {
      user_role: UserRole
      teacher_status: TeacherStatus
    }
    CompositeTypes: Record<string, never>
  }
}

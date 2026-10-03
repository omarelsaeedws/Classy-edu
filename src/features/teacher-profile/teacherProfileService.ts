import { supabase } from '@/lib/supabase/client'
import type { TeacherProfileData, TeacherSemester, TeacherStudentPaymentMethod } from './types'
import type { PaymentProvider } from '@/features/teacher-subscriptions/types'

export const teacherProfileService = {
  async getOwnProfile(): Promise<TeacherProfileData> {
    const [profileResult, accountResult] = await Promise.all([
      supabase.from('teacher_profiles').select('*').maybeSingle(),
      supabase.from('profiles').select('full_name, phone, avatar_url').maybeSingle(),
    ])

    if (profileResult.error) throw profileResult.error
    if (accountResult.error) throw accountResult.error
    const avatarPath = accountResult.data?.avatar_url ?? null
    let avatarUrl: string | null = null
    if (avatarPath) {
      const { data, error } = await supabase.storage.from('teacher-avatars').createSignedUrl(avatarPath, 3600)
      if (error) console.error('Could not create a signed teacher portrait URL:', error)
      else avatarUrl = data.signedUrl
    }

    return {
      profile: profileResult.data,
      account: accountResult.data ? { ...accountResult.data, avatar_path: avatarPath, avatar_url: avatarUrl } : null,
    }
  },

  async saveWorkspace(input: {
    fullName: string
    phone: string
    avatarPath: string | null
    avatarFile: File | null
    subjects: string[]
    semester: TeacherSemester
    teachingAddress: string
    bio: string
    lessonTitle: string
    teachingArea: string
    monthlyPrice: number
  }) {
    let uploadedAvatarPath: string | null = null
    let avatarPath = input.avatarPath
    let actorId: string | null = null
    if (input.avatarFile) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.avatarFile.type)) {
        throw new Error('Unsupported image type.')
      }
      if (input.avatarFile.size > 2 * 1024 * 1024) throw new Error('Image exceeds the 2 MB limit.')

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('Authentication is required.')
      actorId = user.id
      const extension = input.avatarFile.type === 'image/jpeg' ? 'jpg' : input.avatarFile.type.split('/')[1]
      uploadedAvatarPath = `${user.id}/${crypto.randomUUID()}.${extension}`
      avatarPath = uploadedAvatarPath
      const { error: uploadError } = await supabase.storage.from('teacher-avatars').upload(uploadedAvatarPath, input.avatarFile, {
        cacheControl: '3600',
        contentType: input.avatarFile.type,
        upsert: false,
      })
      if (uploadError) throw uploadError
    }

    const { error } = await supabase.rpc('save_teacher_workspace_phase05', {
      p_full_name: input.fullName.trim(),
      p_phone: input.phone.trim(),
      p_avatar_path: avatarPath,
      p_subjects: input.subjects.map((subject) => subject.trim()),
      p_semester: input.semester,
      p_teaching_address: input.teachingAddress.trim(),
      p_bio: input.bio.trim(),
      p_lesson_title: input.lessonTitle.trim(),
      p_teaching_area: input.teachingArea.trim(),
      p_monthly_price: input.monthlyPrice,
    })

    if (error) {
      if (uploadedAvatarPath) await supabase.storage.from('teacher-avatars').remove([uploadedAvatarPath])
      throw error
    }

    if (uploadedAvatarPath && input.avatarPath?.startsWith(`${actorId}/`)) {
      const { error: cleanupError } = await supabase.storage.from('teacher-avatars').remove([input.avatarPath])
      if (cleanupError) console.warn('Could not remove the previous teacher portrait:', cleanupError)
    }
  },

  async getPaymentMethods(): Promise<TeacherStudentPaymentMethod[]> {
    const { data, error } = await supabase.from('teacher_student_payment_methods')
      .select('id, provider, account_holder, account_identifier, instructions, is_active')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as TeacherStudentPaymentMethod[]
  },

  async savePaymentMethod(input: {
    id?: string
    provider: PaymentProvider
    accountHolder: string
    accountIdentifier: string
    instructions: string
    isActive: boolean
  }): Promise<void> {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('Authentication is required.')

    const values = {
      teacher_id: user.id,
      provider: input.provider,
      account_holder: input.accountHolder.trim(),
      account_identifier: input.accountIdentifier.trim(),
      instructions: input.instructions.trim() || null,
      is_active: input.isActive,
    }
    const query = input.id
      ? supabase.from('teacher_student_payment_methods').update(values).eq('id', input.id)
      : supabase.from('teacher_student_payment_methods').insert(values)
    const { error } = await query
    if (error) throw error
  },

  async setPaymentMethodActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase.from('teacher_student_payment_methods')
      .update({ is_active: isActive }).eq('id', id)
    if (error) throw error
  },

  async deletePaymentMethod(id: string): Promise<void> {
    const { error } = await supabase.from('teacher_student_payment_methods').delete().eq('id', id)
    if (error) throw error
  },
}

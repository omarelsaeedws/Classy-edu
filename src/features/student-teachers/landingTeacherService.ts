import { supabase } from '@/lib/supabase/client'

export interface LandingTeacher {
  teacher_id: string
  full_name: string
  avatar_path: string | null
  avatar_url: string | null
  subjects: string[]
  teaching_area: string
  lesson_title: string
  monthly_price: number
  average_rating: number | null
  review_count: number
}

export const landingTeacherService = {
  async listTopTeachers(): Promise<LandingTeacher[]> {
    const { data, error } = await supabase.rpc('get_landing_teacher_preview')
    if (error) throw error
    if (!Array.isArray(data)) return []

    const teachers = data as unknown as LandingTeacher[]
    const avatarPaths = [...new Set(teachers.flatMap((teacher) => teacher.avatar_path ? [teacher.avatar_path] : []))]
    if (avatarPaths.length === 0) return teachers.map((teacher) => ({ ...teacher, avatar_url: null }))

    const { data: signedAvatars, error: avatarError } = await supabase
      .storage
      .from('teacher-avatars')
      .createSignedUrls(avatarPaths, 3600)

    if (avatarError) {
      console.error('Could not sign public teacher portraits:', avatarError)
      return teachers.map((teacher) => ({ ...teacher, avatar_url: null }))
    }

    const urlsByPath = new Map(signedAvatars.map(({ path, signedUrl }) => [path, signedUrl]))
    return teachers.map((teacher) => ({
      ...teacher,
      avatar_url: teacher.avatar_path ? urlsByPath.get(teacher.avatar_path) ?? null : null,
    }))
  },
}

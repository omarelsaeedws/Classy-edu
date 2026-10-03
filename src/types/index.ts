export type EducationalStage = 'المرحلة الابتدائية' | 'المرحلة الإعدادية' | 'المرحلة الثانوية'

export interface TeacherMock {
  id: string
  name: string
  subject: string
  stage: EducationalStage
  grades: string[]
  area: string
  monthlyPrice: number
  isAvailable: boolean
  avatarUrl: string
}

export type ThemeMode = 'light' | 'dark'

import type { TeacherMock } from '@/types'

/**
 * ============================================================================
 * TEMPORARY MOCK DATA — PHASE 01 ONLY
 * ============================================================================
 * This data is static and used exclusively for UI preview on the Landing Page.
 * It is NOT connected to Supabase or any live database.
 * ============================================================================
 */
export const MOCK_TEACHERS: TeacherMock[] = [
  {
    id: 'teacher-1',
    name: 'أحمد محمد',
    subject: 'مدرس رياضيات',
    stage: 'المرحلة الثانوية',
    grades: ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'],
    area: 'أبو كبير',
    monthlyPrice: 300,
    isAvailable: true,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  },
  {
    id: 'teacher-2',
    name: 'محمود عبد الرحمن',
    subject: 'مدرس فيزياء',
    stage: 'المرحلة الثانوية',
    grades: ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'],
    area: 'أبو كبير',
    monthlyPrice: 350,
    isAvailable: true,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
  },
  {
    id: 'teacher-3',
    name: 'سارة إبراهيم',
    subject: 'مدرسة لغة إنجليزية',
    stage: 'المرحلة الإعدادية',
    grades: ['الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي'],
    area: 'أبو كبير',
    monthlyPrice: 280,
    isAvailable: true,
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
  },
  {
    id: 'teacher-4',
    name: 'طارق حسني',
    subject: 'مدرس كيمياء',
    stage: 'المرحلة الثانوية',
    grades: ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'],
    area: 'أبو كبير',
    monthlyPrice: 320,
    isAvailable: true,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
  },
]

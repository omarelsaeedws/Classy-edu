export interface TeacherReviewSummary {
  average_rating: number | null
  review_count: number
}

export interface TeacherReviewDistribution {
  rating: number
  count: number
}

export interface PublicTeacherReview {
  display_name: string
  rating: number
  comment: string | null
  created_at: string
}

export interface PublicTeacherReviewPage {
  summary: TeacherReviewSummary
  distribution: TeacherReviewDistribution[]
  reviews: PublicTeacherReview[]
  has_more: boolean
}

export interface EditableTeacherReview {
  id: string
  rating: number
  comment: string | null
  created_at: string
  updated_at: string
}

export interface StudentTeacherReviewStatus {
  eligible: boolean
  review: EditableTeacherReview | null
}

export interface StudentReviewListItem extends EditableTeacherReview {
  teacher_id: string
  teacher_name: string
  lesson_title: string | null
}

export interface TeacherReviewDashboard {
  average_rating: number | null
  review_count: number
  recent_reviews: PublicTeacherReview[]
}

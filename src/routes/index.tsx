import React from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { HomePage } from '@/pages/Home/HomePage'
import { LoginPage } from '@/pages/Auth/LoginPage'
import { RegisterPage } from '@/pages/Auth/RegisterPage'
import { AuthCallbackPage } from '@/pages/Auth/AuthCallbackPage'
import { CompleteAccountSetupPage } from '@/pages/Auth/CompleteAccountSetupPage'
import { StudentOnboardingPage } from '@/pages/Student/StudentOnboardingPage'
import { StudentDashboardPlaceholder } from '@/pages/Student/StudentDashboardPlaceholder'
import { StudentTeachersPage } from '@/pages/Student/StudentTeachersPage'
import { TeacherDetailsPage } from '@/pages/Student/TeacherDetailsPage'
import { StudentSubscriptionsPage } from '@/pages/Student/StudentSubscriptionsPage'
import { StudentSubscriptionDetailsPage } from '@/pages/Student/StudentSubscriptionDetailsPage'
import { StudentAttendancePage } from '@/pages/Student/StudentAttendancePage'
import { StudentAttendanceHistoryPage } from '@/pages/Student/StudentAttendanceHistoryPage'
import { StudentSubscriptionRenewalPage } from '@/pages/Student/StudentSubscriptionRenewalPage'
import { TeacherPendingPage } from '@/pages/Teacher/TeacherPendingPage'
import { TeacherDashboardPlaceholder } from '@/pages/Teacher/TeacherDashboardPlaceholder'
import { TeacherSubscriptionPage } from '@/pages/Teacher/TeacherSubscriptionPage'
import { TeacherProfilePage } from '@/pages/Teacher/TeacherProfilePage'
import { TeacherStudentRequestsPage } from '@/pages/Teacher/TeacherStudentRequestsPage'
import { TeacherGroupFormPage, TeacherGroupsPage } from '@/pages/Teacher/TeacherGroupsPage'
import { TeacherSessionsPage } from '@/pages/Teacher/TeacherSessionsPage'
import { TeacherSessionAttendancePage } from '@/pages/Teacher/TeacherSessionAttendancePage'
import { TeacherAttendanceHistoryPage } from '@/pages/Teacher/TeacherAttendanceHistoryPage'
import { AdminDashboardPlaceholder } from '@/pages/Admin/AdminDashboardPlaceholder'
import { AdminLoginPage } from '@/pages/Admin/AdminLoginPage'
import { TeacherPaymentReviewPage } from '@/pages/Admin/TeacherPaymentReviewPage'
import { SubscriptionPlanSettingsPage } from '@/pages/Admin/SubscriptionPlanSettingsPage'
import { PaymentMethodSettingsPage } from '@/pages/Admin/PaymentMethodSettingsPage'
import { AdminShell } from '@/pages/Admin/AdminShell'
import { AdminManagementPage } from '@/pages/Admin/AdminManagementPage'
import { AdminRecordDetailsPage } from '@/pages/Admin/AdminRecordDetailsPage'
import { AdminSettingsPage } from '@/pages/Admin/AdminSettingsPage'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleRoute } from './RoleRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'
import { ActiveTeacherRoute } from './ActiveTeacherRoute'
import { NotificationProvider } from '@/features/notifications/NotificationProvider'
import { NotificationsPage } from '@/pages/Notifications/NotificationsPage'
import { AccountSettingsPage } from '@/pages/Account/AccountSettingsPage'

/**
 * Layout wrapper that provides AuthProvider within the router context.
 */
const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <AuthProvider><NotificationProvider>{children}</NotificationProvider></AuthProvider>
}

const AdminPage: React.FC<{ children: React.ReactNode }> = ({ children }) => <ProtectedRoute loginPath="/admin/login"><RoleRoute allowedRole="ADMIN"><AdminShell>{children}</AdminShell></RoleRoute></ProtectedRoute>

/**
 * React Router configuration for the Classy platform.
 * Includes Public, Protected, and Role-Based routes.
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  // Public-only auth routes
  {
    path: '/login',
    element: (
      <AuthLayout>
        <PublicOnlyRoute>
          <LoginPage />
        </PublicOnlyRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/register',
    element: (
      <AuthLayout>
        <PublicOnlyRoute>
          <RegisterPage />
        </PublicOnlyRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/auth/callback',
    element: (
      <AuthLayout>
        <AuthCallbackPage />
      </AuthLayout>
    ),
  },
  {
    path: '/register/complete',
    element: (
      <AuthLayout>
        <ProtectedRoute>
          <CompleteAccountSetupPage />
        </ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/notifications',
    element: (
      <AuthLayout>
        <ProtectedRoute><NotificationsPage /></ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/admin/login',
    element: (
      <AuthLayout>
        <PublicOnlyRoute>
          <AdminLoginPage />
        </PublicOnlyRoute>
      </AuthLayout>
    ),
  },
  // Student routes
  {
    path: '/student',
    element: (
      <AuthLayout>
        <ProtectedRoute>
          <RoleRoute allowedRole="STUDENT">
            <StudentDashboardPlaceholder />
          </RoleRoute>
        </ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/student/settings',
    element: <AuthLayout><ProtectedRoute><RoleRoute allowedRole="STUDENT"><AccountSettingsPage /></RoleRoute></ProtectedRoute></AuthLayout>,
  },
  {
    path: '/student/onboarding',
    element: (
      <AuthLayout>
        <ProtectedRoute>
          <RoleRoute allowedRole="STUDENT" allowOnboardingOnly={true}>
            <StudentOnboardingPage />
          </RoleRoute>
        </ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/student/teachers',
    element: (
      <AuthLayout>
        <ProtectedRoute><RoleRoute allowedRole="STUDENT"><StudentTeachersPage /></RoleRoute></ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/teachers/:id',
    element: (
      <AuthLayout>
        <TeacherDetailsPage />
      </AuthLayout>
    ),
  },
  {
    path: '/student/subscriptions',
    element: (
      <AuthLayout>
        <ProtectedRoute><RoleRoute allowedRole="STUDENT"><StudentSubscriptionsPage /></RoleRoute></ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/student/subscriptions/:id',
    element: (
      <AuthLayout>
        <ProtectedRoute><RoleRoute allowedRole="STUDENT"><StudentSubscriptionDetailsPage /></RoleRoute></ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/student/subscriptions/renewals/:renewalId',
    element: (
      <AuthLayout>
        <ProtectedRoute><RoleRoute allowedRole="STUDENT"><StudentSubscriptionRenewalPage /></RoleRoute></ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/student/attendance',
    element: (
      <AuthLayout>
        <ProtectedRoute><RoleRoute allowedRole="STUDENT"><StudentAttendancePage /></RoleRoute></ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/student/attendance/:sessionId',
    element: (
      <AuthLayout>
        <ProtectedRoute><RoleRoute allowedRole="STUDENT"><StudentAttendancePage /></RoleRoute></ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/student/attendance/history',
    element: (
      <AuthLayout>
        <ProtectedRoute><RoleRoute allowedRole="STUDENT"><StudentAttendanceHistoryPage /></RoleRoute></ProtectedRoute>
      </AuthLayout>
    ),
  },
  // Teacher routes
  {
    path: '/teacher',
    element: (
      <AuthLayout>
        <ProtectedRoute>
          <RoleRoute allowedRole="TEACHER">
            <ActiveTeacherRoute>
              <TeacherDashboardPlaceholder />
            </ActiveTeacherRoute>
          </RoleRoute>
        </ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/teacher/settings',
    element: <AuthLayout><ProtectedRoute><RoleRoute allowedRole="TEACHER"><AccountSettingsPage /></RoleRoute></ProtectedRoute></AuthLayout>,
  },
  {
    path: '/teacher/subscription',
    element: (
      <AuthLayout>
        <ProtectedRoute>
          <RoleRoute allowedRole="TEACHER" allowTeacherSubscription={true}>
            <TeacherSubscriptionPage />
          </RoleRoute>
        </ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/teacher/groups',
    element: (
      <AuthLayout>
        <ProtectedRoute>
          <RoleRoute allowedRole="TEACHER">
            <ActiveTeacherRoute>
              <TeacherGroupsPage />
            </ActiveTeacherRoute>
          </RoleRoute>
        </ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/teacher/sessions',
    element: (
      <AuthLayout>
        <ProtectedRoute><RoleRoute allowedRole="TEACHER"><ActiveTeacherRoute><TeacherSessionsPage /></ActiveTeacherRoute></RoleRoute></ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/teacher/sessions/:id/attendance',
    element: (
      <AuthLayout>
        <ProtectedRoute><RoleRoute allowedRole="TEACHER"><ActiveTeacherRoute><TeacherSessionAttendancePage /></ActiveTeacherRoute></RoleRoute></ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/teacher/attendance/history',
    element: (
      <AuthLayout>
        <ProtectedRoute><RoleRoute allowedRole="TEACHER"><ActiveTeacherRoute><TeacherAttendanceHistoryPage /></ActiveTeacherRoute></RoleRoute></ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/teacher/attendance/history/:studentId',
    element: (
      <AuthLayout>
        <ProtectedRoute><RoleRoute allowedRole="TEACHER"><ActiveTeacherRoute><TeacherAttendanceHistoryPage /></ActiveTeacherRoute></RoleRoute></ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/teacher/groups/new',
    element: (
      <AuthLayout>
        <ProtectedRoute>
          <RoleRoute allowedRole="TEACHER">
            <ActiveTeacherRoute>
              <TeacherGroupFormPage />
            </ActiveTeacherRoute>
          </RoleRoute>
        </ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/teacher/groups/:id/edit',
    element: (
      <AuthLayout>
        <ProtectedRoute>
          <RoleRoute allowedRole="TEACHER">
            <ActiveTeacherRoute>
              <TeacherGroupFormPage />
            </ActiveTeacherRoute>
          </RoleRoute>
        </ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/teacher/profile',
    element: (
      <AuthLayout>
        <ProtectedRoute>
          <RoleRoute allowedRole="TEACHER">
            <ActiveTeacherRoute>
              <TeacherProfilePage />
            </ActiveTeacherRoute>
          </RoleRoute>
        </ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/teacher/students',
    element: (
      <AuthLayout>
        <ProtectedRoute>
          <RoleRoute allowedRole="TEACHER">
            <ActiveTeacherRoute><TeacherStudentRequestsPage /></ActiveTeacherRoute>
          </RoleRoute>
        </ProtectedRoute>
      </AuthLayout>
    ),
  },
  {
    path: '/teacher/pending',
    element: (
      <AuthLayout>
        <ProtectedRoute>
          <RoleRoute allowedRole="TEACHER" allowPendingOnly={true}>
            <TeacherPendingPage />
          </RoleRoute>
        </ProtectedRoute>
      </AuthLayout>
    ),
  },
  // Admin route
  {
    path: '/admin',
    element: <AuthLayout><AdminPage><AdminDashboardPlaceholder /></AdminPage></AuthLayout>,
  },
  {
    path: '/admin/subscriptions',
    element: <AuthLayout><AdminPage><TeacherPaymentReviewPage /></AdminPage></AuthLayout>,
  },
  { path: '/admin/teacher-subscriptions', element: <AuthLayout><AdminPage><AdminManagementPage entity="teacher_subscriptions" /></AdminPage></AuthLayout> },
  { path: '/admin/teachers', element: <AuthLayout><AdminPage><AdminManagementPage entity="teachers" /></AdminPage></AuthLayout> },
  { path: '/admin/teachers/:id', element: <AuthLayout><AdminPage><AdminRecordDetailsPage entity="teacher" /></AdminPage></AuthLayout> },
  { path: '/admin/students', element: <AuthLayout><AdminPage><AdminManagementPage entity="students" /></AdminPage></AuthLayout> },
  { path: '/admin/students/:id', element: <AuthLayout><AdminPage><AdminRecordDetailsPage entity="student" /></AdminPage></AuthLayout> },
  { path: '/admin/student-subscriptions', element: <AuthLayout><AdminPage><AdminManagementPage entity="student_subscriptions" /></AdminPage></AuthLayout> },
  { path: '/admin/groups', element: <AuthLayout><AdminPage><AdminManagementPage entity="groups" /></AdminPage></AuthLayout> },
  { path: '/admin/sessions', element: <AuthLayout><AdminPage><AdminManagementPage entity="sessions" /></AdminPage></AuthLayout> },
  { path: '/admin/sessions/:id', element: <AuthLayout><AdminPage><AdminRecordDetailsPage entity="session" /></AdminPage></AuthLayout> },
  { path: '/admin/reviews', element: <AuthLayout><AdminPage><AdminManagementPage entity="reviews" /></AdminPage></AuthLayout> },
  { path: '/admin/audit-logs', element: <AuthLayout><AdminPage><AdminManagementPage entity="audit_logs" /></AdminPage></AuthLayout> },
  { path: '/admin/settings', element: <AuthLayout><AdminPage><AdminSettingsPage /></AdminPage></AuthLayout> },
  {
    path: '/admin/settings/plans',
    element: <AuthLayout><AdminPage><SubscriptionPlanSettingsPage /></AdminPage></AuthLayout>,
  },
  {
    path: '/admin/settings/payment-methods',
    element: <AuthLayout><AdminPage><PaymentMethodSettingsPage /></AdminPage></AuthLayout>,
  },
  // Fallback
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />
}

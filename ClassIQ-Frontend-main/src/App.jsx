import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

// Landing
import LandingPage           from './pages/LandingPage'

// Auth pages
import LoginPage             from './pages/classrep/LoginPage'
import RegisterPage          from './pages/classrep/RegisterPage'
import AdminLoginPage        from './pages/classrep/AdminLoginPage'
import RoleSelectPage        from './pages/auth/RoleSelectPage'
import LecturerRegisterPage  from './pages/lecturer/LecturerRegisterPage'

// Classrep pages
import DashboardPage         from './pages/classrep/DashboardPage'
import GenerateQRPage        from './pages/classrep/GenerateQRPage'
import AttendanceHistoryPage from './pages/classrep/AttendanceHistoryPage'
import ReportIssuePage       from './pages/classrep/ReportIssuePage'

// Lecturer pages
import LecturerDashboardPage         from './pages/lecturer/LecturerDashboardPage'
import LecturerSchedulePage          from './pages/lecturer/LecturerSchedulePage'
import LecturerGenerateQRPage        from './pages/lecturer/LecturerGenerateQRPage'
import LecturerAttendanceHistoryPage from './pages/lecturer/LecturerAttendanceHistoryPage'
import LecturerClassesPage         from './pages/lecturer/LecturerClassesPage'

// Student pages
import MarkAttendancePage    from './pages/student/MarkAttendancePage'
import StudentRegisterPage   from './pages/student/StudentRegisterPage'
import SubscribePage from './pages/student/SubscribePage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'

// Admin pages
import AdminDashboardPage    from './pages/admin/AdminDashboardPage'
import AdminClassrepsPage    from './pages/admin/AdminClassrepsPage'
import AdminLecturersPage    from './pages/admin/AdminLecturersPage'
import AdminStudentsPage     from './pages/admin/AdminStudentsPage'
import AdminAttendancePage   from './pages/admin/AdminAttendancePage'
import AdminQRSessionsPage   from './pages/admin/AdminQRSessionsPage'
import AdminLogsPage         from './pages/admin/AdminLogsPage'
import AdminIssuesPage       from './pages/admin/AdminIssuesPage'
import AdminErrorLogsPage    from './pages/admin/AdminErrorLogsPage'
import AdminSendMessagePage  from './pages/admin/AdminSendMessagePage'
import AdminPushPage         from './pages/admin/AdminPushPage'

// Layouts
import ClassrepLayout        from './components/layout/ClassrepLayout'
import LecturerLayout        from './components/layout/LecturerLayout'
import AdminLayout           from './components/layout/AdminLayout'

function dashboardForRole(role) {
  if (role === 'admin') return '/admin'
  if (role === 'lecturer') return '/lecturer'
  if (role === 'classrep' || role === 'class_rep') return '/dashboard'
  return '/'
}

// ── Smart root redirect based on auth state ──────────────────
function RootRedirect() {
  const { user } = useAuth()
  if (!user) return <LandingPage />
  return <Navigate to={dashboardForRole(user.role)} replace />
}

// ── Protect classrep routes ───────────────────────────────────
function ClassrepRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'classrep' && user.role !== 'class_rep') return <Navigate to={dashboardForRole(user.role)} replace />
  return children
}

// ── Protect lecturer routes ───────────────────────────────────
function LecturerRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'lecturer') return <Navigate to={dashboardForRole(user.role)} replace />
  return children
}

// ── Protect admin routes ──────────────────────────────────────
function AdminRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/admin/login" replace />
  if (user.role !== 'admin') return <Navigate to="/admin/login" replace />
  return children
}

// ── Redirect logged-in users away from auth pages ────────────
function GuestRoute({ children }) {
  const { user } = useAuth()
  if (user) return <Navigate to={dashboardForRole(user.role)} replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          <Route path="/" element={<RootRedirect />} />

          <Route path="/get-started" element={<GuestRoute><RoleSelectPage /></GuestRoute>} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/register/lecturer" element={<GuestRoute><LecturerRegisterPage /></GuestRoute>} />
          <Route path="/admin/login" element={<GuestRoute><AdminLoginPage /></GuestRoute>} />

          <Route path="/mark-attendance" element={<MarkAttendancePage />} />
          <Route path="/student/register" element={<StudentRegisterPage />} />
          <Route path="/subscribe" element={<SubscribePage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/privacy.html" element={<PrivacyPolicyPage />} />

          <Route path="/dashboard" element={
            <ClassrepRoute><ClassrepLayout /></ClassrepRoute>
          }>
            <Route index element={<DashboardPage />} />
            <Route path="generate-qr" element={<GenerateQRPage />} />
            <Route path="attendance" element={<AttendanceHistoryPage />} />
            <Route path="report-issue" element={<ReportIssuePage />} />
          </Route>

          <Route path="/lecturer" element={
            <LecturerRoute><LecturerLayout /></LecturerRoute>
          }>
            <Route index element={<LecturerDashboardPage />} />
            <Route path="classes" element={<LecturerClassesPage />} />
            <Route path="weeks" element={<LecturerSchedulePage />} />
            <Route path="generate-qr" element={<LecturerGenerateQRPage />} />
            <Route path="attendance" element={<LecturerAttendanceHistoryPage />} />
          </Route>

          <Route path="/admin" element={
            <AdminRoute><AdminLayout /></AdminRoute>
          }>
            <Route index element={<AdminDashboardPage />} />
            <Route path="classreps" element={<AdminClassrepsPage />} />
            <Route path="lecturers" element={<AdminLecturersPage />} />
            <Route path="students" element={<AdminStudentsPage />} />
            <Route path="attendance" element={<AdminAttendancePage />} />
            <Route path="qr-sessions" element={<AdminQRSessionsPage />} />
            <Route path="logs" element={<AdminLogsPage />} />
            <Route path="issues" element={<AdminIssuesPage />} />
            <Route path="error-logs" element={<AdminErrorLogsPage />} />
            <Route path="send-message" element={<AdminSendMessagePage />} />
            <Route path="push" element={<AdminPushPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Auto-attach token
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('classiq_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Global 401 handler
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      let redirect = '/login'
      try {
        const stored = JSON.parse(localStorage.getItem('classiq_user') || 'null')
        if (stored?.role === 'admin' || window.location.pathname.startsWith('/admin')) {
          redirect = '/admin/login'
        }
      } catch { /* ignore */ }
      localStorage.removeItem('classiq_token')
      localStorage.removeItem('classiq_user')
      window.location.href = redirect
    } else if (err.response && err.response.status >= 500) {
      fetch('https://api-classiq.onrender.com/system_ping.php', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           message: `API HTTP ${err.response.status}: ${err.config?.url}`,
           stack: typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data),
           url: window.location.href
         })
      }).catch(() => {})
    }
    return Promise.reject(err)
  }
)

export default api

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  login:            data => api.post('/auth/login.php', data),
  register:         data => api.post('/auth/register.php', data),
  registerLecturer: data => api.post('/auth/register_lecturer.php', data),
  logout:           ()   => api.post('/auth/logout.php'),
  adminLogin:       data => api.post('/auth/admin_login.php', data),
}

// ── Classrep ──────────────────────────────────────────────────
export const classrepApi = {
  getDashboard:     ()   => api.get('/classrep/dashboard.php'),
  getStudents:      (p)  => api.get('/classrep/students.php', { params: p }),
  addStudent:       data => api.post('/classrep/students.php', data),
  updateStudent:    data => api.post('/classrep/students.php', { ...data, _method: 'PUT' }),
  deleteStudent:    id   => api.post('/classrep/students.php', { id, _method: 'DELETE' }),
  getStudentDetail: (id) => api.get('/classrep/student_detail.php', { params: { id } }),
  generateQR:       data => api.post('/classrep/generate_qr.php', data),
  endSession:       data => api.post('/classrep/end_session.php', data),
  getAttendance:    (p)  => api.get('/classrep/attendance.php', { params: p }),
  removeAttendance: data => api.post('/classrep/remove_attendance.php', data),
  restoreFlagged:   data => api.post('/classrep/restore_flagged.php', data),
  addToAttendance:  data => api.post('/classrep/add_attendance.php', data),
  reportIssue:      data => api.post('/classrep/report_issue.php', data),
  getMyIssues:      ()   => api.get('/classrep/my_issues.php'),
  
  getSavedLocations: () => api.get('/classrep/saved_locations.php'),
  saveLocation: (data) => api.post('/classrep/saved_locations.php', data),
  deleteSavedLocation: (id) => api.post('/classrep/saved_locations.php', { _method: 'DELETE', id }),
  getSavedLectures: () => api.get('/classrep/saved_lectures.php'),
  saveLecture: (name) => api.post('/classrep/saved_lectures.php', { name }),
  deleteSavedLecture: (id) => api.post('/classrep/saved_lectures.php', { _method: 'DELETE', id }),
}

// ── Lecturer ──────────────────────────────────────────────────
export const lecturerApi = {
  getDashboard:  ()   => api.get('/lecturer/dashboard.php'),
  getCohorts:    ()   => api.get('/lecturer/cohorts.php'),
  addCohort:     data => api.post('/lecturer/cohorts.php', { type: 'cohort', ...data }),
  updateCohort:  data => api.put('/lecturer/cohorts.php', data),
  deleteCohort:  id   => api.delete('/lecturer/cohorts.php', { data: { type: 'cohort', id } }),
  addStudent:    data => api.post('/lecturer/cohorts.php', { type: 'student', ...data }),
  deleteStudent: id   => api.delete('/lecturer/cohorts.php', { data: { type: 'student', id } }),
  getSchedule:   ()   => api.get('/lecturer/schedule.php'),
  addSchedule:   data => api.post('/lecturer/schedule.php', data),
  updateSchedule:data => api.put('/lecturer/schedule.php', data),
  deleteSchedule:(type, id) => api.delete('/lecturer/schedule.php', { data: { type, id } }),
  getWeeks:      ()   => api.get('/lecturer/weeks.php'),
  generateQR:    data => api.post('/lecturer/generate_qr.php', data),
  endSession:    data => api.post('/lecturer/end_session.php', data),
  getAttendance: ()   => api.get('/lecturer/attendance.php'),
  getStudentDetail: (id) => api.get('/lecturer/student_detail.php', { params: { id } }),
  getSavedLocations: () => api.get('/lecturer/saved_locations.php'),
  saveLocation:      data => api.post('/lecturer/saved_locations.php', data),
  deleteSavedLocation: (id) => api.post('/lecturer/saved_locations.php', { _method: 'DELETE', id }),
}

// ── Student ───────────────────────────────────────────────────
export const studentApi = {
  markAttendance:  data => api.post('/student/mark_attendance.php', data),
  register:        data => api.post('/student/register.php', data),
  verifySession:   (p)  => api.get('/student/verify_session.php', { params: p }),
  getClassrepInfo: (id) => api.get('/student/get_classrep_info.php', { params: { classrep_id: id } }),
  getLecturerInfo: (id, classId) => api.get('/student/get_lecturer_info.php', {
    params: { lecturer_id: id, ...(classId ? { class_id: classId } : {}) },
  }),
}

// ── Messages ──────────────────────────────────────────────────
export const messagesApi = {
  getThread:      (issue_id) => api.get('/messages.php', { params: { issue_id } }),
  sendMessage:    (data)     => api.post('/messages.php', data),
  getUnreadCount: ()         => api.get('/messages.php', { params: { unread_count: 1 } }),
}

// ── Admin ─────────────────────────────────────────────────────
export const adminApi = {
  getDashboard:       ()     => api.get('/admin/dashboard.php'),
  getDailyAttendance: (p)    => api.get('/admin/daily_attendance.php', { params: p }),
  getClassreps:       (p)    => api.get('/admin/classreps.php', { params: p }),
  approveClassrep:    (id)   => api.put('/admin/classreps.php', { id, action: 'approve' }),
  rejectClassrep:     (id)   => api.put('/admin/classreps.php', { id, action: 'reject' }),
  updateClassrep:     (data) => api.put('/admin/classreps.php', { ...data, action: 'update' }),
  deleteClassrep:     (id)   => api.delete('/admin/classreps.php', { data: { id } }),
  getLecturers:       (p)    => api.get('/admin/lecturers.php', { params: p }),
  approveLecturer:    (id)   => api.put('/admin/lecturers.php', { id, action: 'approve' }),
  rejectLecturer:     (id)   => api.put('/admin/lecturers.php', { id, action: 'reject' }),
  updateLecturer:     (data) => api.put('/admin/lecturers.php', { ...data, action: 'update' }),
  deleteLecturer:     (id)   => api.delete('/admin/lecturers.php', { data: { id } }),
  getStudents:        (p)    => api.get('/admin/students.php', { params: p }),
  getStudentDetail:   (id)   => api.get('/admin/student_detail.php', { params: { id } }),
  updateStudent:      (data) => api.put('/admin/students.php', data),
  addStudent:         (data) => api.post('/admin/add_student.php', data),
  deleteStudent:      (id)   => api.delete('/admin/students.php', { data: { id } }),
  getDailyAttendance: (p)    => api.get('/admin/daily_attendance.php', { params: p }),
  getQrSessions:      (p)    => api.get('/admin/qr_sessions.php', { params: p }),
  endQrSession:       (data) => api.post('/admin/qr_sessions.php', data),
  getLogs:            (p)    => api.get('/admin/logs.php', { params: p }),
  getIssues:          (p)    => api.get('/admin/issues.php', { params: p }),
  updateIssue:        (data) => api.put('/admin/issues.php', data),
  getErrorLogs:       ()     => api.get('/admin/error_logs.php'),
  getTriviaLeaderboard: (limit = 5) => api.get('/ai/trivia_leaderboard.php', { params: { limit } }),
  resetTriviaLeaderboard: () => api.post('/ai/trivia_reset.php'),
  getAiSettings:        ()     => api.get('/ai/ai_settings.php'),
  updateAiPromptLimit:  (limit) => api.post('/ai/ai_settings.php', { action: 'update_prompt_limit', limit }),
  sendMessage:        (data) => api.post('/admin/send_message.php', data),
  sendBulkSms:        (message) => api.post('/admin/send_bulk_sms.php', { message }),
  sendPush:           (data)    => api.post('/push/send.php', data),
  getPushHistory:     (p)       => api.get('/push/history.php', { params: p }),
  generateVapidKeys:  ()        => api.get('/push/generate_vapid_keys.php'),
  getVapidStatus:     ()        => api.get('/push/vapid_status.php'),
  searchStudents:     (p)    => api.get('/admin/search_students.php', { params: p }),
}
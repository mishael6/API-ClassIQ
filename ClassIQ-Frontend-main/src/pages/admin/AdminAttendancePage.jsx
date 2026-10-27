import { useState, useEffect } from 'react'
import { adminApi } from '../../lib/api'
import { Alert, Modal, Table, Badge } from '../../components/ui'
import {
  Users, CheckCircle, BookOpen, QrCode,
  Clock, ChevronRight, Calendar, TrendingUp
} from 'lucide-react'
import '../../components/ui/components.css'
import './adminattendance.css'

/* ── tiny helpers ── */
const fmt = (n) => n ?? 0
const fmtDuration = (m) => {
  if (!m) return '—'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}
const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

export default function AdminAttendancePage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date,     setDate]     = useState(today)
  const [stats,    setStats]    = useState({})
  const [classreps, setClassreps] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState(null)
  const [students, setStudents] = useState([])
  const [loadingStu, setLoadingStu] = useState(false)

  const load = () => {
    setLoading(true)
    adminApi.getDailyAttendance({ date })
      .then(r => { setStats(r.data.stats || {}); setClassreps(r.data.classreps || []) })
      .catch(() => setError('Failed to load attendance data.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [date])

  const openClassrep = async (cr) => {
    setSelected(cr); setLoadingStu(true)
    try {
      const r = await adminApi.getStudents({ classrep_id: cr.classrep_id, date: date, limit: 300 })
      setStudents(r.data.students || [])
    } catch { setStudents([]) }
    finally { setLoadingStu(false) }
  }

  const isToday = date === today
  const dateLabel = isToday
    ? 'Today'
    : new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="att-page animate-fade-up">

      {/* ── Hero header ── */}
      <div className="att-hero">
        <div className="att-hero-left">
          <div className="att-hero-eyebrow">
            <span className={`att-live-dot ${isToday ? 'live' : 'past'}`} />
            {isToday ? 'Live · Today' : 'Historical View'}
          </div>
          <h1 className="att-hero-title">Attendance Overview</h1>
          <p className="att-hero-date">{dateLabel}</p>
        </div>
        <div className="att-hero-right">
          <label className="att-date-label">Select Date</label>
          <div className="att-date-wrap">
            <Calendar size={15} className="att-date-icon" />
            <input
              type="date"
              className="att-date-input"
              value={date}
              max={today}
              onChange={e => setDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <Alert variant="error" onClose={() => setError('')} style={{ marginBottom: 20 }}>{error}</Alert>}

      {/* ── Stat strip ── */}
      <div className="att-stat-strip">
        <StatPill
          icon={<Users size={18}/>}
          label="Active Class Reps"
          value={loading ? '—' : fmt(stats.active_classreps)}
          color="blue"
          loading={loading}
        />
        <div className="att-stat-divider" />
        <StatPill
          icon={<CheckCircle size={18}/>}
          label="Students Marked"
          value={loading ? '—' : fmt(stats.total_students_marked)}
          color="green"
          loading={loading}
        />
        <div className="att-stat-divider" />
        <StatPill
          icon={<BookOpen size={18}/>}
          label="Lectures Held"
          value={loading ? '—' : fmt(stats.total_lectures)}
          color="purple"
          loading={loading}
        />
        <div className="att-stat-divider" />
        <StatPill
          icon={<TrendingUp size={18}/>}
          label="Avg per Rep"
          value={loading ? '—' : (
            stats.active_classreps > 0
              ? Math.round(fmt(stats.total_students_marked) / fmt(stats.active_classreps))
              : 0
          )}
          color="orange"
          loading={loading}
        />
      </div>

      {/* ── Classrep cards ── */}
      <div className="att-section-head">
        <h2 className="att-section-title">Class Representatives</h2>
        <span className="att-section-sub">
          {classreps.length} active · click a name to view students
        </span>
      </div>

      {loading ? (
        <div className="att-loading">
          {[1,2,3].map(i => <div key={i} className="att-skeleton" style={{ animationDelay: `${i * 0.1}s` }} />)}
        </div>
      ) : classreps.length === 0 ? (
        <div className="att-empty">
          <div className="att-empty-icon">📭</div>
          <p>No attendance activity found for this date.</p>
          <span>Try selecting a different date</span>
        </div>
      ) : (
        <div className="att-cards">
          {classreps.map((cr, i) => (
            <div key={i} className="att-card" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="att-card-top">
                <div className="att-card-identity">
                  <div className="att-card-avatar">
                    {initials(cr.classrep_name)}
                  </div>
                  <div>
                    <button className="att-card-name" onClick={() => openClassrep(cr)}>
                      {cr.classrep_name}
                      <ChevronRight size={14} />
                    </button>
                    <p className="att-card-inst">{cr.institution || 'No institution listed'}</p>
                  </div>
                </div>

                <div className="att-card-lectures">
                  {(cr.lectures || []).map((l, j) => (
                    <span key={j} className="att-lec-badge">{l}</span>
                  ))}
                </div>
              </div>

              <div className="att-card-metrics">
                <Metric icon={<QrCode size={15}/>}    label="QR Codes"   value={cr.qr_count}                 color="blue"   />
                <Metric icon={<Clock size={15}/>}      label="Avg Time"   value={fmtDuration(cr.avg_duration)} color="orange" />
                <Metric icon={<CheckCircle size={15}/>}label="Students"   value={cr.students_marked}           color="green"  />
                <Metric icon={<BookOpen size={15}/>}   label="Lectures"   value={cr.lectures_count}            color="purple" />
              </div>

              {/* Progress bar — students marked vs total (if available) */}
              <div className="att-card-bar-wrap">
                <div className="att-card-bar">
                  <div
                    className="att-card-bar-fill"
                    style={{ width: `${Math.min(100, (cr.students_marked / Math.max(cr.students_marked, 1)) * 100)}%` }}
                  />
                </div>
                <span className="att-card-bar-label">{cr.students_marked} student{cr.students_marked !== 1 ? 's' : ''} marked</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Student modal ── */}
      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setStudents([]) }}
        title=""
        width={740}
      >
        {selected && (
          <div className="att-modal-inner">
            <div className="att-modal-head">
              <div className="att-modal-avatar">{initials(selected.classrep_name)}</div>
              <div>
                <h3 className="att-modal-name">{selected.classrep_name}</h3>
                <p className="att-modal-inst">{selected.institution || ''}</p>
              </div>
              <div className="att-modal-stats">
                <div className="att-ms">
                  <span className="att-ms-v">{loadingStu ? '…' : students.length}</span>
                  <span className="att-ms-l">Registered</span>
                </div>
                <div className="att-ms">
                  <span className="att-ms-v" style={{ color: 'var(--green)' }}>{selected.students_marked}</span>
                  <span className="att-ms-l">Marked Today</span>
                </div>
                <div className="att-ms">
                  <span className="att-ms-v" style={{ color: 'var(--purple)' }}>{selected.lectures_count}</span>
                  <span className="att-ms-l">Lectures</span>
                </div>
              </div>
            </div>

            {loadingStu ? (
              <div className="att-loading" style={{ padding: '32px 0' }}>
                {[1,2,3].map(i => <div key={i} className="att-skeleton" />)}
              </div>
            ) : (
              <Table
                columns={[
                  { key: 'name',         label: 'Name' },
                  { key: 'index_number', label: 'Index No.' },
                  { key: 'program',      label: 'Program' },
                  { key: 'level',        label: 'Level',  render: r => r.level ? `Level ${r.level}` : '—' },
                  { key: 'phone',        label: 'Phone' },
                  { key: 'status',       label: 'Status', render: r => r.attendance_status ? <Badge variant={r.attendance_status === 'Flagged' ? 'flagged' : 'present'}>{r.attendance_status === 'Flagged' ? '⚠️ Flagged' : '✅ Present'}</Badge> : <Badge variant="default">Absent</Badge> }
                ]}
                data={students}
                emptyText="No students registered under this class rep."
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ── Sub-components ── */
function StatPill({ icon, label, value, color, loading }) {
  return (
    <div className={`att-stat-pill att-stat-${color}`}>
      <div className={`att-stat-icon-wrap att-si-${color}`}>{icon}</div>
      <div className="att-stat-text">
        <span className="att-stat-value">{loading ? <span className="att-pulse">—</span> : value}</span>
        <span className="att-stat-label">{label}</span>
      </div>
    </div>
  )
}

function Metric({ icon, label, value, color }) {
  return (
    <div className={`att-metric att-metric-${color}`}>
      <div className="att-metric-top">
        {icon}
        <span className="att-metric-val">{value ?? 0}</span>
      </div>
      <span className="att-metric-label">{label}</span>
    </div>
  )
}

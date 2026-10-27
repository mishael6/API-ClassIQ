import { useState, useEffect } from 'react'
import { lecturerApi } from '../../lib/api'
import { Modal, Badge, Button } from '../ui'
import {
  Mail, Phone, Building, GraduationCap, Hash, Calendar, CheckCircle,
  AlertCircle, BookOpen, XCircle, ChevronRight,
} from 'lucide-react'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const initials = (name) => name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

function SummaryTile({ icon, label, value, small }) {
  return (
    <div className="stu-summary-tile">
      <span className="stu-summary-icon">{icon}</span>
      <div>
        <p className="stu-summary-label">{label}</p>
        <p className={`stu-summary-value ${small ? 'small' : ''}`}>{value}</p>
      </div>
    </div>
  )
}

export default function LecturerStudentDetailModal({ student, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('attended')

  useEffect(() => {
    if (!student?.id) return
    setLoading(true)
    setDetail(null)
    setTab('attended')
    lecturerApi.getStudentDetail(student.id)
      .then(r => setDetail(r.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [student?.id])

  if (!student) return null

  const attended = detail?.attended || detail?.history || []
  const missed = detail?.missed || []

  return (
    <Modal open={!!student} onClose={onClose} title="" width={720}>
      <div className="stu-modal">
        <div className="stu-modal-head">
          <div className="stu-modal-avatar">{initials(student.name)}</div>
          <div className="stu-modal-title-area">
            <h3 className="stu-modal-name">{student.name}</h3>
            <code className="stu-modal-index">{student.index_number}</code>
            {detail?.student?.class_name && (
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>{detail.student.class_name}</p>
            )}
          </div>
          <Button size="sm" variant="ghost" icon={<ChevronRight size={13} style={{ transform: 'rotate(180deg)' }}/>} onClick={onClose}>Close</Button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}/></div>
        ) : detail ? (
          <div className="stu-modal-body">
            <div className="stu-modal-stats">
              <SummaryTile icon={<CheckCircle size={15} style={{ color: 'var(--green)' }}/>} label="Present" value={detail.summary?.present || 0} />
              <SummaryTile icon={<AlertCircle size={15} style={{ color: 'var(--orange)' }}/>} label="Flagged" value={detail.summary?.flagged || 0} />
              <SummaryTile icon={<BookOpen size={15} style={{ color: 'var(--blue)' }}/>} label="Attended" value={detail.summary?.sessions_attended || attended.length} />
              <SummaryTile icon={<XCircle size={15} style={{ color: 'var(--red)' }}/>} label="Missed" value={detail.summary?.sessions_missed || missed.length} />
              <SummaryTile icon={<Calendar size={15} style={{ color: 'var(--purple)' }}/>} label="Last Seen" value={fmtDate(detail.summary?.last_seen)} small />
            </div>

            <div className="stu-info-grid">
              {[
                { icon: <Mail size={14}/>, label: 'Email', value: detail.student.email },
                { icon: <Phone size={14}/>, label: 'Phone', value: detail.student.phone },
                { icon: <Building size={14}/>, label: 'Institution', value: detail.student.institution },
                { icon: <GraduationCap size={14}/>, label: 'Program', value: detail.student.program },
                { icon: <GraduationCap size={14}/>, label: 'Class', value: detail.student.class_name },
                { icon: <Hash size={14}/>, label: 'Level', value: detail.student.level ? `Level ${detail.student.level}` : '—' },
                { icon: <Calendar size={14}/>, label: 'Registered', value: fmtDate(detail.student.created_at) },
              ].map((r, i) => (
                <div key={i} className="stu-info-row">
                  <span className="stu-info-icon">{r.icon}</span>
                  <span className="stu-info-label">{r.label}</span>
                  <span className="stu-info-value">{r.value || '—'}</span>
                </div>
              ))}
            </div>

            <div className="lec-stu-tabs">
              <button type="button" className={`lec-stu-tab ${tab === 'attended' ? 'active' : ''}`} onClick={() => setTab('attended')}>
                Classes Attended ({attended.length})
              </button>
              <button type="button" className={`lec-stu-tab ${tab === 'missed' ? 'active' : ''}`} onClick={() => setTab('missed')}>
                Classes Missed ({missed.length})
              </button>
            </div>

            {tab === 'attended' && (
              attended.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No attendance records yet.</p>
              ) : (
                <div className="stu-recent-list">
                  {attended.map((a, i) => (
                    <div key={i} className="stu-recent-row">
                      <span className="stu-recent-date">{fmtDate(a.attendance_date)}</span>
                      <span className="stu-recent-lec">
                        {a.semester_name ? `${a.semester_name} · ` : ''}Week {a.week_number} · {a.class_name}: {a.lecture_name}
                      </span>
                      <span className="stu-recent-time">{a.time_marked?.slice(0, 5)}</span>
                      <Badge variant={a.status === 'Flagged' ? 'flagged' : 'present'}>{a.status}</Badge>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'missed' && (
              missed.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No missed sessions — great attendance!</p>
              ) : (
                <div className="stu-recent-list">
                  {missed.map((m, i) => (
                    <div key={i} className="stu-recent-row">
                      <span className="stu-recent-date">{fmtDate(m.session_date)}</span>
                      <span className="stu-recent-lec">
                        {m.semester_name} · Week {m.week_number} · {m.class_name}: {m.topic}
                      </span>
                      <Badge variant="default">Missed</Badge>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>Failed to load student details.</p>
        )}
      </div>
    </Modal>
  )
}

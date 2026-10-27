import { useState, useEffect } from 'react'
import { classrepApi } from '../../lib/api'
import { Card, PageHeader, Button, Badge, Alert, Modal } from '../../components/ui'
import { UserPlus, RotateCcw, Trash2, MapPin, Flag, ChevronDown, Download, BookOpen, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import '../../components/ui/components.css'
import './attendance.css'

const formatDateLabel = (date) => {
  try {
    return format(new Date(date + 'T12:00:00'), 'EEEE, d MMMM yyyy')
  } catch {
    return date
  }
}

const formatDateShort = (date) => {
  try {
    return format(new Date(date + 'T12:00:00'), 'EEE, d MMM')
  } catch {
    return date
  }
}

const initials = (n = '') => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

function statusBadge(st) {
  const map  = { Present: 'present', Flagged: 'flagged', Outside: 'outside', Normal: 'present' }
  const icon = { Present: '✅', Flagged: '⚠️', Outside: '📍', Normal: '✅' }
  return <Badge variant={map[st] || 'default'}>{icon[st] || ''} {st}</Badge>
}

function formatTime(t) {
  if (!t) return '—'
  try { return format(new Date(`2000-01-01T${t}`), 'h:mm a') }
  catch { return t }
}

export default function AttendanceHistoryPage() {
  const [records, setRecords] = useState({})
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [modal,   setModal]   = useState(null)
  const [addIndex,setAddIndex]= useState('')
  const [openLectures, setOpenLectures] = useState({})

  const load = () => {
    setLoading(true)
    classrepApi.getAttendance()
      .then(r => {
        const rec = r.data.records || {}
        setRecords(rec)
        const firstKey = Object.keys(rec).sort((a, b) => b.localeCompare(a))[0]
        if (firstKey) {
          const firstLecture = Object.keys(rec[firstKey] || {})[0]
          if (firstLecture) setOpenLectures({ [`${firstKey}::${firstLecture}`]: true })
        }
      })
      .catch(() => setError('Failed to load attendance.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toast = (msg, isError = false) => {
    isError ? setError(msg) : setSuccess(msg)
    setTimeout(() => isError ? setError('') : setSuccess(''), 4000)
  }

  const toggleLecture = (key) => {
    setOpenLectures(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const restoreFlagged = async (date, lecture) => {
    if (!confirm(`Restore all flagged students to Present for ${lecture} on ${formatDateLabel(date)}?`)) return
    try {
      const { data } = await classrepApi.restoreFlagged({ date, lecture_name: lecture, action: 'restore_flagged' })
      toast(`✅ ${data.affected} student(s) restored`); load()
    } catch { toast('Failed to restore', true) }
  }

  const removeOutside = async (date, lecture, indexNumber = null) => {
    if (!confirm(indexNumber ? 'Remove this student?' : `Remove all outside students from ${lecture}?`)) return
    try {
      const { data } = await classrepApi.removeAttendance({ date, lecture_name: lecture, index_number: indexNumber, type: 'outside' })
      toast(`📍 ${data.affected} record(s) removed`); load()
    } catch { toast('Failed to remove', true) }
  }

  const removeSingle = async (date, lecture, indexNumber) => {
    if (!confirm(`Remove student ${indexNumber} from this lecture?`)) return
    try {
      const { data } = await classrepApi.removeAttendance({ date, lecture_name: lecture, index_number: indexNumber, type: 'single' })
      toast(`✅ ${data.affected} student(s) removed`); load()
    } catch { toast('Failed to remove student', true) }
  }

  const deleteFlagged = async (date, lecture) => {
    if (!confirm(`Remove flagged students from ${lecture} on ${formatDateLabel(date)}?`)) return
    try {
      await classrepApi.removeAttendance({ date, lecture_name: lecture, type: 'flagged' })
      toast('Flagged records removed'); load()
    } catch { toast('Failed to remove', true) }
  }

  const deleteAll = async (date, lecture) => {
    if (!confirm('⚠️ PERMANENT DELETE — cannot be undone!')) return
    try {
      await classrepApi.removeAttendance({ date, lecture_name: lecture, type: 'all' })
      toast('All attendance deleted'); load()
    } catch { toast('Failed to delete', true) }
  }

  const addStudent = async () => {
    if (!addIndex || !modal) return
    try {
      const { data } = await classrepApi.addToAttendance({
        index_number: addIndex, attendance_date: modal.date, lecture_name: modal.lecture
      })
      if (data.success) { toast('Student added!'); setModal(null); setAddIndex(''); load() }
      else toast(data.message || 'Failed to add', true)
    } catch { toast('Failed to add student', true) }
  }

  const exportPDF = (date, lecture, entries) => {
    const doc = new jsPDF()
    const dateStr = formatDateLabel(date)
    doc.setFontSize(14)
    doc.text(`Attendance Report - ${lecture}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`Date: ${dateStr}`, 14, 22)
    doc.text(`Total Students: ${entries.length}`, 14, 27)

    const tableData = entries.map((entry, index) => [
      index + 1, entry.student_name, entry.index_number, formatTime(entry.time_marked), entry.status
    ])

    autoTable(doc, {
      startY: 32,
      head: [['#', 'Student Name', 'Index Number', 'Time Marked', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 133, 244] }
    })

    doc.save(`Attendance_${lecture.replace(/\s+/g, '_')}_${date}.pdf`)
  }

  if (loading) return <div className="dash-loading"><div className="spinner"/></div>

  const allDates = Object.entries(records).sort((a, b) => b[0].localeCompare(a[0]))

  let totalRecords = 0, totalPresent = 0, totalFlagged = 0, totalOutside = 0
  allDates.forEach(([, lectures]) => {
    Object.values(lectures).forEach(entries => {
      totalRecords += entries.length
      totalFlagged += entries.filter(e => e.status === 'Flagged').length
      totalOutside += entries.filter(e => e.status === 'Outside').length
    })
  })
  totalPresent = totalRecords - totalFlagged - totalOutside

  return (
    <div className="animate-fade-up att-page">
      <PageHeader
        title="Attendance History"
        subtitle={allDates.length
          ? `${allDates.length} day${allDates.length !== 1 ? 's' : ''} · ${totalRecords} record${totalRecords !== 1 ? 's' : ''}`
          : 'No records yet'}
      />

      {error   && <Alert variant="error"   onClose={() => setError('')}   style={{ marginBottom: 16 }}>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} style={{ marginBottom: 16 }}>{success}</Alert>}

      {allDates.length > 0 && (
        <div className="att-summary">
          {[
            { label: 'Total Records', value: totalRecords, color: 'var(--blue)' },
            { label: 'Present', value: totalPresent, color: 'var(--green)' },
            { label: 'Flagged', value: totalFlagged, color: 'var(--red)' },
            { label: 'Outside', value: totalOutside, color: 'var(--orange)' },
          ].map(s => (
            <div key={s.label} className="att-summary-card">
              <span className="att-summary-label">{s.label}</span>
              <span className="att-summary-value" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {allDates.length === 0 ? (
        <Card>
          <div className="att-empty">
            <div className="att-empty-icon">📋</div>
            <p className="att-empty-title">No attendance records yet</p>
            <p className="att-empty-sub">Generate a QR code to start taking attendance for your class.</p>
          </div>
        </Card>
      ) : (
        allDates.map(([date, lectures], dateIdx) => {
          const lectureEntries = Object.entries(lectures)
          const dayTotal = lectureEntries.reduce((sum, [, e]) => sum + e.length, 0)
          const dayLectures = lectureEntries.length

          return (
            <section
              key={date}
              className="att-date-section"
              style={{ animationDelay: `${dateIdx * 0.08}s` }}
            >
              <div className="att-date-header">
                <div>
                  <div className="att-date-title">
                    <Calendar size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: -3 }} />
                    {formatDateLabel(date)}
                  </div>
                  <div className="att-date-sub">{formatDateShort(date)} · {dayLectures} lecture{dayLectures !== 1 ? 's' : ''}</div>
                </div>
                <span className="att-date-badge">{dayTotal} student{dayTotal !== 1 ? 's' : ''}</span>
              </div>

              {lectureEntries.map(([lecture, entries], lecIdx) => {
                const sectionKey = `${date}::${lecture}`
                const isOpen = !!openLectures[sectionKey]
                const flagged = entries.filter(e => e.status === 'Flagged').length
                const outside = entries.filter(e => e.status === 'Outside').length
                const present = entries.length - flagged - outside

                return (
                  <div
                    key={sectionKey}
                    className={`att-lecture-section ${isOpen ? 'is-open' : ''}`}
                    style={{ animationDelay: `${(dateIdx * 0.08) + (lecIdx * 0.05)}s` }}
                  >
                    <div className="att-lecture-head" onClick={() => toggleLecture(sectionKey)}>
                      <div className="att-lecture-title-wrap">
                        <div className="att-lecture-name">
                          <BookOpen size={16} style={{ color: 'var(--blue)' }} />
                          {lecture}
                        </div>
                        <div className="att-lecture-meta">
                          <span className="att-lecture-pill">{entries.length} total</span>
                          <span className="att-lecture-pill present">{present} present</span>
                          {flagged > 0 && <span className="att-lecture-pill flagged">{flagged} flagged</span>}
                          {outside > 0 && <span className="att-lecture-pill outside">{outside} outside</span>}
                        </div>
                      </div>
                      <ChevronDown size={20} className="att-chevron" />
                    </div>

                    <div className="att-lecture-body">
                      <div className="att-lecture-inner">
                        <div className="att-controls">
                          <Button size="sm" variant="success" icon={<UserPlus size={13}/>} onClick={() => setModal({ date, lecture })}>
                            Add Student
                          </Button>
                          <Button size="sm" variant="secondary" icon={<Download size={13}/>} onClick={() => exportPDF(date, lecture, entries)}>
                            Export PDF
                          </Button>
                          {flagged > 0 && <>
                            <Button size="sm" variant="secondary" icon={<RotateCcw size={13}/>} onClick={() => restoreFlagged(date, lecture)}>
                              Restore Flagged
                            </Button>
                            <Button size="sm" variant="warning" icon={<Flag size={13}/>} onClick={() => deleteFlagged(date, lecture)}>
                              Remove Flagged
                            </Button>
                          </>}
                          {outside > 0 &&
                            <Button size="sm" variant="warning" icon={<MapPin size={13}/>} onClick={() => removeOutside(date, lecture)}>
                              Remove Outside
                            </Button>
                          }
                          <Button size="sm" variant="danger" icon={<Trash2 size={13}/>} onClick={() => deleteAll(date, lecture)}>
                            Delete All
                          </Button>
                        </div>

                        <div className="att-student-grid">
                          {entries.map((student, i) => (
                            <div
                              key={`${student.index_number}-${i}`}
                              className={`att-student-card ${
                                student.status === 'Flagged' ? 'row-flagged'
                                  : student.status === 'Outside' ? 'row-outside' : 'row-present'
                              }`}
                              style={{ animationDelay: `${i * 0.04}s` }}
                            >
                              <div className="att-stu-avatar">{initials(student.student_name)}</div>
                              <div className="att-stu-info">
                                <div className="att-stu-name">{student.student_name}</div>
                                <div className="att-stu-index">{student.index_number}</div>
                              </div>
                              <div className="att-stu-right">
                                {statusBadge(student.status)}
                                <span className="att-stu-time">{formatTime(student.time_marked)}</span>
                                <Button size="xs" variant="danger" onClick={() => removeSingle(date, lecture, student.index_number)}>
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })
      )}

      <AddStudentModal
        open={!!modal}
        onClose={() => { setModal(null); setAddIndex('') }}
        modal={modal}
        addIndex={addIndex}
        setAddIndex={setAddIndex}
        onAdd={addStudent}
      />
    </div>
  )
}

function AddStudentModal({ open, onClose, modal, addIndex, setAddIndex, onAdd }) {
  const [search, setSearch] = useState('')
  const [allStudents, setAllStudents] = useState([])

  useEffect(() => {
    if (!open) { setSearch(''); return }
    classrepApi.getStudents({ limit: 300 })
      .then(r => setAllStudents(r.data.students || []))
      .catch(() => setAllStudents([]))
  }, [open])

  const filtered = allStudents.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.index_number?.toLowerCase().includes(search.toLowerCase())
  )

  const stuInitials = (n = '') => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <Modal open={open} onClose={onClose} title="➕ Add Student to Attendance" width={480}>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 14 }}>
        Adding to <strong>{modal?.lecture}</strong> on{' '}
        <strong>{modal?.date ? formatDateLabel(modal.date) : ''}</strong>
      </p>

      <div className="add-stu-search-wrap">
        <input
          className="add-stu-search-input"
          placeholder="Search by name or index number…"
          value={search}
          onChange={e => { setSearch(e.target.value); setAddIndex('') }}
          autoFocus
        />
        {search && (
          <button className="add-stu-search-clear" onClick={() => { setSearch(''); setAddIndex('') }}>×</button>
        )}
      </div>

      <div className="add-stu-list">
        {allStudents.length === 0 ? (
          <p className="add-stu-empty">Loading students…</p>
        ) : filtered.length === 0 ? (
          <p className="add-stu-empty">No students match "{search}"</p>
        ) : (
          filtered.map(s => (
            <button
              key={s.id}
              className={`add-stu-item ${addIndex === s.index_number ? 'add-stu-selected' : ''}`}
              onClick={() => setAddIndex(addIndex === s.index_number ? '' : s.index_number)}
            >
              <div className="add-stu-avatar">{stuInitials(s.name)}</div>
              <div className="add-stu-info">
                <span className="add-stu-name">{s.name}</span>
                <span className="add-stu-index">{s.index_number}</span>
              </div>
              {addIndex === s.index_number && <span className="add-stu-check">✅</span>}
            </button>
          ))
        )}
      </div>

      <div style={{ margin: '12px 0 4px' }}>
        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          {addIndex ? `Selected: ${addIndex}` : 'Or type index number manually'}
        </p>
        <input
          className="field-input"
          placeholder="e.g. 20240001"
          value={addIndex}
          onChange={e => setAddIndex(e.target.value.toUpperCase())}
        />
      </div>

      <Button fullWidth onClick={onAdd} style={{ marginTop: 14 }} disabled={!addIndex}>
        ✅ Add to Attendance
      </Button>
    </Modal>
  )
}

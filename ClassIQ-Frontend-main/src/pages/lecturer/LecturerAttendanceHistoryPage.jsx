import { useState, useEffect, useMemo } from 'react'
import { lecturerApi } from '../../lib/api'
import { Card, PageHeader, Badge, Alert, Button } from '../../components/ui'
import { Download, Search } from 'lucide-react'
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { exportAttendanceCsv, exportSessionAttendanceCsv } from '../../lib/exportCsv'
import LecturerStudentDetailModal from '../../components/lecturer/LecturerStudentDetailModal'
import '../../components/ui/components.css'
import '../classrep/attendance.css'
import '../classrep/dashboard.css'
import './lecturer-student.css'

function statusBadge(st) {
  const map = { Present: 'present', Flagged: 'flagged' }
  return <Badge variant={map[st] || 'default'}>{st}</Badge>
}

export default function LecturerAttendanceHistoryPage() {
  const [records, setRecords] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)

  useEffect(() => {
    lecturerApi.getAttendance()
      .then(r => setRecords(r.data.records || {}))
      .catch(() => setError('Failed to load attendance.'))
      .finally(() => setLoading(false))
  }, [])

  const q = search.trim().toLowerCase()

  const filteredRecords = useMemo(() => {
    if (!q) return records
    const out = {}
    Object.entries(records).forEach(([sessionLabel, dates]) => {
      Object.entries(dates || {}).forEach(([date, rows]) => {
        const matched = (rows || []).filter(r =>
          r.student_name?.toLowerCase().includes(q) || r.index_number?.toLowerCase().includes(q)
        )
        if (matched.length) {
          if (!out[sessionLabel]) out[sessionLabel] = {}
          out[sessionLabel][date] = matched
        }
      })
    })
    return out
  }, [records, q])

  const weekKeys = Object.keys(filteredRecords)

  const exportPDF = (sessionLabel, date, entries) => {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text(`Attendance — ${sessionLabel}`, 14, 15)
    doc.setFontSize(10)
    doc.text(`Date: ${format(new Date(date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}`, 14, 22)
    doc.text(`Total: ${entries.length}`, 14, 27)
    autoTable(doc, {
      startY: 32,
      head: [['#', 'Student', 'Index', 'Time', 'Status']],
      body: entries.map((e, i) => [i + 1, e.student_name, e.index_number, e.time_marked?.slice(0, 5) || '—', e.status]),
      theme: 'grid',
      headStyles: { fillColor: [66, 133, 244] },
    })
    const safe = sessionLabel.replace(/[^\w-]+/g, '_').slice(0, 40)
    doc.save(`Attendance_${safe}_${date}.pdf`)
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Attendance History"
        subtitle="View, search and download attendance records"
        actions={
          <Button
            size="sm"
            variant="secondary"
            icon={<Download size={14}/>}
            disabled={!Object.keys(records).length}
            onClick={() => exportAttendanceCsv(records, 'all-attendance')}
          >
            Download All CSV
          </Button>
        }
      />

      {error && <Alert variant="error" onClose={() => setError('')} style={{ marginBottom: 16 }}>{error}</Alert>}

      {!loading && Object.keys(records).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="dash-search-wrap" style={{ maxWidth: 320 }}>
            <Search size={14} className="dash-search-icon" />
            <input
              className="dash-search-input"
              placeholder="Search student name or index…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
            {search && <button type="button" className="dash-search-clear" onClick={() => setSearch('')}>×</button>}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}/></div>
      ) : weekKeys.length === 0 ? (
        <Card style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          {search ? 'No attendance records match your search.' : 'No attendance records yet. Generate a QR code to start a session.'}
        </Card>
      ) : (
        weekKeys.map(weekLabel => (
          <Card key={weekLabel} style={{ marginBottom: 20 }}>
            <div className="card-head">
              <h2 className="card-title">{weekLabel}</h2>
            </div>
            {Object.entries(filteredRecords[weekLabel] || {}).map(([date, rows]) => (
              <div key={date} className="att-date-block">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <h3 className="att-date-title" style={{ margin: 0 }}>
                    {new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button size="sm" variant="secondary" icon={<Download size={13}/>} onClick={() => exportSessionAttendanceCsv(weekLabel, date, rows)}>
                      CSV
                    </Button>
                    <Button size="sm" variant="secondary" icon={<Download size={13}/>} onClick={() => exportPDF(weekLabel, date, rows)}>
                      PDF
                    </Button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Index</th>
                        <th>Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}>
                          <td>
                            {r.student_id ? (
                              <button type="button" className="lec-att-stu-link" onClick={() => setSelectedStudent({ id: r.student_id, name: r.student_name, index_number: r.index_number })}>
                                {r.student_name}
                              </button>
                            ) : r.student_name}
                          </td>
                          <td><code>{r.index_number}</code></td>
                          <td>{r.time_marked?.slice(0, 5)}</td>
                          <td>{statusBadge(r.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </Card>
        ))
      )}

      <LecturerStudentDetailModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
    </div>
  )
}

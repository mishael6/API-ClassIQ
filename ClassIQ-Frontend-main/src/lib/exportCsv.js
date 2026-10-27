export function escapeCsv(value) {
  const s = String(value ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

export function downloadCsv(filename, headers, rows) {
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportStudentsCsv(students, className = 'students') {
  if (!students.length) return
  downloadCsv(
    `classiq-${className.replace(/[^\w-]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Name', 'Index Number', 'Email', 'Phone', 'Class', 'Present Count', 'Last Seen'],
    students.map(s => [
      escapeCsv(s.name),
      escapeCsv(s.index_number),
      escapeCsv(s.email),
      escapeCsv(s.phone),
      escapeCsv(s.class_name || className),
      s.present_count || 0,
      s.last_seen || '',
    ])
  )
}

export function flattenAttendanceRecords(records) {
  const rows = []
  Object.entries(records || {}).forEach(([sessionLabel, dates]) => {
    Object.entries(dates || {}).forEach(([date, entries]) => {
      ;(entries || []).forEach(e => {
        rows.push({ sessionLabel, date, ...e })
      })
    })
  })
  return rows
}

export function exportAttendanceCsv(records, filename = 'attendance') {
  const flat = flattenAttendanceRecords(records)
  if (!flat.length) return
  downloadCsv(
    `classiq-${filename.replace(/[^\w-]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Session', 'Date', 'Student', 'Index Number', 'Class', 'Week', 'Topic', 'Time', 'Status'],
    flat.map(r => [
      escapeCsv(r.sessionLabel),
      r.date,
      escapeCsv(r.student_name),
      escapeCsv(r.index_number),
      escapeCsv(r.class_name),
      r.week_number ?? '',
      escapeCsv(r.lecture_name),
      r.time_marked?.slice(0, 5) || '',
      r.status || '',
    ])
  )
}

export function exportSessionAttendanceCsv(sessionLabel, date, entries) {
  if (!entries?.length) return
  const safe = sessionLabel.replace(/[^\w-]+/g, '-').slice(0, 60)
  downloadCsv(
    `classiq-${safe}-${date}.csv`,
    ['Student', 'Index Number', 'Time', 'Status'],
    entries.map(e => [
      escapeCsv(e.student_name),
      escapeCsv(e.index_number),
      e.time_marked?.slice(0, 5) || '',
      e.status || '',
    ])
  )
}

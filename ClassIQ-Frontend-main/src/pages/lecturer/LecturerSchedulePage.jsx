import { useState, useEffect } from 'react'
import { lecturerApi } from '../../lib/api'
import { Card, PageHeader, Button, Alert, Input, Modal, Select } from '../../components/ui'
import { Plus, Edit2, Trash2, Calendar, BookOpen, GraduationCap, ChevronDown, ChevronRight } from 'lucide-react'
import '../../components/ui/components.css'
import './schedule.css'

export default function LecturerSchedulePage() {
  const [semesters, setSemesters] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [openSemesters, setOpenSemesters] = useState({})
  const [openWeeks, setOpenWeeks] = useState({})

  const load = () => {
    setLoading(true)
    lecturerApi.getSchedule()
      .then(r => {
        const list = r.data.semesters || []
        setSemesters(list)
        setCohorts(r.data.cohorts || [])
        if (list.length && !Object.keys(openSemesters).length) {
          setOpenSemesters({ [list[0].id]: true })
        }
      })
      .catch(() => setError('Failed to load schedule.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toast = (msg, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => isErr ? setError('') : setSuccess(''), 4000)
  }

  const openAddSemester = () => {
    setForm({ type: 'semester', name: '' })
    setModal('semester')
  }

  const openAddWeek = (semester) => {
    const nums = (semester.weeks || []).map(w => w.week_number)
    setForm({
      type: 'week',
      semester_id: semester.id,
      week_number: String((nums.length ? Math.max(...nums) : 0) + 1),
    })
    setModal('week')
  }

  const openAddSession = (week) => {
    setForm({
      type: 'session',
      week_id: week.id,
      cohort_id: cohorts[0] ? String(cohorts[0].id) : '',
      topic: '',
    })
    setModal('session')
  }

  const openEdit = (type, item) => {
    if (type === 'semester') setForm({ type, id: item.id, name: item.name })
    if (type === 'week') setForm({ type, id: item.id, week_number: String(item.week_number) })
    if (type === 'session') {
      setForm({
        type,
        id: item.id,
        cohort_id: String(item.cohort_id || ''),
        topic: item.topic || '',
      })
    }
    setModal(type)
  }

  const save = async () => {
    setSaving(true)
    try {
      if (modal === 'semester') {
        const name = form.name?.trim()
        if (!name) { toast('Semester name is required.', true); return }
        if (form.id) await lecturerApi.updateSchedule({ type: 'semester', id: form.id, name })
        else await lecturerApi.addSchedule({ type: 'semester', name })
        toast(form.id ? 'Semester updated.' : 'Semester added.')
      }
      if (modal === 'week') {
        const week_number = parseInt(form.week_number, 10)
        if (!week_number) { toast('Week number is required.', true); return }
        if (form.id) await lecturerApi.updateSchedule({ type: 'week', id: form.id, week_number })
        else await lecturerApi.addSchedule({ type: 'week', semester_id: form.semester_id, week_number })
        toast(form.id ? 'Week updated.' : 'Week added.')
      }
      if (modal === 'session') {
        const cohort_id = parseInt(form.cohort_id, 10)
        const topic = form.topic?.trim()
        if (!cohort_id || !topic) { toast('Class and topic are required.', true); return }
        if (form.id) await lecturerApi.updateSchedule({ type: 'session', id: form.id, cohort_id, topic })
        else await lecturerApi.addSchedule({ type: 'session', week_id: form.week_id, cohort_id, topic })
        toast(form.id ? 'Session updated.' : 'Session added.')
      }
      setModal(null)
      load()
    } catch (e) {
      toast(e.response?.data?.message || 'Save failed.', true)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (type, id, label) => {
    if (!confirm(`Delete ${label}?`)) return
    try {
      await lecturerApi.deleteSchedule(type, id)
      toast('Removed.')
      load()
    } catch {
      toast('Failed to delete.', true)
    }
  }

  const toggleSem = (id) => setOpenSemesters(s => ({ ...s, [id]: !s[id] }))
  const toggleWeek = (id) => setOpenWeeks(s => ({ ...s, [id]: !s[id] }))

  const sessionsLabel = (week) => (week.sessions || week.classes || []).length

  return (
    <div className="animate-fade-up schedule-page">
      <PageHeader
        title="Teaching Schedule"
        subtitle="Semester → Week → Class (by name) → Topic. Add classes under My Classes first."
        actions={<Button size="sm" icon={<Plus size={14}/>} onClick={openAddSemester}>Add Semester</Button>}
      />

      {error && <Alert variant="error" onClose={() => setError('')} style={{ marginBottom: 16 }}>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} style={{ marginBottom: 16 }}>{success}</Alert>}

      {cohorts.length === 0 && !loading && (
        <Alert variant="info" style={{ marginBottom: 16 }}>
          Add at least one class (e.g. DIT1A) under <strong>My Classes</strong> before scheduling sessions.
        </Alert>
      )}

      <Card>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}/></div>
        ) : semesters.length === 0 ? (
          <div className="schedule-empty">
            <GraduationCap size={40}/>
            <p>No semesters yet. Start by adding your first semester.</p>
            <Button size="sm" icon={<Plus size={14}/>} onClick={openAddSemester}>Add Semester</Button>
          </div>
        ) : (
          <div className="schedule-tree">
            {semesters.map(sem => (
              <div key={sem.id} className="schedule-semester">
                <div className="schedule-sem-head">
                  <button type="button" className="schedule-toggle" onClick={() => toggleSem(sem.id)}>
                    {openSemesters[sem.id] ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                    <GraduationCap size={16}/>
                    <strong>{sem.name}</strong>
                    <span className="schedule-badge">{(sem.weeks || []).length} weeks</span>
                  </button>
                  <div className="schedule-actions">
                    <Button size="sm" variant="ghost" icon={<Plus size={13}/>} onClick={() => openAddWeek(sem)}>Week</Button>
                    <Button size="sm" variant="ghost" icon={<Edit2 size={13}/>} onClick={() => openEdit('semester', sem)}>Edit</Button>
                    <Button size="sm" variant="danger" icon={<Trash2 size={13}/>} onClick={() => remove('semester', sem.id, sem.name)}>Delete</Button>
                  </div>
                </div>

                {openSemesters[sem.id] && (
                  <div className="schedule-weeks">
                    {(sem.weeks || []).length === 0 ? (
                      <p className="schedule-muted">No weeks in this semester. <button type="button" className="schedule-link" onClick={() => openAddWeek(sem)}>Add Week 1</button></p>
                    ) : (sem.weeks || []).map(week => (
                      <div key={week.id} className="schedule-week">
                        <div className="schedule-week-head">
                          <button type="button" className="schedule-toggle" onClick={() => toggleWeek(week.id)}>
                            {openWeeks[week.id] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                            <Calendar size={15}/>
                            <span>Week {week.week_number}</span>
                            <span className="schedule-badge">{sessionsLabel(week)} sessions</span>
                          </button>
                          <div className="schedule-actions">
                            <Button size="sm" variant="ghost" icon={<Plus size={12}/>} onClick={() => openAddSession(week)} disabled={!cohorts.length}>Session</Button>
                            <Button size="sm" variant="ghost" icon={<Edit2 size={12}/>} onClick={() => openEdit('week', week)}>Edit</Button>
                            <Button size="sm" variant="danger" icon={<Trash2 size={12}/>} onClick={() => remove('week', week.id, `Week ${week.week_number}`)}>Delete</Button>
                          </div>
                        </div>

                        {openWeeks[week.id] && (
                          <div className="schedule-classes">
                            {sessionsLabel(week) === 0 ? (
                              <p className="schedule-muted">No sessions yet. <button type="button" className="schedule-link" onClick={() => openAddSession(week)} disabled={!cohorts.length}>Add session</button></p>
                            ) : (week.sessions || week.classes || []).map(sess => (
                              <div key={sess.id} className="schedule-class-row">
                                <div>
                                  <span className="schedule-class-num">{sess.class_name}</span>
                                  <span className="schedule-class-topic">{sess.topic}</span>
                                </div>
                                <div className="schedule-actions">
                                  <Button size="sm" variant="ghost" icon={<Edit2 size={12}/>} onClick={() => openEdit('session', sess)}>Edit</Button>
                                  <Button size="sm" variant="danger" icon={<Trash2 size={12}/>} onClick={() => remove('session', sess.id, `${sess.class_name} — ${sess.topic}`)}>Delete</Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={
          modal === 'semester' ? (form.id ? 'Edit Semester' : 'Add Semester') :
          modal === 'week' ? (form.id ? 'Edit Week' : 'Add Week') :
          form.id ? 'Edit Session' : 'Add Session'
        }
        width={440}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {modal === 'semester' && (
            <Input label="Semester Name" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. First Semester 2025/2026" icon={<GraduationCap size={14}/>} />
          )}
          {modal === 'week' && (
            <div className="field">
              <label className="field-label">Week Number</label>
              <input className="field-input" type="number" min={1} max={52} value={form.week_number || ''} onChange={e => setForm(f => ({ ...f, week_number: e.target.value }))} />
            </div>
          )}
          {modal === 'session' && (
            <>
              <Select label="Class" value={form.cohort_id || ''} onChange={e => setForm(f => ({ ...f, cohort_id: e.target.value }))}>
                <option value="">Select class…</option>
                {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Input label="Topic to Teach" value={form.topic || ''} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. Introduction to Algorithms" icon={<BookOpen size={14}/>} />
            </>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" fullWidth onClick={() => setModal(null)}>Cancel</Button>
            <Button fullWidth loading={saving} onClick={save}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

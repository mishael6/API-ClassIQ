import { useState, useEffect } from 'react'
import { lecturerApi } from '../../lib/api'
import { Card, PageHeader, Button, Alert, Input, Modal } from '../../components/ui'
import LecturerStudentDetailModal from '../../components/lecturer/LecturerStudentDetailModal'
import { exportStudentsCsv } from '../../lib/exportCsv'
import { Plus, Copy, Download, Trash2, Edit2, Users, GraduationCap, Search, ChevronRight } from 'lucide-react'
import '../../components/ui/components.css'
import '../classrep/dashboard.css'
import './classes.css'
import './lecturer-student.css'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function LecturerClassesPage() {
  const [cohorts, setCohorts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [openClass, setOpenClass] = useState({})
  const [search, setSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)

  const load = () => {
    setLoading(true)
    lecturerApi.getCohorts()
      .then(r => {
        const list = r.data.cohorts || []
        setCohorts(list)
        if (list.length && !Object.keys(openClass).length) {
          setOpenClass({ [list[0].id]: true })
        }
      })
      .catch(() => setError('Failed to load classes.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toast = (msg, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => isErr ? setError('') : setSuccess(''), 4000)
  }

  const copyLink = (url) => {
    navigator.clipboard.writeText(url)
    toast('Registration link copied.')
  }

  const saveClass = async () => {
    const name = form.name?.trim()
    if (!name) { toast('Class name is required (e.g. DIT1A).', true); return }
    setSaving(true)
    try {
      if (form.id) {
        await lecturerApi.updateCohort({ id: form.id, name })
        toast('Class renamed.')
      } else {
        const { data } = await lecturerApi.addCohort({ name })
        toast('Class added. Copy the registration link below.')
        if (data.registration_url) copyLink(data.registration_url)
      }
      setModal(null)
      load()
    } catch (e) {
      toast(e.response?.data?.message || 'Save failed.', true)
    } finally {
      setSaving(false)
    }
  }

  const saveStudent = async () => {
    const { cohort_id, name, index_number, email, phone } = form
    if (!name?.trim() || !index_number?.trim() || !email?.trim() || !phone?.trim()) {
      toast('All student fields are required.', true)
      return
    }
    setSaving(true)
    try {
      await lecturerApi.addStudent({
        cohort_id,
        name: name.trim(),
        index_number: index_number.trim().toUpperCase(),
        email: email.trim(),
        phone: phone.trim(),
      })
      toast('Student added.')
      setModal(null)
      load()
    } catch (e) {
      toast(e.response?.data?.message || 'Failed to add student.', true)
    } finally {
      setSaving(false)
    }
  }

  const removeClass = async (id, name) => {
    if (!confirm(`Delete class "${name}"? Students will be unassigned from this class.`)) return
    try {
      await lecturerApi.deleteCohort(id)
      toast('Class removed.')
      load()
    } catch {
      toast('Failed to delete class.', true)
    }
  }

  const removeStudent = async (id, name) => {
    if (!confirm(`Remove ${name} from this class?`)) return
    try {
      await lecturerApi.deleteStudent(id)
      toast('Student removed.')
      load()
    } catch {
      toast('Failed to remove student.', true)
    }
  }

  return (
    <div className="animate-fade-up classes-page">
      <PageHeader
        title="My Classes"
        subtitle="Create named classes (e.g. DIT1A, BTech CS Level 100), share per-class registration links, and manage students"
        actions={
          <Button size="sm" icon={<Plus size={14}/>} onClick={() => { setForm({}); setModal('class') }}>
            Add Class
          </Button>
        }
      />

      {error && <Alert variant="error" onClose={() => setError('')} style={{ marginBottom: 16 }}>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} style={{ marginBottom: 16 }}>{success}</Alert>}

      {!loading && cohorts.length > 0 && (
        <div className="classes-search-row">
          <div className="dash-search-wrap">
            <Search size={14} className="dash-search-icon" />
            <input
              className="dash-search-input"
              placeholder="Search students by name or index…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button type="button" className="dash-search-clear" onClick={() => setSearch('')}>×</button>}
          </div>
        </div>
      )}

      {loading ? (
        <Card style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}/></Card>
      ) : cohorts.length === 0 ? (
        <Card className="classes-empty">
          <GraduationCap size={40}/>
          <p>No classes yet. Add your first class to get a registration link for students.</p>
          <Button size="sm" icon={<Plus size={14}/>} onClick={() => { setForm({}); setModal('class') }}>Add Class</Button>
        </Card>
      ) : (
        cohorts.map(cohort => {
          const q = search.trim().toLowerCase()
          const students = (cohort.students || []).filter(s =>
            !q || s.name?.toLowerCase().includes(q) || s.index_number?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
          )
          if (q && !students.length) return null
          return (
          <Card key={cohort.id} className="class-card" style={{ marginBottom: 16 }}>
            <div className="class-card-head">
              <button
                type="button"
                className="class-toggle"
                onClick={() => setOpenClass(s => ({ ...s, [cohort.id]: !s[cohort.id] }))}
              >
                <GraduationCap size={18}/>
                <h2 className="class-name">{cohort.name}</h2>
                <span className="class-count">{students.length} students</span>
              </button>
              <div className="class-actions">
                <Button size="sm" variant="ghost" icon={<Edit2 size={13}/>} onClick={() => { setForm({ id: cohort.id, name: cohort.name }); setModal('class') }}>Rename</Button>
                <Button size="sm" variant="ghost" icon={<Plus size={13}/>} onClick={() => { setForm({ cohort_id: cohort.id }); setModal('student') }}>Add Student</Button>
                <Button size="sm" variant="danger" icon={<Trash2 size={13}/>} onClick={() => removeClass(cohort.id, cohort.name)}>Delete</Button>
              </div>
            </div>

            <div className="class-reg-row">
              <input readOnly value={cohort.registration_url || ''} className="class-reg-input" />
              <Button size="sm" icon={<Copy size={14}/>} onClick={() => copyLink(cohort.registration_url)}>Copy Link</Button>
            </div>

            {openClass[cohort.id] && (
              <div className="class-students">
                <div className="class-stu-toolbar">
                  <span><Users size={14}/> Students in {cohort.name}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Download size={14}/>}
                    disabled={!students.length}
                    onClick={() => exportStudentsCsv(students.map(s => ({ ...s, class_name: cohort.name })), cohort.name)}
                  >
                    Export CSV
                  </Button>
                </div>
                {students.length === 0 ? (
                  <p className="class-stu-empty">No students yet. Share the registration link above.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Index No.</th>
                          <th>Phone</th>
                          <th>Present</th>
                          <th>Last Seen</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(s => (
                          <tr key={s.id} className="dash-stu-row" onClick={() => setSelectedStudent({ ...s, class_name: cohort.name })}>
                            <td>
                              <p className="dash-stu-name">{s.name}</p>
                              <p className="dash-stu-email">{s.email}</p>
                            </td>
                            <td><code className="stu-index">{s.index_number}</code></td>
                            <td style={{ fontSize: '0.85rem' }}>{s.phone}</td>
                            <td><span className="dash-present-badge">{s.present_count || 0}</span></td>
                            <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{fmtDate(s.last_seen)}</td>
                            <td onClick={e => e.stopPropagation()}>
                              <Button size="sm" variant="ghost" icon={<Trash2 size={12}/>} onClick={() => removeStudent(s.id, s.name)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Card>
          )
        })
      )}

      <LecturerStudentDetailModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />

      <Modal
        open={modal === 'class'}
        onClose={() => setModal(null)}
        title={form.id ? 'Rename Class' : 'Add Class'}
        width={440}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Class Name"
            value={form.name || ''}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. DIT1A or BTech CS Level 100"
            icon={<GraduationCap size={14}/>}
          />
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            Each class gets its own registration link. Students who register via that link are grouped under this class.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" fullWidth onClick={() => setModal(null)}>Cancel</Button>
            <Button fullWidth loading={saving} onClick={saveClass}>{form.id ? 'Save' : 'Add Class'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'student'} onClose={() => setModal(null)} title="Add Student" width={440}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Full Name" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Kofi Mensah" />
          <Input label="Index Number" value={form.index_number || ''} onChange={e => setForm(f => ({ ...f, index_number: e.target.value.toUpperCase() }))} placeholder="e.g. 20240001" style={{ textTransform: 'uppercase' }} />
          <Input label="Email" type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. kofi@example.com" />
          <Input label="Phone" type="tel" value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 0240000000" />
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" fullWidth onClick={() => setModal(null)}>Cancel</Button>
            <Button fullWidth loading={saving} onClick={saveStudent}>Add Student</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

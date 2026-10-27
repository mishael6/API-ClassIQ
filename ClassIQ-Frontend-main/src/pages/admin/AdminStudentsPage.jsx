import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../../lib/api'
import { Card, PageHeader, Badge, Alert, Button, Modal, Input } from '../../components/ui'
import { Search, ChevronLeft, ChevronRight, User, Phone, Mail, Hash,
         BookOpen, Building, GraduationCap, CheckCircle, Edit2, Save,
         X, Calendar, Plus, Trash2 } from 'lucide-react'
import '../../components/ui/components.css'
import './adminstudents.css'

const PER_PAGE = 10

export default function AdminStudentsPage() {
  const [students,  setStudents]  = useState([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [selected,  setSelected]  = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detail,    setDetail]    = useState(null)
  const [editing,   setEditing]   = useState(false)
  const [editForm,  setEditForm]  = useState({})
  const [saving,    setSaving]    = useState(false)

  // Add student modal
  const [addModal,  setAddModal]  = useState(false)
  const [classreps, setClassreps] = useState([])
  const [addForm,   setAddForm]   = useState({
    classrep_id: '', name: '', index_number: '',
    email: '', phone: '', institution: '',
    department: '', program: '', level: ''
  })
  const [adding, setAdding] = useState(false)

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const totalPages = Math.ceil(total / PER_PAGE)

  const load = useCallback((p = page, q = search) => {
    setLoading(true)
    adminApi.getStudents({ search: q, limit: PER_PAGE, offset: (p - 1) * PER_PAGE })
      .then(r => { setStudents(r.data.students || []); setTotal(r.data.total || 0) })
      .catch(() => setError('Failed to load students.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(page, search) }, [page])

  // Load classreps for add modal
  useEffect(() => {
    adminApi.getClassreps({ status: 'approved' })
      .then(r => setClassreps(r.data.classreps || []))
      .catch(() => {})
  }, [])

  // Auto-fill institution/dept/program when classrep selected
  const handleClassrepChange = (e) => {
    const id = e.target.value
    const cr = classreps.find(c => String(c.id) === String(id))
    setAddForm(f => ({
      ...f,
      classrep_id:  id,
      institution:  cr?.institution || '',
      department:   cr?.department  || '',
      program:      cr?.program     || '',
    }))
  }

  const doSearch = () => { setPage(1); load(1, search) }

  const toast = (msg, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => isErr ? setError('') : setSuccess(''), 4000)
  }

  const openStudent = async (student) => {
    setSelected(student); setEditing(false); setDetail(null)
    setLoadingDetail(true)
    try {
      const r = await adminApi.getStudentDetail(student.id)
      setDetail(r.data)
      setEditForm({
        name: r.data.student.name, index_number: r.data.student.index_number,
        email: r.data.student.email, phone: r.data.student.phone,
        institution: r.data.student.institution, department: r.data.student.department,
        program: r.data.student.program, level: r.data.student.level,
      })
    } catch { setDetail(null) }
    finally { setLoadingDetail(false) }
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await adminApi.updateStudent({ id: selected.id, ...editForm })
      toast('Student updated successfully!')
      setEditing(false)
      load(page, search)
      const r = await adminApi.getStudentDetail(selected.id)
      setDetail(r.data)
    } catch { toast('Failed to update.', true) }
    finally { setSaving(false) }
  }

  const addStudent = async () => {
    if (!addForm.classrep_id) { toast('Please select a class rep.', true); return }
    if (!addForm.name || !addForm.index_number || !addForm.email || !addForm.phone) {
      toast('Name, index number, email and phone are required.', true); return
    }
    setAdding(true)
    try {
      // Use the classrep student endpoint via admin
      const payload = { ...addForm, user_id: addForm.classrep_id }
      await adminApi.addStudent(payload)
      toast('Student added successfully!')
      setAddModal(false)
      setAddForm({ classrep_id: '', name: '', index_number: '', email: '', phone: '', institution: '', department: '', program: '', level: '' })
      load(page, search)
    } catch (e) {
      toast(e.response?.data?.message || 'Failed to add student.', true)
    } finally { setAdding(false) }
  }

  const deleteStudent = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await adminApi.deleteStudent(deleteId)
      toast('Student deleted.')
      setDeleteId(null)
      setSelected(null)
      load(page, search)
    } catch { toast('Failed to delete.', true) }
    finally { setDeleting(false) }
  }

  const initials = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="All Students"
        subtitle={`${total.toLocaleString()} students registered across all classes`}
        actions={
          <Button size="sm" icon={<Plus size={14}/>} onClick={() => setAddModal(true)}>
            Add Student
          </Button>
        }
      />

      {error   && <Alert variant="error"   onClose={() => setError('')}   style={{ marginBottom: 16 }}>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} style={{ marginBottom: 16 }}>{success}</Alert>}

      <Card>
        <div className="stu-toolbar">
          <div className="stu-search-wrap">
            <Search size={15} className="stu-search-icon" />
            <input
              className="stu-search-input"
              placeholder="Search by name, index number or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
            />
            {search && <button className="stu-search-clear" onClick={() => { setSearch(''); setPage(1); load(1, '') }}>×</button>}
          </div>
          <Button size="sm" onClick={doSearch} icon={<Search size={14}/>}>Search</Button>
        </div>

        {loading ? (
          <div className="stu-loading">
            {Array(PER_PAGE).fill(0).map((_, i) => (
              <div key={i} className="stu-skeleton" style={{ animationDelay: `${i * 0.03}s` }} />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="stu-empty">
            <GraduationCap size={40} />
            <p>No students found</p>
            <span>{search ? 'Try a different search term' : 'No students registered yet'}</span>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Index No.</th>
                    <th>Program</th>
                    <th>Level</th>
                    <th>Class Rep</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id} className="stu-row" onClick={() => openStudent(s)}>
                      <td className="stu-num">{(page - 1) * PER_PAGE + i + 1}</td>
                      <td>
                        <button className="stu-name-btn" onClick={() => openStudent(s)}>
                          <div className="stu-mini-avatar">{initials(s.name)}</div>
                          <div>
                            <span className="stu-name">{s.name}</span>
                            <span className="stu-email">{s.email}</span>
                          </div>
                        </button>
                      </td>
                      <td><code className="stu-index">{s.index_number}</code></td>
                      <td className="stu-muted">{s.program || '—'}</td>
                      <td>{s.level ? <Badge variant="blue">L{s.level}</Badge> : '—'}</td>
                      <td className="stu-muted">{s.classrep_name || '—'}</td>
                      <td className="stu-muted">{s.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="stu-pagination">
              <span className="stu-page-info">
                Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, total)} of {total.toLocaleString()}
              </span>
              <div className="stu-page-btns">
                <button className="stu-page-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>
                  <ChevronLeft size={16}/>
                </button>
                {Array.from({length: totalPages}, (_, i) => i+1)
                  .filter(p => p===1 || p===totalPages || Math.abs(p-page)<=2)
                  .reduce((acc,p,idx,arr) => { if(idx>0 && p-arr[idx-1]>1) acc.push('...'); acc.push(p); return acc }, [])
                  .map((p,i) => p==='...'
                    ? <span key={`e${i}`} className="stu-page-ellipsis">…</span>
                    : <button key={p} className={`stu-page-btn ${page===p?'stu-page-active':''}`} onClick={()=>setPage(p)}>{p}</button>
                  )
                }
                <button className="stu-page-btn" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>
                  <ChevronRight size={16}/>
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ── Add Student Modal ── */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="➕ Add New Student" width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="field-label">Class Representative <span style={{color:'var(--red)'}}>*</span></label>
            <select className="field-select" value={addForm.classrep_id} onChange={handleClassrepChange}>
              <option value="">— Select class rep —</option>
              {classreps.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.institution || 'No institution'})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input label="Full Name *"    value={addForm.name}         onChange={e => setAddForm(f=>({...f, name: e.target.value}))}         icon={<User size={14}/>} placeholder="Kofi Mensah" />
            <Input label="Index Number *" value={addForm.index_number} onChange={e => setAddForm(f=>({...f, index_number: e.target.value.toUpperCase()}))} icon={<Hash size={14}/>} placeholder="20240001" />
            <Input label="Email *"        value={addForm.email}        onChange={e => setAddForm(f=>({...f, email: e.target.value}))}        icon={<Mail size={14}/>} type="email" placeholder="kofi@example.com" />
            <Input label="Phone *"        value={addForm.phone}        onChange={e => setAddForm(f=>({...f, phone: e.target.value}))}        icon={<Phone size={14}/>} placeholder="0240000000" />
            <Input label="Institution"    value={addForm.institution}  onChange={e => setAddForm(f=>({...f, institution: e.target.value}))}  icon={<Building size={14}/>} />
            <Input label="Department"     value={addForm.department}   onChange={e => setAddForm(f=>({...f, department: e.target.value}))}   icon={<BookOpen size={14}/>} />
            <Input label="Program"        value={addForm.program}      onChange={e => setAddForm(f=>({...f, program: e.target.value}))}      icon={<GraduationCap size={14}/>} />
            <div className="field">
              <label className="field-label">Level</label>
              <select className="field-select" value={addForm.level} onChange={e => setAddForm(f=>({...f, level: e.target.value}))}>
                <option value="">— Select —</option>
                {['100','200','300','400'].map(l => <option key={l} value={l}>Level {l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Button variant="secondary" fullWidth onClick={() => setAddModal(false)}>Cancel</Button>
            <Button variant="primary"   fullWidth loading={adding} onClick={addStudent} icon={<Plus size={14}/>}>Add Student</Button>
          </div>
        </div>
      </Modal>

      {/* ── Student Detail Modal ── */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setDetail(null); setEditing(false) }} title="" width={680}>
        {selected && (
          <div className="stu-modal">
            <div className="stu-modal-head">
              <div className="stu-modal-avatar">{initials(selected.name)}</div>
              <div className="stu-modal-title-area">
                <h3 className="stu-modal-name">{selected.name}</h3>
                <code className="stu-modal-index">{selected.index_number}</code>
              </div>
              <div className="stu-modal-actions">
                {!editing ? (
                  <>
                    <Button size="sm" variant="ghost" icon={<Edit2 size={13}/>} onClick={() => setEditing(true)}>Edit</Button>
                    <Button size="sm" variant="danger" icon={<Trash2 size={13}/>} onClick={() => setDeleteId(selected.id)}>Delete</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="secondary" icon={<X size={13}/>} onClick={() => setEditing(false)}>Cancel</Button>
                    <Button size="sm" variant="success"   icon={<Save size={13}/>} loading={saving} onClick={saveEdit}>Save</Button>
                  </>
                )}
              </div>
            </div>

            {loadingDetail ? (
              <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}/></div>
            ) : detail ? (
              <div className="stu-modal-body">
                <div className="stu-modal-stats">
                  <div className="stu-mstat"><CheckCircle size={16} style={{color:'var(--green)'}}/><span className="stu-mstat-v">{detail.attendance_count??0}</span><span className="stu-mstat-l">Times Present</span></div>
                  <div className="stu-mstat"><BookOpen size={16} style={{color:'var(--blue)'}}/><span className="stu-mstat-v">{detail.lectures_attended??0}</span><span className="stu-mstat-l">Lectures</span></div>
                  <div className="stu-mstat"><User size={16} style={{color:'var(--purple)'}}/><span className="stu-mstat-v" style={{fontSize:'0.85rem'}}>{detail.student.classrep_name||'—'}</span><span className="stu-mstat-l">Class Rep</span></div>
                </div>

                {editing ? (
                  <div className="stu-edit-grid">
                    <Input label="Full Name"    value={editForm.name}         onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}         icon={<User size={14}/>}/>
                    <Input label="Index Number" value={editForm.index_number} onChange={e=>setEditForm(f=>({...f,index_number:e.target.value.toUpperCase()}))} icon={<Hash size={14}/>}/>
                    <Input label="Email"        value={editForm.email}        onChange={e=>setEditForm(f=>({...f,email:e.target.value}))}        icon={<Mail size={14}/>} type="email"/>
                    <Input label="Phone"        value={editForm.phone}        onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))}        icon={<Phone size={14}/>}/>
                    <Input label="Institution"  value={editForm.institution}  onChange={e=>setEditForm(f=>({...f,institution:e.target.value}))}  icon={<Building size={14}/>}/>
                    <Input label="Department"   value={editForm.department}   onChange={e=>setEditForm(f=>({...f,department:e.target.value}))}   icon={<BookOpen size={14}/>}/>
                    <Input label="Program"      value={editForm.program}      onChange={e=>setEditForm(f=>({...f,program:e.target.value}))}      icon={<GraduationCap size={14}/>}/>
                    <div className="field">
                      <label className="field-label">Level</label>
                      <select className="field-select" value={editForm.level} onChange={e=>setEditForm(f=>({...f,level:e.target.value}))}>
                        <option value="">— Select —</option>
                        {['100','200','300','400'].map(l=><option key={l} value={l}>Level {l}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="stu-info-grid">
                    {[
                      { icon: <Mail size={14}/>,           label: 'Email',       value: detail.student.email },
                      { icon: <Phone size={14}/>,          label: 'Phone',       value: detail.student.phone },
                      { icon: <Building size={14}/>,       label: 'Institution', value: detail.student.institution },
                      { icon: <BookOpen size={14}/>,       label: 'Department',  value: detail.student.department },
                      { icon: <GraduationCap size={14}/>,  label: 'Program',     value: detail.student.program },
                      { icon: <Hash size={14}/>,           label: 'Level',       value: detail.student.level ? `Level ${detail.student.level}` : '—' },
                      { icon: <User size={14}/>,           label: 'Class Rep',   value: detail.student.classrep_name },
                      { icon: <Calendar size={14}/>,       label: 'Registered',  value: fmtDate(detail.student.created_at) },
                    ].map((r,i) => (
                      <div key={i} className="stu-info-row">
                        <span className="stu-info-icon">{r.icon}</span>
                        <span className="stu-info-label">{r.label}</span>
                        <span className="stu-info-value">{r.value||'—'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!editing && detail.recent_attendance?.length > 0 && (
                  <div className="stu-recent">
                    <p className="stu-recent-title">Recent Attendance</p>
                    <div className="stu-recent-list">
                      {detail.recent_attendance.map((a,i) => (
                        <div key={i} className="stu-recent-row">
                          <span className="stu-recent-date">{new Date(a.attendance_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
                          <span className="stu-recent-lec">{a.lecture_name}</span>
                          <Badge variant={a.status==='Flagged'?'flagged':'present'}>{a.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{color:'var(--muted)',textAlign:'center',padding:32}}>Failed to load details.</p>
            )}
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="🗑️ Delete Student" width={400}>
        <p style={{ fontSize: '0.9rem', color: 'var(--txt2)', marginBottom: 20, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--red)' }}>⚠️ This cannot be undone.</strong> This will permanently delete the student and all their attendance records.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" fullWidth onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" fullWidth loading={deleting} onClick={deleteStudent}>Yes, Delete</Button>
        </div>
      </Modal>
    </div>
  )
}

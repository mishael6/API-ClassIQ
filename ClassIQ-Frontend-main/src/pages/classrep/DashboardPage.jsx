import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { classrepApi } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { StatCard, Card, PageHeader, Alert, Button, Badge, Modal, Input } from '../../components/ui'
import { Users, CheckCircle, Clock, AlertCircle, QrCode,
         ChevronRight, ChevronLeft, Search, Edit2, Save, X,
         Mail, Phone, Hash, Building, BookOpen, GraduationCap,
         Calendar, Plus, Trash2, Download } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import '../../components/ui/components.css'
import './dashboard.css'

const PER_PAGE = 10
const initials = (n = '') => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function DashboardPage() {
  const { user } = useAuth()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)

  // Student detail modal
  const [selected,      setSelected]      = useState(null)
  const [detail,        setDetail]        = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [editing,       setEditing]       = useState(false)
  const [editForm,      setEditForm]      = useState({})
  const [saving,        setSaving]        = useState(false)
  const [saveMsg,       setSaveMsg]       = useState('')

  // Add student modal
  const [addModal,  setAddModal]  = useState(false)
  const [addForm,   setAddForm]   = useState({ name: '', index_number: '', email: '', phone: '', level: '' })
  const [adding,    setAdding]    = useState(false)

  // Delete
  const [deleteId,  setDeleteId]  = useState(null)
  const [deleting,  setDeleting]  = useState(false)

  // Saved lectures
  const [lectures,       setLectures]       = useState([])
  const [lectureInput,   setLectureInput]   = useState('')
  const [lectureSaving,  setLectureSaving]  = useState(false)
  const [lectureDeleting, setLectureDeleting] = useState(null)

  const loadLectures = () => {
    classrepApi.getSavedLectures()
      .then(r => setLectures(r.data.lectures || []))
      .catch(() => {})
  }

  const loadDashboard = () => {
    setLoading(true)
    classrepApi.getDashboard()
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load dashboard.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadDashboard(); loadLectures() }, [])

  const toast = (msg, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => isErr ? setError('') : setSuccess(''), 4000)
  }

  // Filter + paginate students
  const allStudents  = data?.students || []
  const filtered     = allStudents.filter(s =>
    !search ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.index_number?.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages   = Math.ceil(filtered.length / PER_PAGE)
  const pageStudents = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  useEffect(() => { setPage(1) }, [search])

  const exportCSV = () => {
    if (!allStudents.length) return
    const headers = ['Name', 'Index Number', 'Email', 'Phone', 'Level', 'Present Count']
    const rows = allStudents.map(s => [
      `"${(s.name        || '').replace(/"/g, '""')}"`,
      `"${(s.index_number|| '').replace(/"/g, '""')}"`,
      `"${(s.email       || '').replace(/"/g, '""')}"`,
      `"${(s.phone       || '').replace(/"/g, '""')}"`,
      s.level        || '',
      s.present_count || 0,
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `classiq-students-${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const openStudent = async (s) => {
    setSelected(s); setEditing(false); setSaveMsg(''); setDetail(null)
    setLoadingDetail(true)
    try {
      const r = await classrepApi.getStudentDetail(s.id)
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
      await classrepApi.updateStudent({ id: selected.id, ...editForm })
      setSaveMsg('✅ Saved!'); setEditing(false)
      loadDashboard()
      const r = await classrepApi.getStudentDetail(selected.id)
      setDetail(r.data)
      setTimeout(() => setSaveMsg(''), 3000)
    } catch { toast('Failed to update student.', true) }
    finally { setSaving(false) }
  }

  const addStudent = async () => {
    if (!addForm.name || !addForm.index_number || !addForm.email || !addForm.phone) {
      toast('All fields are required.', true); return
    }
    setAdding(true)
    try {
      // Build full student data using classrep's own info
      const payload = {
        ...addForm,
        institution: data?.classrep?.institution || data?.stats?.institution || '',
        department:  data?.classrep?.department  || data?.stats?.department  || '',
        program:     data?.classrep?.program     || data?.stats?.program     || '',
      }
      await classrepApi.addStudent(payload)
      toast('Student added successfully!')
      setAddModal(false)
      setAddForm({ name: '', index_number: '', email: '', phone: '' })
      loadDashboard()
    } catch (e) {
      toast(e.response?.data?.message || 'Failed to add student.', true)
    } finally { setAdding(false) }
  }

  const deleteStudent = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await classrepApi.deleteStudent(deleteId)
      toast('Student deleted.')
      setDeleteId(null); setSelected(null)
      loadDashboard()
    } catch { toast('Failed to delete.', true) }
    finally { setDeleting(false) }
  }

  const addLecture = async () => {
    const name = lectureInput.trim()
    if (!name) { toast('Enter a lecture name.', true); return }
    setLectureSaving(true)
    try {
      const res = await classrepApi.saveLecture(name)
      setLectures(prev => [...prev, { id: res.data.id, name: res.data.name || name }])
      setLectureInput('')
      toast('Lecture saved!')
    } catch (e) {
      toast(e.response?.data?.message || 'Failed to save lecture.', true)
    } finally { setLectureSaving(false) }
  }

  const removeLecture = async (id) => {
    if (!confirm('Delete this lecture name?')) return
    setLectureDeleting(id)
    try {
      await classrepApi.deleteSavedLecture(id)
      setLectures(prev => prev.filter(l => l.id !== id))
      toast('Lecture removed.')
    } catch { toast('Failed to delete lecture.', true) }
    finally { setLectureDeleting(null) }
  }

  if (loading) return <div className="dash-loading"><div className="spinner" /></div>

  const stats = data?.stats || {}
  const chart = data?.chart || []

  return (
    <div className="animate-fade-up dash-page">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0]} 👋`}
        subtitle="Here's what's happening with your class"
        actions={
          <Link to="/dashboard/generate-qr">
            <Button icon={<QrCode size={16}/>} size="sm">Take Attendance</Button>
          </Link>
        }
      />

      {error   && <Alert variant="error"   onClose={() => setError('')}   style={{ marginBottom: 20 }}>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} style={{ marginBottom: 20 }}>{success}</Alert>}

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Total Students"   value={stats.total_students}   icon={<Users size={20}/>}       color="blue"   change="In your class" />
        <StatCard label="Attendance Today" value={stats.attendance_today} icon={<CheckCircle size={20}/>} color="green"  change="Marked today" />
        <StatCard label="Last Session"     value={stats.last_session}     icon={<Clock size={20}/>}       color="purple" />
        <StatCard label="Pending Issues"   value={stats.pending_issues}   icon={<AlertCircle size={20}/>} color="orange" change="Needs attention" />
      </div>

      {/* App download banner */}
      <AppDownloadBanner />

      {/* Chart + Actions + Reg link */}
      <div className="dash-top-grid">
        <Card className="dash-chart-card">
          <div className="card-head">
            <h2 className="card-title">Attendance — Last 7 Days</h2>
            <Link to="/dashboard/attendance" className="card-link">View all →</Link>
          </div>
          {chart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="var(--blue)" strokeWidth={2.5}
                  dot={{ fill: 'var(--blue)', r: 4 }} activeDot={{ r: 6 }} name="Students" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-chart">No attendance data yet</p>
          )}
        </Card>

        <div className="dash-right-col">
          <Card>
            <div className="card-head" style={{ marginBottom: 14 }}>
              <h2 className="card-title">Quick Actions</h2>
            </div>
            <div className="quick-actions">
              <Link to="/dashboard/generate-qr" className="quick-btn">
                <div className="quick-icon blue"><QrCode size={22}/></div>
                <span>Take Attendance</span>
              </Link>
              <Link to="/dashboard/attendance" className="quick-btn">
                <div className="quick-icon green"><CheckCircle size={22}/></div>
                <span>View Records</span>
              </Link>
              <Link to="/dashboard/report-issue" className="quick-btn">
                <div className="quick-icon orange"><AlertCircle size={22}/></div>
                <span>Report Issue</span>
              </Link>
            </div>
          </Card>

          <Card style={{ marginTop: 16 }}>
            <div className="card-head" style={{ marginBottom: 10 }}>
              <h2 className="card-title">My Lectures</h2>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 10 }}>
              Add the lectures you teach — you'll pick from this list when generating QR codes
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                className="reg-link-input"
                placeholder="e.g. Introduction to Programming"
                value={lectureInput}
                onChange={e => setLectureInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addLecture()}
                disabled={lectureSaving}
              />
              <Button size="sm" loading={lectureSaving} onClick={addLecture} disabled={!lectureInput.trim()}>
                Add
              </Button>
            </div>
            {lectures.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0 }}>
                No lectures saved yet. Add your first lecture above.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lectures.map(lec => (
                  <div key={lec.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', background: 'var(--bg)', borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <BookOpen size={14} style={{ color: 'var(--blue)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lec.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLecture(lec.id)}
                      disabled={lectureDeleting === lec.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4, opacity: lectureDeleting === lec.id ? 0.5 : 1 }}
                      title="Delete lecture"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card style={{ marginTop: 16 }}>
            <div className="card-head" style={{ marginBottom: 10 }}>
              <h2 className="card-title">Registration Link</h2>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 10 }}>
              Share with students to register under your class
            </p>
            <div className="reg-link-box">
              <input readOnly value={`${window.location.origin}/student/register?classrep_id=${user?.id}`} className="reg-link-input" />
              <Button size="sm" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/student/register?classrep_id=${user?.id}`)}>Copy</Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Students table */}
      <Card className="dash-students-card">
        <div className="card-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="card-title">My Students</h2>
            <span className="stu-count-badge">{allStudents.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="dash-search-wrap">
              <Search size={14} className="dash-search-icon" />
              <input className="dash-search-input" placeholder="Search name or index…" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="dash-search-clear" onClick={() => setSearch('')}>×</button>}
            </div>
            <Button size="sm" variant="secondary" icon={<Download size={14}/>} onClick={exportCSV} disabled={!allStudents.length}>Export CSV</Button>
            <Button size="sm" icon={<Plus size={14}/>} onClick={() => setAddModal(true)}>Add Student</Button>
          </div>
        </div>

        {pageStudents.length === 0 ? (
          <div className="dash-stu-empty">
            <Users size={36}/>
            <p>{search ? 'No students match your search' : 'No students registered yet'}</p>
            <span>Share your registration link or click Add Student above</span>
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
                    <th>Present</th>
                    <th>Last Seen</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageStudents.map((s, i) => (
                    <tr key={s.id} className="dash-stu-row" onClick={() => openStudent(s)}>
                      <td className="stu-num">{(page - 1) * PER_PAGE + i + 1}</td>
                      <td>
                        <div className="dash-stu-cell">
                          <div className="dash-stu-avatar">{initials(s.name)}</div>
                          <div>
                            <p className="dash-stu-name">{s.name}</p>
                            <p className="dash-stu-email">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td><code className="stu-index">{s.index_number}</code></td>
                      <td style={{ color: 'var(--txt2)', fontSize: '0.85rem' }}>{s.program || '—'}</td>
                      <td>{s.level ? <Badge variant="blue">L{s.level}</Badge> : '—'}</td>
                      <td>
                        <span className="dash-present-badge">{s.present_count || 0}</span>
                        {s.flagged_count > 0 && <span className="dash-flagged-badge">{s.flagged_count}⚑</span>}
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{fmtDate(s.last_seen)}</td>
                      <td><ChevronRight size={15} style={{ color: 'var(--muted2)' }}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="dash-pagination">
                <span className="dash-page-info">
                  Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, filtered.length)} of {filtered.length}
                </span>
                <div className="dash-page-btns">
                  <button className="dash-page-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>
                    <ChevronLeft size={15}/>
                  </button>
                  {Array.from({length:totalPages},(_,i)=>i+1)
                    .filter(p=>p===1||p===totalPages||Math.abs(p-page)<=1)
                    .reduce((acc,p,idx,arr)=>{if(idx>0&&p-arr[idx-1]>1)acc.push('...');acc.push(p);return acc},[])
                    .map((p,i)=>p==='...'
                      ?<span key={`e${i}`} style={{padding:'0 4px',color:'var(--muted)'}}>…</span>
                      :<button key={p} className={`dash-page-btn ${page===p?'dash-page-active':''}`} onClick={()=>setPage(p)}>{p}</button>
                    )
                  }
                  <button className="dash-page-btn" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>
                    <ChevronRight size={15}/>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add Student Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="➕ Add Student" width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 4 }}>
            Institution, department and program will be auto-filled from your account.
          </p>
          <Input label="Full Name *"    value={addForm.name}         onChange={e=>setAddForm(f=>({...f,name:e.target.value}))}         icon={<Users size={14}/>} placeholder="e.g. Kofi Mensah" />
          <Input label="Index Number *" value={addForm.index_number} onChange={e=>setAddForm(f=>({...f,index_number:e.target.value.toUpperCase()}))} icon={<Hash size={14}/>} placeholder="e.g. 20240001" />
          <Input label="Phone *"        value={addForm.phone}        onChange={e=>setAddForm(f=>({...f,phone:e.target.value}))}        icon={<Phone size={14}/>} placeholder="e.g. 0240000000" />
          <Input label="Email *"        value={addForm.email}        onChange={e=>setAddForm(f=>({...f,email:e.target.value}))}        icon={<Mail size={14}/>} type="email" placeholder="e.g. kofi@example.com" />
          <div className="field">
            <label className="field-label">Level</label>
            <select className="field-select" value={addForm.level} onChange={e=>setAddForm(f=>({...f,level:e.target.value}))}>
              <option value="">— Select level —</option>
              {['100','200','300','400'].map(l=><option key={l} value={l}>Level {l}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Button variant="secondary" fullWidth onClick={() => setAddModal(false)}>Cancel</Button>
            <Button variant="primary"   fullWidth loading={adding} onClick={addStudent} icon={<Plus size={14}/>}>Add Student</Button>
          </div>
        </div>
      </Modal>

      {/* Student Detail Modal */}
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
                {saveMsg && <span style={{color:'var(--green)',fontSize:'0.82rem',fontWeight:600}}>{saveMsg}</span>}
                {!editing ? (
                  <>
                    <Button size="sm" variant="ghost"  icon={<Edit2 size={13}/>}  onClick={() => setEditing(true)}>Edit</Button>
                    <Button size="sm" variant="danger" icon={<Trash2 size={13}/>} onClick={() => setDeleteId(selected.id)}>Delete</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="secondary" icon={<X size={13}/>}    onClick={() => setEditing(false)}>Cancel</Button>
                    <Button size="sm" variant="success"   icon={<Save size={13}/>} loading={saving} onClick={saveEdit}>Save</Button>
                  </>
                )}
              </div>
            </div>

            {loadingDetail ? (
              <div style={{padding:40,textAlign:'center'}}><div className="spinner" style={{margin:'0 auto'}}/></div>
            ) : detail ? (
              <div className="stu-modal-body">
                <div className="stu-modal-stats">
                  <SummaryTile icon={<CheckCircle size={15} style={{color:'var(--green)'}}/>}  label="Present"   value={detail.summary?.present||0} />
                  <SummaryTile icon={<AlertCircle size={15} style={{color:'var(--orange)'}}/>} label="Flagged"   value={detail.summary?.flagged||0} />
                  <SummaryTile icon={<BookOpen size={15} style={{color:'var(--blue)'}}/>}      label="Lectures"  value={detail.summary?.lectures||0} />
                  <SummaryTile icon={<Calendar size={15} style={{color:'var(--purple)'}}/>}   label="Last Seen" value={fmtDate(detail.summary?.last_seen)} small />
                </div>

                {editing ? (
                  <div className="stu-edit-grid">
                    <Input label="Full Name"    value={editForm.name}         onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}         icon={<Users size={14}/>}/>
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
                      {icon:<Mail size={14}/>,          label:'Email',       value:detail.student.email},
                      {icon:<Phone size={14}/>,         label:'Phone',       value:detail.student.phone},
                      {icon:<Building size={14}/>,      label:'Institution', value:detail.student.institution},
                      {icon:<BookOpen size={14}/>,      label:'Department',  value:detail.student.department},
                      {icon:<GraduationCap size={14}/>, label:'Program',     value:detail.student.program},
                      {icon:<Hash size={14}/>,          label:'Level',       value:detail.student.level?`Level ${detail.student.level}`:'—'},
                      {icon:<Calendar size={14}/>,      label:'Registered',  value:fmtDate(detail.student.created_at)},
                    ].map((r,i)=>(
                      <div key={i} className="stu-info-row">
                        <span className="stu-info-icon">{r.icon}</span>
                        <span className="stu-info-label">{r.label}</span>
                        <span className="stu-info-value">{r.value||'—'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!editing && detail.history?.length > 0 && (
                  <div className="stu-recent">
                    <p className="stu-recent-title">Attendance History</p>
                    <div className="stu-recent-list">
                      {detail.history.map((a,i)=>(
                        <div key={i} className="stu-recent-row">
                          <span className="stu-recent-date">{new Date(a.attendance_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
                          <span className="stu-recent-lec">{a.lecture_name}</span>
                          <span className="stu-recent-time">{a.time_marked?.slice(0,5)}</span>
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

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="🗑️ Delete Student" width={400}>
        <p style={{fontSize:'0.9rem',color:'var(--txt2)',marginBottom:20,lineHeight:1.6}}>
          <strong style={{color:'var(--red)'}}>⚠️ This cannot be undone.</strong> This will permanently remove the student and all their attendance records.
        </p>
        <div style={{display:'flex',gap:10}}>
          <Button variant="secondary" fullWidth onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger"    fullWidth loading={deleting} onClick={deleteStudent}>Yes, Delete</Button>
        </div>
      </Modal>
    </div>
  )
}

function AppDownloadBanner() {
  // sessionStorage resets on every new login session — banner always shows fresh
  const [visible, setVisible] = useState(() => {
    try { return !sessionStorage.getItem('classiq_app_banner_dismissed') }
    catch { return true }
  })

  // Auto-dismiss after 20 minutes
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(() => setVisible(false), 20 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [visible])

  const dismiss = () => {
    try { sessionStorage.setItem('classiq_app_banner_dismissed', '1') } catch {}
    setVisible(false)
  }

  if (!visible) return null

  const features = [
    { icon: '📷', label: 'QR Attendance' },
    { icon: '🤖', label: 'AI Study' },
    { icon: '🏆', label: 'Trivia' },
    { icon: '📊', label: 'Attendance History' },
  ]

  return (
    <div className="app-banner">
      <button className="app-banner-close" onClick={dismiss} aria-label="Dismiss">×</button>
      <div className="app-banner-left">
        <div className="app-banner-icon">📱</div>
        <div>
          <p className="app-banner-title">Tell your students to download ClassIQ!</p>
          <p className="app-banner-sub">
            The free mobile app lets them scan QR codes, study with AI, join trivia challenges and track their attendance — all in one place.
          </p>
          <div className="app-banner-pills">
            {features.map(f => (
              <span key={f.label} className="app-banner-pill">{f.icon} {f.label}</span>
            ))}
          </div>
        </div>
      </div>
      <a
        href="https://class-iq.netlify.app/#download"
        target="_blank"
        rel="noopener noreferrer"
        className="app-banner-btn"
      >
        Get the App →
      </a>
    </div>
  )
}

function SummaryTile({ icon, label, value, small }) {
  return (
    <div className="stu-mstat">
      {icon}
      <span className="stu-mstat-v" style={small?{fontSize:'0.85rem'}:{}}>{value}</span>
      <span className="stu-mstat-l">{label}</span>
    </div>
  )
}
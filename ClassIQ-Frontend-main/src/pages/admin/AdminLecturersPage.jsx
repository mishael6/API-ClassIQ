import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../../lib/api'
import { Card, PageHeader, Badge, Alert, Button, Modal, Input } from '../../components/ui'
import { Search, RefreshCw, CheckCircle, XCircle, Trash2, GraduationCap,
         Clock, UserCheck, UserX, Edit2, Save, X, Mail, Building, BookOpen } from 'lucide-react'
import '../../components/ui/components.css'
import './adminclassreps.css'

const STATUS_MAP = {
  approved: { label: 'Approved', variant: 'present',  icon: <UserCheck size={12}/> },
  rejected: { label: 'Rejected', variant: 'flagged',  icon: <UserX    size={12}/> },
  pending:  { label: 'Pending',  variant: 'pending',  icon: <Clock    size={12}/> },
}

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

export default function AdminLecturersPage() {
  const [lecturers, setLecturers] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [acting, setActing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    adminApi.getLecturers({ search, status: filter === 'all' ? '' : filter })
      .then(r => setLecturers(r.data.lecturers || []))
      .catch((e) => setError(e.response?.data?.message || 'Failed to load lecturers.'))
      .finally(() => setLoading(false))
  }, [search, filter])

  useEffect(() => { load() }, [filter])

  const toast = (msg, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => isErr ? setError('') : setSuccess(''), 4000)
  }

  const handleAction = async () => {
    if (!confirm) return
    const { type, lecturer } = confirm
    setActing(lecturer.id); setConfirm(null)
    try {
      if (type === 'approve') {
        await adminApi.approveLecturer(lecturer.id)
        toast(`✅ ${lecturer.name} approved. Email & SMS sent.`)
      } else if (type === 'reject') {
        await adminApi.rejectLecturer(lecturer.id)
        toast(`⛔ ${lecturer.name} rejected.`)
      } else if (type === 'delete') {
        await adminApi.deleteLecturer(lecturer.id)
        toast(`🗑️ ${lecturer.name} deleted.`)
      }
      load()
    } catch (e) {
      toast(e.response?.data?.message || 'Action failed.', true)
    } finally { setActing(null) }
  }

  const openEdit = (l) => {
    setEditing(l)
    setEditForm({
      name: l.name || '',
      email: l.email || '',
      institution: l.institution || '',
      course: l.course || '',
    })
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await adminApi.updateLecturer({ id: editing.id, ...editForm })
      toast(`✅ ${editForm.name} updated.`)
      setEditing(null)
      load()
    } catch (e) {
      toast(e.response?.data?.message || 'Failed to update.', true)
    } finally { setSaving(false) }
  }

  const counts = lecturers.reduce((acc, l) => {
    acc[l.status || 'pending'] = (acc[l.status || 'pending'] || 0) + 1
    return acc
  }, {})

  const tabs = [
    { key: 'all', label: 'All', count: lecturers.length },
    { key: 'pending', label: 'Pending', count: counts.pending || 0 },
    { key: 'approved', label: 'Approved', count: counts.approved || 0 },
    { key: 'rejected', label: 'Rejected', count: counts.rejected || 0 },
  ]

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Lecturers"
        subtitle="Review applications — approved lecturers receive email from classiq660@gmail.com and an SMS"
        actions={<Button size="sm" variant="secondary" icon={<RefreshCw size={14}/>} onClick={load}>Refresh</Button>}
      />

      {error && <Alert variant="error" onClose={() => setError('')} style={{ marginBottom: 16 }}>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} style={{ marginBottom: 16 }}>{success}</Alert>}

      <Card>
        <div className="cr-toolbar">
          <div className="cr-search-wrap">
            <Search size={15} className="cr-search-icon" />
            <input
              className="cr-search-input"
              placeholder="Search by name, email or course…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
            />
            {search && <button className="cr-search-clear" onClick={() => { setSearch(''); load() }}>×</button>}
          </div>
          <Button size="sm" onClick={load}>Search</Button>
        </div>

        <div className="cr-tabs">
          {tabs.map(t => (
            <button key={t.key} className={`cr-tab ${filter === t.key ? 'cr-tab-active' : ''}`} onClick={() => setFilter(t.key)}>
              {t.label}
              <span className={`cr-tab-count ${filter === t.key ? 'cr-tab-count-active' : ''}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="cr-loading">
            {[1, 2, 3, 4].map(i => <div key={i} className="cr-skeleton" style={{ animationDelay: `${i * 0.08}s` }} />)}
          </div>
        ) : lecturers.length === 0 ? (
          <div className="cr-empty">
            <GraduationCap size={40} />
            <p>No lecturers found</p>
          </div>
        ) : (
          <div className="cr-list">
            {lecturers.map((l, i) => {
              const st = STATUS_MAP[l.status] || STATUS_MAP.pending
              const isActing = acting === l.id
              const isPending = !l.status || l.status === 'pending'

              return (
                <div key={l.id} className={`cr-row cr-row-${l.status || 'pending'}`} style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="cr-identity">
                    <div className={`cr-avatar cr-avatar-${l.status || 'pending'}`}>{initials(l.name)}</div>
                    <div className="cr-details">
                      <div className="cr-name-row">
                        <button className="cr-name-btn" onClick={() => openEdit(l)}>
                          {l.name}<Edit2 size={12} className="cr-edit-icon" />
                        </button>
                        <Badge variant={st.variant}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{st.icon} {st.label}</span></Badge>
                      </div>
                      <p className="cr-email">{l.email}</p>
                      <div className="cr-meta-row">
                        {l.institution && <span className="cr-meta-chip">{l.institution}</span>}
                        {l.course && <span className="cr-meta-chip">{l.course}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="cr-stats">
                    <div className="cr-stat">
                      <span className="cr-stat-val">{l.student_count || 0}</span>
                      <span className="cr-stat-lbl">Students</span>
                    </div>
                    <div className="cr-stat">
                      <span className="cr-stat-val">{l.class_count || 0}</span>
                      <span className="cr-stat-lbl">Classes</span>
                    </div>
                  </div>
                  <div className="cr-actions">
                    <Button size="sm" variant="ghost" icon={<Edit2 size={13}/>} onClick={() => openEdit(l)}>Edit</Button>
                    {isPending && (
                      <Button size="sm" variant="success" icon={<CheckCircle size={13}/>} loading={isActing}
                        onClick={() => setConfirm({ type: 'approve', lecturer: l })}>Approve</Button>
                    )}
                    {isPending && (
                      <Button size="sm" variant="warning" icon={<XCircle size={13}/>} loading={isActing}
                        onClick={() => setConfirm({ type: 'reject', lecturer: l })}>Reject</Button>
                    )}
                    {l.status === 'approved' && (
                      <Button size="sm" variant="warning" icon={<XCircle size={13}/>} loading={isActing}
                        onClick={() => setConfirm({ type: 'reject', lecturer: l })}>Revoke</Button>
                    )}
                    {l.status === 'rejected' && (
                      <Button size="sm" variant="success" icon={<CheckCircle size={13}/>} loading={isActing}
                        onClick={() => setConfirm({ type: 'approve', lecturer: l })}>Approve</Button>
                    )}
                    <Button size="sm" variant="danger" icon={<Trash2 size={13}/>} loading={isActing}
                      onClick={() => setConfirm({ type: 'delete', lecturer: l })}>Delete</Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Lecturer" width={520}>
        {editing && (
          <div className="cr-edit-grid">
            <Input label="Full Name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} icon={<GraduationCap size={14}/>} />
            <Input label="Email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} icon={<Mail size={14}/>} type="email" />
            <Input label="Institution" value={editForm.institution} onChange={e => setEditForm(f => ({ ...f, institution: e.target.value }))} icon={<Building size={14}/>} />
            <Input label="Course" value={editForm.course} onChange={e => setEditForm(f => ({ ...f, course: e.target.value }))} icon={<BookOpen size={14}/>} />
            <div className="cr-edit-footer" style={{ gridColumn: '1 / -1' }}>
              <Button variant="secondary" icon={<X size={14}/>} onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="success" icon={<Save size={14}/>} loading={saving} onClick={saveEdit}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={
        confirm?.type === 'approve' ? '✅ Approve Lecturer' :
        confirm?.type === 'reject' ? '⛔ Reject Lecturer' : '🗑️ Delete Lecturer'
      } width={440}>
        {confirm && (
          <div>
            <p className="cr-confirm-name">{confirm.lecturer.name}</p>
            <p className="cr-confirm-email">{confirm.lecturer.email}</p>
            <p className="cr-confirm-msg">
              {confirm.type === 'approve' && <>Approve this lecturer? They will receive an <strong>email from classiq660@gmail.com</strong> and an SMS to log in.</>}
              {confirm.type === 'reject' && <>Reject this application?</>}
              {confirm.type === 'delete' && <><strong className="cr-confirm-danger">This cannot be undone.</strong></>}
            </p>
            <div className="cr-confirm-btns">
              <Button variant="secondary" onClick={() => setConfirm(null)} fullWidth>Cancel</Button>
              <Button variant={confirm.type === 'approve' ? 'success' : 'danger'} onClick={handleAction} fullWidth>
                {confirm.type === 'approve' ? 'Yes, Approve' : confirm.type === 'reject' ? 'Yes, Reject' : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

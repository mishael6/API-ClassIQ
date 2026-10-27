import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../../lib/api'
import { Card, PageHeader, Badge, Alert, Button, Modal, Input } from '../../components/ui'
import { Search, RefreshCw, CheckCircle, XCircle, Trash2, Users,
         Clock, UserCheck, UserX, Edit2, Save, X,
         Mail, Phone, Building, BookOpen, GraduationCap } from 'lucide-react'
import '../../components/ui/components.css'
import './adminclassreps.css'

const STATUS_MAP = {
  approved: { label: 'Approved', variant: 'present',  icon: <UserCheck size={12}/> },
  rejected: { label: 'Rejected', variant: 'flagged',  icon: <UserX    size={12}/> },
  pending:  { label: 'Pending',  variant: 'pending',  icon: <Clock    size={12}/> },
}

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

export default function AdminClassrepsPage() {
  const [classreps, setClassreps] = useState([])
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('all')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [confirm,   setConfirm]   = useState(null)
  const [acting,    setActing]    = useState(null)

  // Edit modal state
  const [editing,   setEditing]   = useState(null)  // classrep being edited
  const [editForm,  setEditForm]  = useState({})
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    adminApi.getClassreps({ search, status: filter === 'all' ? '' : filter })
      .then(r => setClassreps(r.data.classreps || []))
      .catch(() => setError('Failed to load class representatives.'))
      .finally(() => setLoading(false))
  }, [search, filter])

  useEffect(() => { load() }, [filter])

  const toast = (msg, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => isErr ? setError('') : setSuccess(''), 4000)
  }

  const handleAction = async () => {
    if (!confirm) return
    const { type, classrep } = confirm
    setActing(classrep.id); setConfirm(null)
    try {
      if (type === 'approve') {
        await adminApi.approveClassrep(classrep.id)
        toast(`✅ ${classrep.name} has been approved.`)
      } else if (type === 'reject') {
        await adminApi.rejectClassrep(classrep.id)
        toast(`⛔ ${classrep.name} has been rejected.`)
      } else if (type === 'delete') {
        await adminApi.deleteClassrep(classrep.id)
        toast(`🗑️ ${classrep.name} deleted.`)
      }
      load()
    } catch (e) {
      toast(e.response?.data?.message || 'Action failed.', true)
    } finally { setActing(null) }
  }

  const openEdit = (cr) => {
    setEditing(cr)
    setEditForm({
      name:        cr.name        || '',
      email:       cr.email       || '',
      phone:       cr.phone       || '',
      institution: cr.institution || '',
      department:  cr.department  || '',
      program:     cr.program     || '',
    })
  }

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await adminApi.updateClassrep({ id: editing.id, ...editForm })
      toast(`✅ ${editForm.name}'s details updated.`)
      setEditing(null)
      load()
    } catch (e) {
      toast(e.response?.data?.message || 'Failed to update.', true)
    } finally { setSaving(false) }
  }

  const counts = classreps.reduce((acc, c) => {
    acc[c.status || 'pending'] = (acc[c.status || 'pending'] || 0) + 1
    return acc
  }, {})

  const tabs = [
    { key: 'all',      label: 'All',      count: classreps.length },
    { key: 'pending',  label: 'Pending',  count: counts.pending  || 0 },
    { key: 'approved', label: 'Approved', count: counts.approved || 0 },
    { key: 'rejected', label: 'Rejected', count: counts.rejected || 0 },
  ]

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Class Representatives"
        subtitle="Manage classrep accounts — click a name to edit"
        actions={
          <Button size="sm" variant="secondary" icon={<RefreshCw size={14}/>} onClick={load}>
            Refresh
          </Button>
        }
      />

      {error   && <Alert variant="error"   onClose={() => setError('')}   style={{ marginBottom: 16 }}>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} style={{ marginBottom: 16 }}>{success}</Alert>}

      <Card>
        {/* Search */}
        <div className="cr-toolbar">
          <div className="cr-search-wrap">
            <Search size={15} className="cr-search-icon" />
            <input
              className="cr-search-input"
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
            />
            {search && <button className="cr-search-clear" onClick={() => { setSearch(''); load() }}>×</button>}
          </div>
          <Button size="sm" onClick={load}>Search</Button>
        </div>

        {/* Filter tabs */}
        <div className="cr-tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`cr-tab ${filter === t.key ? 'cr-tab-active' : ''}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
              <span className={`cr-tab-count ${filter === t.key ? 'cr-tab-count-active' : ''}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="cr-loading">
            {[1,2,3,4].map(i => <div key={i} className="cr-skeleton" style={{ animationDelay: `${i * 0.08}s` }} />)}
          </div>
        ) : classreps.length === 0 ? (
          <div className="cr-empty">
            <Users size={40} />
            <p>No class representatives found</p>
            <span>{search ? 'Try a different search term' : 'No classreps in this category yet'}</span>
          </div>
        ) : (
          <div className="cr-list">
            {classreps.map((cr, i) => {
              const st       = STATUS_MAP[cr.status] || STATUS_MAP.pending
              const isActing = acting === cr.id
              const isPending = !cr.status || cr.status === 'pending' || cr.status === ''

              return (
                <div
                  key={cr.id}
                  className={`cr-row cr-row-${cr.status || 'pending'}`}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  {/* Identity */}
                  <div className="cr-identity">
                    <div className={`cr-avatar cr-avatar-${cr.status || 'pending'}`}>
                      {initials(cr.name)}
                    </div>
                    <div className="cr-details">
                      <div className="cr-name-row">
                        {/* Clickable name → opens edit modal */}
                        <button
                          className="cr-name-btn"
                          onClick={() => openEdit(cr)}
                          title="Click to edit"
                        >
                          {cr.name}
                          <Edit2 size={12} className="cr-edit-icon" />
                        </button>
                        <Badge variant={st.variant}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {st.icon} {st.label}
                          </span>
                        </Badge>
                      </div>
                      <p className="cr-email">{cr.email}</p>
                      <div className="cr-meta-row">
                        {cr.institution && <span className="cr-meta-chip">{cr.institution}</span>}
                        {cr.department  && <span className="cr-meta-chip">{cr.department}</span>}
                        {cr.program     && <span className="cr-meta-chip">{cr.program}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="cr-stats">
                    <div className="cr-stat">
                      <span className="cr-stat-val">{cr.student_count || 0}</span>
                      <span className="cr-stat-lbl">Students</span>
                    </div>
                    <div className="cr-stat">
                      <span className="cr-stat-val">
                        {cr.created_at
                          ? new Date(cr.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                          : '—'}
                      </span>
                      <span className="cr-stat-lbl">Joined</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="cr-actions">
                    <Button
                      size="sm" variant="ghost"
                      icon={<Edit2 size={13}/>}
                      onClick={() => openEdit(cr)}
                    >
                      Edit
                    </Button>
                    {isPending && (
                      <Button size="sm" variant="success" icon={<CheckCircle size={13}/>}
                        loading={isActing} onClick={() => setConfirm({ type: 'approve', classrep: cr })}>
                        Approve
                      </Button>
                    )}
                    {isPending && (
                      <Button size="sm" variant="warning" icon={<XCircle size={13}/>}
                        loading={isActing} onClick={() => setConfirm({ type: 'reject', classrep: cr })}>
                        Reject
                      </Button>
                    )}
                    {cr.status === 'approved' && (
                      <Button size="sm" variant="warning" icon={<XCircle size={13}/>}
                        loading={isActing} onClick={() => setConfirm({ type: 'reject', classrep: cr })}>
                        Revoke
                      </Button>
                    )}
                    {cr.status === 'rejected' && (
                      <Button size="sm" variant="success" icon={<CheckCircle size={13}/>}
                        loading={isActing} onClick={() => setConfirm({ type: 'approve', classrep: cr })}>
                        Approve
                      </Button>
                    )}
                    <Button size="sm" variant="danger" icon={<Trash2 size={13}/>}
                      loading={isActing} onClick={() => setConfirm({ type: 'delete', classrep: cr })}>
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── Edit Modal ── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="" width={520}>
        {editing && (
          <div className="cr-edit-modal">
            <div className="cr-edit-head">
              <div className={`cr-avatar cr-avatar-${editing.status || 'pending'}`} style={{ width: 48, height: 48, fontSize: '1rem' }}>
                {initials(editing.name)}
              </div>
              <div>
                <h3 className="cr-edit-title">Edit Class Representative</h3>
                <p className="cr-edit-sub">Changes are saved immediately</p>
              </div>
              <button className="modal-close" onClick={() => setEditing(null)} style={{ marginLeft: 'auto' }}>×</button>
            </div>

            <div className="cr-edit-grid">
              <Input label="Full Name"   value={editForm.name}        onChange={e => setEditForm(f => ({...f, name: e.target.value}))}        icon={<Users size={14}/>} />
              <Input label="Email"       value={editForm.email}       onChange={e => setEditForm(f => ({...f, email: e.target.value}))}       icon={<Mail size={14}/>} type="email" />
              <Input label="Phone"       value={editForm.phone}       onChange={e => setEditForm(f => ({...f, phone: e.target.value}))}       icon={<Phone size={14}/>} />
              <Input label="Institution" value={editForm.institution} onChange={e => setEditForm(f => ({...f, institution: e.target.value}))} icon={<Building size={14}/>} />
              <Input label="Department"  value={editForm.department}  onChange={e => setEditForm(f => ({...f, department: e.target.value}))}  icon={<BookOpen size={14}/>} />
              <Input label="Program"     value={editForm.program}     onChange={e => setEditForm(f => ({...f, program: e.target.value}))}     icon={<GraduationCap size={14}/>} />
            </div>

            <div className="cr-edit-footer">
              <Button variant="secondary" icon={<X size={14}/>} onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="success"   icon={<Save size={14}/>} loading={saving} onClick={saveEdit}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Confirm Modal ── */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={
        confirm?.type === 'approve' ? '✅ Approve Classrep' :
        confirm?.type === 'reject'  ? '⛔ Reject Classrep'  :
        '🗑️ Delete Classrep'
      } width={440}>
        {confirm && (
          <div>
            <div className="cr-confirm-info">
              <div className={`cr-avatar cr-avatar-${confirm.classrep.status || 'pending'}`} style={{ width: 48, height: 48, fontSize: '1rem' }}>
                {initials(confirm.classrep.name)}
              </div>
              <div>
                <p className="cr-confirm-name">{confirm.classrep.name}</p>
                <p className="cr-confirm-email">{confirm.classrep.email}</p>
              </div>
            </div>
            <p className="cr-confirm-msg">
              {confirm.type === 'approve' && <>Are you sure you want to <strong>approve</strong> this account? They will gain full access to their dashboard.</>}
              {confirm.type === 'reject'  && <>Are you sure you want to <strong>reject</strong> this account? They will lose access to the dashboard.</>}
              {confirm.type === 'delete'  && <><strong className="cr-confirm-danger">⚠️ This cannot be undone.</strong> Deleting will permanently remove their account, all students, attendance records and QR sessions.</>}
            </p>
            <div className="cr-confirm-btns">
              <Button variant="secondary" onClick={() => setConfirm(null)} fullWidth>Cancel</Button>
              <Button
                variant={confirm.type === 'approve' ? 'success' : 'danger'}
                onClick={handleAction} fullWidth
              >
                {confirm.type === 'approve' ? 'Yes, Approve' : confirm.type === 'reject' ? 'Yes, Reject' : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

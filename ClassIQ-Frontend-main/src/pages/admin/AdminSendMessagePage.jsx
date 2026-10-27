import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../../lib/api'
import api from '../../lib/api'
import { Card, PageHeader, Button, Alert, Badge } from '../../components/ui'
import { SmsBatchBadges } from '../../components/admin/SmsBatchBadges'
import { Send, MessageSquare, Users, User, CheckCircle,
         Phone, History, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react'
import '../../components/ui/components.css'
import './adminmessage.css'

const PER_PAGE = 15

export default function AdminSendMessagePage() {
  const [tab,      setTab]      = useState('compose')
  const [form,     setForm]     = useState({ recipient_type: 'classrep', recipient_id: '', message: '' })
  const [classreps,setClassreps]= useState([])
  const [students, setStudents] = useState([])
  const [search,   setSearch]   = useState('')
  const [success,  setSuccess]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)

  // History
  const [logs,        setLogs]        = useState([])
  const [logsTotal,   setLogsTotal]   = useState(0)
  const [logsPage,    setLogsPage]    = useState(1)
  const [logsLoading, setLogsLoading] = useState(false)

  // Derived — declared early so useEffects can use them
  const isClassrep    = form.recipient_type === 'classrep'
  const isStudent     = form.recipient_type === 'student'
  const isAllClassreps= form.recipient_type === 'all'
  const isAllStudents = form.recipient_type === 'all_students'
  const charCount     = form.message.length
  const overLimit     = charCount > 155
  const logsTotalPages= Math.ceil(logsTotal / PER_PAGE)

  // Load classreps once
  useEffect(() => {
    adminApi.getClassreps({ status: 'approved' })
      .then(r => setClassreps(r.data.classreps || []))
      .catch(() => {})
  }, [])

  // Load initial students when switching to student mode
  useEffect(() => {
    if (isStudent) {
      adminApi.getStudents({ limit: 50 })
        .then(r => setStudents(r.data.students || []))
        .catch(() => {})
    }
  }, [form.recipient_type])

  // Live search students as user types — debounced
  useEffect(() => {
    if (!isStudent) return
    const timer = setTimeout(() => {
      adminApi.getStudents({ search, limit: 50 })
        .then(r => setStudents(r.data.students || []))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Load history
  const loadLogs = useCallback((p) => {
    setLogsLoading(true)
    api.get('/admin/send_message.php', { params: { limit: PER_PAGE, offset: (p - 1) * PER_PAGE } })
      .then(r => { setLogs(r.data.logs || []); setLogsTotal(r.data.total || 0) })
      .catch(() => {})
      .finally(() => setLogsLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'history') loadLogs(logsPage)
  }, [tab, logsPage])

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError(''); setSuccess(''); setResult(null); setLoading(true)
    try {
      const { data } = await adminApi.sendMessage(form)
      setResult(data)
      setSuccess(data.message)
      setForm(f => ({ ...f, message: '' }))
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send SMS.')
    } finally { setLoading(false) }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="SMS Messages"
        subtitle="Send SMS via Payloqa to class reps and students (uses phone credits)"
      />

      {/* Tabs */}
      <div className="msg-tabs">
        <button className={`msg-tab ${tab === 'compose' ? 'active' : ''}`} onClick={() => setTab('compose')}>
          <MessageSquare size={15}/> Compose
        </button>
        <button className={`msg-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <History size={15}/> SMS History
          {logsTotal > 0 && <span className="msg-tab-badge">{logsTotal}</span>}
        </button>
      </div>

      {tab === 'compose' ? (
        <div className="msg-layout">
          <Card className="msg-compose-card">
            <div className="msg-sms-header">
              <div className="msg-sms-icon"><MessageSquare size={20}/></div>
              <div>
                <p className="msg-card-title" style={{ marginBottom: 0 }}>Compose SMS</p>
                <p className="msg-card-sub">Messages sent via Payloqa · ClassIQ</p>
              </div>
            </div>

            {error   && <Alert variant="error"   onClose={() => setError('')}   style={{ marginBottom: 16 }}>{error}</Alert>}
            {success && <Alert variant="success" onClose={() => setSuccess('')} style={{ marginBottom: 16 }}>{success}</Alert>}

            <form onSubmit={submit} className="msg-form">
              {/* Recipient toggle */}
              <div>
                <label className="field-label" style={{ marginBottom: 8, display: 'block' }}>Send To</label>
                <div className="msg-recipient-toggle" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { type: 'classrep',     icon: <User size={13}/>,  label: 'Specific Class Rep' },
                    { type: 'all',          icon: <Users size={13}/>, label: 'All Class Reps' },
                    { type: 'student',      icon: <User size={13}/>,  label: 'Specific Student' },
                    { type: 'all_students', icon: <Users size={13}/>, label: 'All Students' },
                  ].map(({ type, icon, label }) => (
                    <button
                      key={type} type="button"
                      className={`msg-toggle-btn ${form.recipient_type === type ? 'active' : ''}`}
                      onClick={() => { setForm(f => ({ ...f, recipient_type: type, recipient_id: '' })); setSearch('') }}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific recipient selector */}
              {(isClassrep || isStudent) && (
                <div className="field">
                  <label className="field-label">
                    Select {isClassrep ? 'Class Rep' : 'Student'}
                  </label>

                  {isStudent && (
                    <div className="msg-search-wrap" style={{ marginBottom: 8 }}>
                      <input
                        type="text"
                        placeholder="Search by name or index number…"
                        className="field-input"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setForm(f => ({...f, recipient_id: ''})) }}
                      />
                      {search && (
                        <button type="button" className="msg-search-clear" onClick={() => setSearch('')}>
                          <X size={13}/>
                        </button>
                      )}
                    </div>
                  )}

                  <select
                    name="recipient_id"
                    className="field-select"
                    value={form.recipient_id}
                    onChange={handle}
                    required
                    size={isStudent ? 6 : 1}
                    style={isStudent ? { height: 'auto' } : {}}
                  >
                    <option value="">— Choose a {isClassrep ? 'class rep' : 'student'} —</option>
                    {(isClassrep ? classreps : students).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.index_number ? ` (${c.index_number})` : ''} · {c.phone || 'no phone'}
                      </option>
                    ))}
                  </select>

                  {isStudent && (
                    <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 4 }}>
                      {students.length} result{students.length !== 1 ? 's' : ''} · type to search all students
                    </p>
                  )}
                </div>
              )}

              {/* All recipients banner */}
              {(isAllClassreps || isAllStudents) && (
                <div className="msg-all-banner">
                  <Users size={15}/>
                  <span>
                    Sending to <strong>
                      {isAllClassreps
                        ? classreps.filter(c => c.phone).length
                        : 'all'}
                    </strong> {isAllClassreps ? 'class reps' : 'students'} with phone numbers
                  </span>
                </div>
              )}

              {/* Message */}
              <div className="field">
                <div className="msg-label-row">
                  <label className="field-label">Message</label>
                  <span className={`msg-char-count ${overLimit ? 'over' : ''}`}>{charCount}/155</span>
                </div>
                <textarea
                  className="field-textarea"
                  name="message"
                  value={form.message}
                  onChange={handle}
                  placeholder="Type your SMS message…"
                  rows={5}
                  required
                />
                {overLimit && <p className="msg-over-warn">⚠️ Message will be truncated to 155 characters</p>}
              </div>

              {/* Preview */}
              {form.message && (
                <div className="msg-preview">
                  <p className="msg-preview-label">Preview</p>
                  <div className="msg-preview-bubble">
                    {form.message.slice(0, 155)}
                    {overLimit && <span className="msg-preview-truncated">…</span>}
                  </div>
                  <p className="msg-preview-from">From: ClassIQ</p>
                </div>
              )}

              <Button
                type="submit" fullWidth loading={loading} size="lg"
                icon={<Send size={16}/>}
                disabled={!form.message.trim() || ((isClassrep || isStudent) && !form.recipient_id)}
              >
                Send SMS
              </Button>
            </form>
          </Card>

          {/* Right panel */}
          <div className="msg-result-panel">
            {result && (
              <Card style={{ marginBottom: 16 }}>
                <h2 className="msg-card-title">Delivery Result</h2>
                <div className="msg-result-content">
                  <div className="msg-result-row success">
                    <CheckCircle size={16}/>
                    <span><strong>{result.sms_sent}</strong> SMS sent successfully</span>
                  </div>
                  {result.errors?.length > 0 && (
                    <div className="msg-result-errors" style={{ marginTop: 10 }}>
                      <p className="msg-err-title">⚠️ {result.errors.length} failed:</p>
                      {result.errors.map((e, i) => <p key={i} className="msg-err-item">{e}</p>)}
                    </div>
                  )}
                  {result.batches?.length > 0 && (
                    <SmsBatchBadges batches={result.batches} />
                  )}
                </div>
              </Card>
            )}

            <Card>
              <h2 className="msg-card-title">SMS Info</h2>
              <div className="msg-setup-section">
                <div className="msg-setup-icon sms-icon"><MessageSquare size={16}/></div>
                <div style={{ flex: 1 }}>
                  <p className="msg-setup-title">Payloqa SMS</p>
                  <p className="msg-setup-desc">Render environment variables:</p>
                  <div className="msg-env-list">
                    <code>PAYLOQA_API_KEY=your-key</code>
                    <code>PAYLOQA_SENDER=ClassIQ</code>
                  </div>
                </div>
              </div>
              <div className="msg-setup-divider" />
              <div className="msg-setup-section">
                <div className="msg-setup-icon phone-icon"><Phone size={16}/></div>
                <div style={{ flex: 1 }}>
                  <p className="msg-setup-title">Phone Numbers</p>
                  <p className="msg-setup-desc">
                    Ghana numbers auto-converted to international format (233XXXXXXXXX).
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* History Tab */
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="msg-card-title" style={{ margin: 0 }}>SMS History</h2>
            <Button size="sm" variant="secondary" icon={<RefreshCw size={13}/>} onClick={() => loadLogs(logsPage)}>
              Refresh
            </Button>
          </div>

          {logsLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}/></div>
          ) : logs.length === 0 ? (
            <div className="msg-history-empty">
              <History size={40}/>
              <p>No SMS sent yet</p>
              <span>Messages will appear here after you send them</span>
            </div>
          ) : (
            <>
              <div className="msg-history-list">
                {logs.map((log, i) => (
                  <div key={i} className="msg-history-row">
                    <div className="msg-history-left">
                      <div className={`msg-history-avatar ${log.recipient_type === 'student' ? 'student' : 'classrep'}`}>
                        {log.recipient_type === 'student' ? <User size={14}/> : <Users size={14}/>}
                      </div>
                      <div className="msg-history-info">
                        <p className="msg-history-name">{log.recipient_name}</p>
                        <p className="msg-history-meta">
                          <span className="msg-history-phone">{log.recipient_phone}</span>
                          <span className="msg-history-dot">·</span>
                          <span className="msg-history-type">{log.recipient_type === 'student' ? 'Student' : 'Class Rep'}</span>
                        </p>
                        <p className="msg-history-msg">"{log.message}"</p>
                      </div>
                    </div>
                    <div className="msg-history-right">
                      <Badge variant={log.status === 'sent' ? 'present' : 'flagged'}>
                        {log.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                      </Badge>
                      <p className="msg-history-time">
                        {new Date(log.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' '}
                        {new Date(log.sent_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {logsTotalPages > 1 && (
                <div className="msg-history-pagination">
                  <span className="msg-history-page-info">
                    Page {logsPage} of {logsTotalPages} · {logsTotal} total
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="stu-page-btn" disabled={logsPage === 1} onClick={() => setLogsPage(p => p - 1)}>
                      <ChevronLeft size={15}/>
                    </button>
                    <button className="stu-page-btn" disabled={logsPage === logsTotalPages} onClick={() => setLogsPage(p => p + 1)}>
                      <ChevronRight size={15}/>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  )
}

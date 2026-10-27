import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../../lib/api'
import { Card, PageHeader, Button, Alert, Badge } from '../../components/ui'
import {
  Bell, Send, History, RefreshCw, ChevronLeft, ChevronRight,
  Copy, CheckCircle, Sparkles, Sun, QrCode,
} from 'lucide-react'
import '../../components/ui/components.css'
import '../admin/adminmessage.css'

const PER_PAGE = 15
const API_BASE = import.meta.env.VITE_API_URL || 'https://api-classiq.onrender.com'

export default function AdminPushPage() {
  const [tab, setTab] = useState('compose')
  const [form, setForm] = useState({ title: 'ClassIQ', body: '', role: 'student' })
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [subs, setSubs] = useState(0)

  const [logs, setLogs] = useState([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const [logsLoading, setLogsLoading] = useState(false)

  const [vapidKeys, setVapidKeys] = useState(null)
  const [vapidLoading, setVapidLoading] = useState(false)
  const [vapidError, setVapidError] = useState('')
  const [vapidStatus, setVapidStatus] = useState(null)
  const [vapidStatusLoading, setVapidStatusLoading] = useState(false)

  const logsTotalPages = Math.ceil(logsTotal / PER_PAGE)

  useEffect(() => {
    adminApi.getPushHistory({ limit: 1 })
      .then(r => setSubs(r.data.active_subscriptions || 0))
      .catch(() => {})
    checkVapidStatus()
  }, [])

  const checkVapidStatus = () => {
    setVapidStatusLoading(true)
    adminApi.getVapidStatus()
      .then(r => setVapidStatus(r.data))
      .catch(() => setVapidStatus(null))
      .finally(() => setVapidStatusLoading(false))
  }

  const loadLogs = useCallback((p) => {
    setLogsLoading(true)
    adminApi.getPushHistory({ limit: PER_PAGE, offset: (p - 1) * PER_PAGE })
      .then(r => { setLogs(r.data.logs || []); setLogsTotal(r.data.total || 0); setSubs(r.data.active_subscriptions || 0) })
      .catch(() => {})
      .finally(() => setLogsLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'history') loadLogs(logsPage)
  }, [tab, logsPage, loadLogs])

  const submit = async e => {
    e.preventDefault()
    setError(''); setSuccess(''); setResult(null); setLoading(true)
    try {
      const { data } = await adminApi.sendPush(form)
      setResult(data)
      if (data.failed > 0) {
        setError(data.errors?.[0] || data.message)
        setSuccess('')
      } else {
        setSuccess(data.message)
        setError('')
      }
      setForm(f => ({ ...f, body: '' }))
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send push notification.')
    } finally { setLoading(false) }
  }

  const generateVapidKeys = async () => {
    setVapidLoading(true); setVapidError(''); setVapidKeys(null)
    try {
      const { data } = await adminApi.generateVapidKeys()
      setVapidKeys(data)
      if (data.sign_test !== 'ok') {
        setVapidError('Keys generated but signing test failed on server.')
      }
    } catch (err) {
      setVapidError(err.response?.data?.message || 'Failed to generate keys.')
    } finally { setVapidLoading(false) }
  }

  const copyText = (text) => navigator.clipboard.writeText(text).then(() => alert('Copied!'))

  const typeBadge = (type) => {
    const map = {
      manual: 'present', attendance: 'present', motivation: 'flagged', feature: 'flagged',
    }
    const labels = {
      manual: 'Manual', attendance: 'Attendance', motivation: 'Morning', feature: 'Feature Tip',
    }
    return <Badge variant={map[type] || 'default'}>{labels[type] || type || 'Push'}</Badge>
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Push Notifications"
        subtitle={`Send app notifications to PWA users · ${subs} active subscription${subs !== 1 ? 's' : ''}`}
      />

      <div className="msg-tabs">
        <button className={`msg-tab ${tab === 'compose' ? 'active' : ''}`} onClick={() => setTab('compose')}>
          <Bell size={15}/> Send Push
        </button>
        <button className={`msg-tab ${tab === 'auto' ? 'active' : ''}`} onClick={() => setTab('auto')}>
          <Sparkles size={15}/> Automatic
        </button>
        <button className={`msg-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <History size={15}/> History
          {logsTotal > 0 && <span className="msg-tab-badge">{logsTotal}</span>}
        </button>
      </div>

      {tab === 'compose' && (
        <div className="msg-layout">
          <Card className="msg-compose-card">
            <div className="msg-sms-header">
              <div className="msg-sms-icon push-icon"><Bell size={20}/></div>
              <div>
                <p className="msg-card-title" style={{ marginBottom: 0 }}>Compose Push Notification</p>
                <p className="msg-card-sub">Free · delivered to installed PWA users only</p>
              </div>
            </div>

            {subs === 0 && (
              <Alert variant="error" style={{ marginBottom: 16 }}>
                <strong>0 devices registered.</strong> Push cannot be sent until at least one student enables notifications in the ClassIQ PWA (Settings → Enable Push → Allow). On iPhone they must open the app from the Home Screen icon, not Safari.
              </Alert>
            )}
            {error   && <Alert variant="error"   onClose={() => setError('')}   style={{ marginBottom: 16 }}>{error}</Alert>}
            {success && <Alert variant="success" onClose={() => setSuccess('')} style={{ marginBottom: 16 }}>{success}</Alert>}

            <form onSubmit={submit} className="msg-form">
              <div className="field">
                <label className="field-label">Send To</label>
                <select name="role" className="field-select" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="student">All Students (with push enabled)</option>
                  <option value="classrep">All Class Reps (with push enabled)</option>
                  <option value="all">Everyone subscribed</option>
                </select>
              </div>

              <div className="field">
                <label className="field-label">Notification Title</label>
                <input className="field-input" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="ClassIQ" />
              </div>

              <div className="field">
                <label className="field-label">Message</label>
                <textarea className="field-textarea" value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Type your notification message…" rows={5} required />
              </div>

              <Button type="submit" fullWidth loading={loading} size="lg" icon={<Send size={16}/>}
                disabled={!form.body.trim() || subs === 0}>
                Send Push Notification
              </Button>
            </form>
          </Card>

          <div className="msg-result-panel">
            {result && (
              <Card style={{ marginBottom: 16 }}>
                <h2 className="msg-card-title">Delivery Result</h2>
                <div className="msg-result-row success">
                  <CheckCircle size={16}/>
                  <span>Sent to <strong>{result.sent}</strong> of <strong>{result.total}</strong> devices</span>
                </div>
                {result.failed > 0 && <p className="msg-over-warn">{result.failed} failed</p>}
              </Card>
            )}

            <Card>
              <h2 className="msg-card-title">VAPID Setup</h2>
              <p className="msg-setup-desc">
                Required for push to work. Generate keys, paste <strong>values only</strong> into Render (no quotes, no spaces).
              </p>
              {vapidStatus && (
                <div style={{ marginTop: 10, marginBottom: 8 }}>
                  {vapidStatus.can_sign ? (
                    <p className="msg-setup-desc" style={{ color: 'var(--green)' }}>
                      ✓ Server can sign VAPID tokens
                      {vapidStatus.using_defaults ? ' (using default keys — set Render env vars!)' : ''}
                      {!vapidStatus.env_pair_valid && vapidStatus.env_keys_set ? ' — but your Render keys do NOT match each other!' : ''}
                    </p>
                  ) : (
                    <p className="msg-over-warn">{vapidStatus.message || 'VAPID signing failed on server.'}</p>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <Button size="sm" variant="secondary" loading={vapidLoading} onClick={generateVapidKeys}>
                  Generate VAPID Keys
                </Button>
                <Button size="sm" variant="secondary" loading={vapidStatusLoading} onClick={checkVapidStatus}>
                  Test Render Keys
                </Button>
              </div>
              {vapidError && <p className="msg-over-warn" style={{ marginTop: 8 }}>{vapidError}</p>}
              {vapidKeys && (
                <div className="msg-env-list" style={{ marginTop: 10 }}>
                  {vapidKeys.sign_test === 'ok' && (
                    <p className="msg-setup-desc" style={{ color: 'var(--green)', marginBottom: 8 }}>✓ Signing test passed — safe to paste into Render</p>
                  )}
                  {[
                    ['VAPID_PUBLIC_KEY', vapidKeys.VAPID_PUBLIC_KEY],
                    ['VAPID_PRIVATE_KEY', vapidKeys.VAPID_PRIVATE_KEY],
                    ['VAPID_SUBJECT', vapidKeys.VAPID_SUBJECT],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <code style={{ flex: 1, wordBreak: 'break-all' }}>{label}={val}</code>
                      <button type="button" className="msg-search-clear" onClick={() => copyText(val)} title="Copy value only"><Copy size={13}/></button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'auto' && (
        <div className="msg-layout">
          <Card>
            <h2 className="msg-card-title">Automatic Push Notifications</h2>
            <p className="msg-setup-desc" style={{ marginBottom: 20 }}>
              These run without admin action. Students must have push enabled in the PWA.
            </p>

            <div className="auto-push-list">
              <div className="auto-push-item">
                <div className="auto-push-icon present"><QrCode size={18}/></div>
                <div>
                  <p className="msg-setup-title">Attendance Confirmation</p>
                  <p className="msg-setup-desc">
                    Sent instantly when a student successfully scans QR and marks attendance.
                    Example: <em>"Attendance Marked ✅ — You're present for CS101!"</em>
                  </p>
                  <Badge variant="present">Always active</Badge>
                </div>
              </div>

              <div className="auto-push-item">
                <div className="auto-push-icon morning"><Sun size={18}/></div>
                <div>
                  <p className="msg-setup-title">Morning Motivation</p>
                  <p className="msg-setup-desc">
                    Random motivational message sent every morning (6am–10am Ghana time) to all subscribed students.
                  </p>
                  <Badge variant="flagged">Daily · 6–10am</Badge>
                </div>
              </div>

              <div className="auto-push-item">
                <div className="auto-push-icon feature"><Sparkles size={18}/></div>
                <div>
                  <p className="msg-setup-title">App Feature Tips</p>
                  <p className="msg-setup-desc">
                    Rotating tips about Trivia, AI Study, Scanner, Leaderboard — sent Mon, Wed, Fri mornings.
                  </p>
                  <Badge variant="flagged">Mon / Wed / Fri</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="msg-card-title">Schedule Morning Messages (Cron)</h2>
            <p className="msg-setup-desc">
              For push when the app is closed, set up a free cron job at{' '}
              <a href="https://cron-job.org" target="_blank" rel="noreferrer">cron-job.org</a>:
            </p>
            <div className="msg-env-list" style={{ marginTop: 12 }}>
              <code>URL: {API_BASE}/push/cron_daily.php?secret=YOUR_SECRET</code>
              <code>Schedule: Every day at 7:00 AM</code>
              <code>Render env: PUSH_CRON_SECRET=your-random-secret</code>
            </div>
            <p className="msg-setup-desc" style={{ marginTop: 12 }}>
              Fallback: when students open the app in the morning, messages are also triggered automatically.
            </p>
          </Card>
        </div>
      )}

      {tab === 'history' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="msg-card-title" style={{ margin: 0 }}>Push History</h2>
            <Button size="sm" variant="secondary" icon={<RefreshCw size={13}/>} onClick={() => loadLogs(logsPage)}>Refresh</Button>
          </div>

          {logsLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}/></div>
          ) : logs.length === 0 ? (
            <div className="msg-history-empty">
              <Bell size={40}/>
              <p>No push notifications sent yet</p>
            </div>
          ) : (
            <>
              <div className="msg-history-list">
                {logs.map((log, i) => (
                  <div key={i} className="msg-history-row">
                    <div className="msg-history-left">
                      <div className="msg-history-avatar student"><Bell size={14}/></div>
                      <div className="msg-history-info">
                        <p className="msg-history-name">{log.title}</p>
                        <p className="msg-history-msg">"{log.body}"</p>
                        <p className="msg-history-meta">
                          {log.sent_count} sent · {log.failed_count} failed
                        </p>
                      </div>
                    </div>
                    <div className="msg-history-right">
                      {typeBadge(log.message_type)}
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
                  <span className="msg-history-page-info">Page {logsPage} of {logsTotalPages}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="stu-page-btn" disabled={logsPage === 1} onClick={() => setLogsPage(p => p - 1)}><ChevronLeft size={15}/></button>
                    <button className="stu-page-btn" disabled={logsPage === logsTotalPages} onClick={() => setLogsPage(p => p + 1)}><ChevronRight size={15}/></button>
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

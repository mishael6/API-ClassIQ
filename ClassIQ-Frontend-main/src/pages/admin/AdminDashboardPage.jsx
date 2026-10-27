import { useState, useEffect } from 'react'
import { adminApi } from '../../lib/api'
import { StatCard, Card, PageHeader, Alert, Button } from '../../components/ui'
import { SmsBatchBadges } from '../../components/admin/SmsBatchBadges'
import { useNavigate } from 'react-router-dom'
import {
  Users, GraduationCap, QrCode, ClipboardList,
  AlertCircle, TrendingUp, Download, Smartphone,
  CreditCard, UserPlus, Send, X, MessageSquare, Bell,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import '../../components/ui/components.css'
import '../classrep/dashboard.css'

function DaysRemainingBadge({ days }) {
  const color = days <= 3 ? '#E53E3E' : days <= 7 ? '#D69E2E' : '#38A169'
  const bg    = days <= 3 ? '#E53E3E18' : days <= 7 ? '#D69E2E18' : '#38A16918'
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 999,
      fontSize: '0.78rem', fontWeight: 700,
      color, background: bg,
    }}>
      {days === 0 ? 'Expires today' : `${days}d left`}
    </span>
  )
}

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const [data,    setData]    = useState(null)
  const [trivia,  setTrivia]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkMsg,  setBulkMsg]  = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkError, setBulkError] = useState('')
  const [promptLimit, setPromptLimit] = useState(30)
  const [promptLimitInput, setPromptLimitInput] = useState('30')
  const [promptLimitSaving, setPromptLimitSaving] = useState(false)
  const [promptLimitMsg, setPromptLimitMsg] = useState('')
  const [promptLimitErr, setPromptLimitErr] = useState('')

  useEffect(() => {
    Promise.allSettled([
      adminApi.getDashboard(),
      adminApi.getTriviaLeaderboard(5),
      adminApi.getAiSettings(),
    ])
      .then(([dash, triviaRes, aiRes]) => {
        if (dash.status === 'fulfilled') setData(dash.value.data)
        else setError('Failed to load dashboard.')

        if (triviaRes.status === 'fulfilled') {
          setTrivia(triviaRes.value.data.leaderboard || [])
        }

        if (aiRes.status === 'fulfilled') {
          const limit = Number(aiRes.value.data.free_prompt_limit) || 30
          setPromptLimit(limit)
          setPromptLimitInput(String(limit))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="dash-loading"><div className="spinner" /></div>

  const s  = data?.stats         || {}
  const subs = data?.subscriptions || []
  const signupChart = data?.signup_chart || []

  const handleResetTrivia = () => {
    if (confirm('Are you sure you want to reset the trivia leaderboard? This cannot be undone.')) {
      adminApi.resetTriviaLeaderboard()
        .then(() => {
          alert('Leaderboard reset successfully!');
          window.location.reload();
        })
        .catch(() => alert('Failed to reset leaderboard.'));
    }
  }

  const handleSendBulkSms = async () => {
    if (!bulkMsg.trim()) return
    setBulkLoading(true)
    setBulkError('')
    setBulkResult(null)
    try {
      const { data } = await adminApi.sendBulkSms(bulkMsg.trim())
      setBulkResult(data)
    } catch (err) {
      setBulkError(err.response?.data?.message || 'Failed to send bulk SMS.')
    } finally {
      setBulkLoading(false)
    }
  }

  const closeBulkModal = () => {
    setBulkOpen(false)
    setBulkMsg('')
    setBulkResult(null)
    setBulkError('')
  }

  const handleSavePromptLimit = async () => {
    const limit = parseInt(promptLimitInput, 10)
    if (!limit || limit < 1 || limit > 999) {
      setPromptLimitErr('Enter a number between 1 and 999.')
      return
    }
    setPromptLimitSaving(true)
    setPromptLimitErr('')
    setPromptLimitMsg('')
    try {
      const { data } = await adminApi.updateAiPromptLimit(limit)
      setPromptLimit(limit)
      setPromptLimitInput(String(limit))
      setPromptLimitMsg(data.message || 'Prompt limit updated.')
    } catch (err) {
      setPromptLimitErr(err.response?.data?.message || 'Failed to update prompt limit.')
    } finally {
      setPromptLimitSaving(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Admin Dashboard" subtitle="System-wide overview of ClassIQ" />
      {error && <Alert variant="error">{error}</Alert>}

      <div style={{ marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Button onClick={() => setBulkOpen(true)} icon={<MessageSquare size={16}/>} variant="secondary">
          Bulk SMS to Students
        </Button>
        <Button onClick={() => navigate('/admin/push')} icon={<Bell size={16}/>}>
          Push Notifications
        </Button>
      </div>

      {bulkOpen && (
        <div className="bulk-modal-overlay" onClick={closeBulkModal}>
          <div className="bulk-modal" onClick={e => e.stopPropagation()}>
            <div className="bulk-modal-head">
              <h3>Bulk SMS to All Students</h3>
              <button className="bulk-modal-close" onClick={closeBulkModal}><X size={18}/></button>
            </div>

            {bulkError && <Alert variant="error" onClose={() => setBulkError('')}>{bulkError}</Alert>}
            {bulkResult && (
              <Alert variant="success">{bulkResult.message}</Alert>
            )}

            <textarea
              className="field-textarea"
              placeholder="Type your message (max 155 chars for SMS)…"
              rows={4}
              value={bulkMsg}
              onChange={e => setBulkMsg(e.target.value)}
              disabled={bulkLoading}
            />
            <p className={`msg-char-count ${bulkMsg.length > 155 ? 'over' : ''}`} style={{ textAlign: 'right', marginTop: 4 }}>
              {bulkMsg.length}/155
            </p>

            {bulkResult?.batches && <SmsBatchBadges batches={bulkResult.batches} />}

            <div className="bulk-modal-actions">
              <Button variant="secondary" onClick={closeBulkModal}>Close</Button>
              <Button
                onClick={handleSendBulkSms}
                loading={bulkLoading}
                disabled={!bulkMsg.trim() || bulkLoading}
                icon={<Send size={15}/>}
              >
                Send to All Students
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Trivia Leaderboard ── */}
      <Card style={{ marginBottom: 24, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderRadius: 12, overflow: 'hidden' }}>
        <div className="card-head" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title" style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🏆</span> Top 5 Trivia Students
          </h2>
          <button onClick={handleResetTrivia} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            Reset Leaderboard
          </button>
        </div>
        {trivia.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontStyle: 'italic' }}>No trivia data available at the moment.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {trivia.map((student, i) => (
              <div key={student.student_id} style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: i !== trivia.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.2s' }}>
                <div style={{ 
                  width: 36, height: 36, borderRadius: '50%', 
                  background: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--blue)', 
                  color: i < 3 ? 'black' : 'white', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', marginRight: 16, fontSize: '0.9rem' 
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{student.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{student.institution} • {student.program}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color: 'var(--blue)', fontSize: '1.2rem' }}>{student.total_points}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Points</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Main Stats ── */}
      <div className="stats-grid">
        <StatCard label="Total Class Reps"   value={s.total_classreps}    icon={<Users size={20}/>}         color="blue"   />
        <StatCard label="Total Students"     value={s.total_students}     icon={<GraduationCap size={20}/>} color="green"  />
        <StatCard label="Unassigned Students" value={s.students_no_classrep} icon={<UserPlus size={20}/>}     color="red"    />
        <StatCard label="Total Sessions"     value={s.total_sessions}     icon={<QrCode size={20}/>}        color="purple" />
        <StatCard label="Students Online"    value={s.students_online}    icon={<Smartphone size={20}/>}    color="green"  />
        <StatCard label="Total Records"      value={s.total_attendance}   icon={<ClipboardList size={20}/>} color="orange" />
        <StatCard label="Pending Issues"     value={s.pending_issues}     icon={<AlertCircle size={20}/>}   color="red"    />
        <StatCard label="Today's Attendance" value={s.today_attendance}   icon={<TrendingUp size={20}/>}    color="green"  />
        <StatCard label="App Downloads"      value={s.app_downloads}      icon={<Download size={20}/>}      color="blue"   />
        <StatCard label="Mobile Signups"     value={s.mobile_signups}     icon={<Smartphone size={20}/>}    color="purple" />
      </div>

      {/* ── Mobile & Subscription Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>

        {/* Mobile signups card */}
        <Card>
          <div className="card-head">
            <h2 className="card-title">📱 Mobile App Signups</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Total Mobile Signups', value: s.mobile_signups    || 0, color: 'var(--blue)'   },
              { label: 'New This Week',         value: s.new_students_week  || 0, color: 'var(--green)'  },
              { label: 'New This Month',        value: s.new_students_month || 0, color: 'var(--purple)' },
              { label: 'Total Students',        value: s.total_students     || 0, color: 'var(--muted)'  },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--txt2)' }}>{item.label}</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Subscription stats card */}
        <Card>
          <div className="card-head">
            <h2 className="card-title">✨ Six AI Subscriptions</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Active Subscribers', value: s.active_subscriptions || 0,                         color: 'var(--green)'  },
              { label: 'Total Revenue',      value: `GHS ${Number(s.subscription_revenue || 0).toFixed(2)}`, color: 'var(--blue)'   },
              { label: 'Free Prompt Limit',  value: `${promptLimit} / 2hrs`,                               color: 'var(--purple)' },
              { label: 'Expiring in 3 days', value: subs.filter(s => s.days_remaining <= 3).length,      color: 'var(--red)'    },
              { label: 'Expiring in 7 days', value: subs.filter(s => s.days_remaining <= 7).length,      color: 'var(--orange)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--txt2)' }}>{item.label}</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--txt2)', marginBottom: 8 }}>
              Free chat prompt limit (per student, per 2-hour window)
            </label>
            {promptLimitErr && <Alert variant="error" onClose={() => setPromptLimitErr('')}>{promptLimitErr}</Alert>}
            {promptLimitMsg && <Alert variant="success" onClose={() => setPromptLimitMsg('')}>{promptLimitMsg}</Alert>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                min={1}
                max={999}
                value={promptLimitInput}
                onChange={e => setPromptLimitInput(e.target.value)}
                className="field-input"
                style={{ flex: 1, maxWidth: 120 }}
                disabled={promptLimitSaving}
              />
              <Button onClick={handleSavePromptLimit} loading={promptLimitSaving} disabled={promptLimitSaving}>
                Save
              </Button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 8, marginBottom: 0 }}>
              Subscribers and admin-granted students still get unlimited access.
            </p>
          </div>
        </Card>

        {/* System summary card */}
        <Card>
          <div className="card-head">
            <h2 className="card-title">⚙️ System Summary</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Flagged Records',  value: s.flagged_total   || 0, color: 'var(--red)'    },
              { label: 'Outside Records',  value: s.outside_total   || 0, color: 'var(--orange)'  },
              { label: 'Active Sessions',  value: s.active_sessions || 0, color: 'var(--green)'   },
              { label: 'Issues Resolved',  value: s.resolved_issues || 0, color: 'var(--blue)'    },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--txt2)' }}>{item.label}</span>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Charts ── */}
      <div className="dash-grid" style={{ marginBottom: 24 }}>
        <Card>
          <div className="card-head"><h2 className="card-title">📊 Attendance — Last 14 Days</h2></div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data?.chart || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
              <Bar dataKey="count" fill="var(--blue)" radius={[4,4,0,0]} name="Students" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div className="card-head"><h2 className="card-title">👥 Student Signups — Last 14 Days</h2></div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={signupChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="var(--green)" strokeWidth={2} dot={{ r: 3 }} name="Signups" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Active Subscriptions Table ── */}
      <Card>
        <div className="card-head">
          <h2 className="card-title">✨ Active Six Subscriptions</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            {subs.length} active subscriber{subs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {subs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
            <CreditCard size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: '0.9rem' }}>No active subscriptions yet</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Student', 'Index No.', 'Institution', 'Amount', 'Start Date', 'End Date', 'Time Left'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.map((sub, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: sub.days_remaining <= 3 ? 'rgba(229,62,62,0.04)' : 'transparent' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text)' }}>{sub.student_name}</td>
                    <td style={{ padding: '12px', color: 'var(--txt2)', fontFamily: 'monospace' }}>{sub.index_number}</td>
                    <td style={{ padding: '12px', color: 'var(--txt2)' }}>{sub.institution || '—'}</td>
                    <td style={{ padding: '12px', color: 'var(--green)', fontWeight: 700 }}>GHS {Number(sub.amount).toFixed(2)}</td>
                    <td style={{ padding: '12px', color: 'var(--txt2)' }}>{sub.start_date}</td>
                    <td style={{ padding: '12px', color: 'var(--txt2)' }}>{sub.end_date}</td>
                    <td style={{ padding: '12px' }}>
                      <DaysRemainingBadge days={sub.days_remaining} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  )
}

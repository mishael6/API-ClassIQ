
import { useState, useEffect, useRef, useCallback } from 'react'
import { adminApi } from '../../lib/api'
import { messagesApi } from '../../lib/api'
import { Card, PageHeader, Badge, Alert, Button } from '../../components/ui'
import { Send, RefreshCw, CheckCircle, Clock, RotateCcw, MessageSquare } from 'lucide-react'
import '../../components/ui/components.css'
import './adminissues.css'

const POLL_THREAD_MS = 3000
const POLL_LIST_MS = 10000

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

const timeAgo = (dt) => {
  if (!dt) return ''
  const diff = Date.now() - new Date(dt).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(dt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const messagesChanged = (prev, next) => {
  if (prev.length !== next.length) return true
  return prev.some((m, i) => (m.id ?? i) !== (next[i]?.id ?? i) || m.message !== next[i]?.message)
}

export default function AdminIssuesPage() {
  const [issues,   setIssues]   = useState([])
  const [filter,   setFilter]   = useState('all')
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState(null)
  const [thread,   setThread]   = useState([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [reply,    setReply]    = useState('')
  const [sending,  setSending]  = useState(false)
  const [live,     setLive]     = useState(false)
  const bottomRef = useRef(null)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    adminApi.getIssues({ status: filter === 'all' ? '' : filter })
      .then(r => {
        const next = r.data.issues || []
        setIssues(next)
        setSelected(prev => {
          if (!prev) return prev
          const updated = next.find(i => i.id === prev.id)
          return updated ? { ...prev, ...updated } : prev
        })
      })
      .catch(() => { if (!silent) setError('Failed to load issues.') })
      .finally(() => { if (!silent) setLoading(false) })
  }, [filter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const id = setInterval(() => load(true), POLL_LIST_MS)
    return () => clearInterval(id)
  }, [load])

  const refreshThread = useCallback(async (issueId, silent = true) => {
    try {
      const r = await messagesApi.getThread(issueId)
      const next = r.data.messages || []
      setThread(prev => messagesChanged(prev, next) ? next : prev)
      if (r.data.issue) {
        setSelected(prev => prev ? { ...prev, ...r.data.issue } : prev)
      }
    } catch {
      if (!silent) setError('Failed to refresh conversation.')
    }
  }, [])

  useEffect(() => {
    if (!selected?.id) {
      setLive(false)
      return undefined
    }
    setLive(true)
    refreshThread(selected.id)
    const id = setInterval(() => refreshThread(selected.id), POLL_THREAD_MS)
    return () => { clearInterval(id); setLive(false) }
  }, [selected?.id, refreshThread])

  const openIssue = async (issue) => {
    setSelected(issue)
    setLoadingThread(true)
    setThread([])
    try {
      const r = await messagesApi.getThread(issue.id)
      setThread(r.data.messages || [])
    } catch { setThread([]) }
    finally { setLoadingThread(false) }
    load(true)
  }

  // Scroll to bottom when thread updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  const sendReply = async () => {
    if (!reply.trim() || !selected) return
    setSending(true)
    try {
      await messagesApi.sendMessage({ issue_id: selected.id, message: reply.trim() })
      setReply('')
      await refreshThread(selected.id)
      load(true)
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to send message.'
      setError(msg)
    }
    finally { setSending(false) }
  }

  const resolveIssue = async (id) => {
    try {
      await adminApi.updateIssue({ id, status: 'resolved' })
      load()
      if (selected?.id === id) setSelected(s => ({ ...s, status: 'resolved' }))
    } catch { setError('Failed to update issue.') }
  }

  const reopenIssue = async (id) => {
    try {
      await adminApi.updateIssue({ id, status: 'pending' })
      load()
      if (selected?.id === id) setSelected(s => ({ ...s, status: 'pending' }))
    } catch { setError('Failed to update issue.') }
  }

  const tabs = [
    { key: 'all',      label: 'All' },
    { key: 'pending',  label: 'Pending' },
    { key: 'resolved', label: 'Resolved' },
  ]

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Reported Issues"
        subtitle="View and respond to issues from class representatives & students"
        actions={
          <Button size="sm" variant="secondary" icon={<RefreshCw size={14}/>} onClick={() => load()}>
            Refresh
          </Button>
        }
      />

      {error && <Alert variant="error" onClose={() => setError('')} style={{ marginBottom: 16 }}>{error}</Alert>}

      <div className="issues-layout">
        {/* ── Left panel — issue list ── */}
        <div className="issues-list-panel">
          {/* Filter tabs */}
          <div className="issues-tabs">
            {tabs.map(t => (
              <button
                key={t.key}
                className={`issues-tab ${filter === t.key ? 'issues-tab-active' : ''}`}
                onClick={() => setFilter(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="issues-loading">
              {[1,2,3,4,5].map(i => <div key={i} className="issues-skeleton" />)}
            </div>
          ) : issues.length === 0 ? (
            <div className="issues-empty-list">
              <MessageSquare size={32} />
              <p>No issues found</p>
            </div>
          ) : (
            <div className="issues-list">
              {issues.map(issue => (
                <button
                  key={issue.id}
                  className={`issue-item ${selected?.id === issue.id ? 'issue-item-active' : ''} ${issue.unread_count > 0 ? 'issue-item-unread' : ''}`}
                  onClick={() => openIssue(issue)}
                >
                  <div className={`issue-item-avatar ${issue.user_type === 'student' ? 'issue-avatar-student' : ''}`}>{initials(issue.classrep_name)}</div>
                  <div className="issue-item-content">
                    <div className="issue-item-top">
                      <span className="issue-item-name">
                        {issue.classrep_name || 'Unknown'}
                        <span className={`issue-type-tag ${issue.user_type === 'student' ? 'issue-type-student' : 'issue-type-classrep'}`}>
                          {issue.user_type === 'student' ? '📱 Student' : '👤 Classrep'}
                        </span>
                      </span>
                      <span className="issue-item-time">{timeAgo(issue.created_at)}</span>
                    </div>
                    <p className="issue-item-subject">{issue.subject}</p>
                    <div className="issue-item-bottom">
                      <Badge variant={issue.status === 'resolved' ? 'present' : 'pending'}>
                        {issue.status === 'resolved' ? '✅ Resolved' : '🕐 Pending'}
                      </Badge>
                      {issue.unread_count > 0 && (
                        <span className="issue-unread-badge">{issue.unread_count}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right panel — chat thread ── */}
        <div className="issues-chat-panel">
          {!selected ? (
            <div className="issues-chat-empty">
              <MessageSquare size={48} />
              <h3>Select an Issue</h3>
              <p>Click on an issue from the list to view the conversation</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="chat-header">
                <div className="chat-header-left">
                  <div className="chat-avatar">{initials(selected.classrep_name)}</div>
                  <div>
                    <p className="chat-header-name">{selected.classrep_name}</p>
                    <p className="chat-header-email">{selected.classrep_email}</p>
                  </div>
                </div>
                <div className="chat-header-actions">
                  {selected.status !== 'resolved' ? (
                    <Button
                      size="sm"
                      variant="success"
                      icon={<CheckCircle size={13}/>}
                      onClick={() => resolveIssue(selected.id)}
                    >
                      Mark Resolved
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<RotateCcw size={13}/>}
                      onClick={() => reopenIssue(selected.id)}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>

              {/* Issue subject */}
              <div className="chat-subject">
                <span className="chat-subject-label">Subject:</span>
                <span className="chat-subject-text">{selected.subject}</span>
                {live && <span className="chat-live-badge">● Live</span>}
              </div>

              {/* Messages */}
              <div className="chat-messages">
                {/* Original issue message as first bubble */}
                <div className={`chat-bubble ${selected.user_type === 'student' ? 'chat-bubble-student' : 'chat-bubble-classrep'}`}>
                  <div className="chat-bubble-meta">
                    <span className="chat-bubble-sender">
                      {selected.user_type === 'student' ? '📱 ' : ''}{selected.classrep_name}
                    </span>
                    <span className="chat-bubble-time">{timeAgo(selected.created_at)}</span>
                  </div>
                  <div className="chat-bubble-text">{selected.body || selected.message}</div>
                </div>

                {loadingThread ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)', fontSize: '0.85rem' }}>
                    Loading conversation…
                  </div>
                ) : (
                  thread.map((msg, i) => {
                    const isAdmin = msg.sender_role === 'admin'
                    const isStudent = msg.sender_role === 'student'
                    const senderLabel = isAdmin ? '🛡️ Admin' : isStudent ? '📱 ' + (selected.classrep_name || 'Student') : selected.classrep_name
                    return (
                      <div
                        key={i}
                        className={`chat-bubble ${isAdmin ? 'chat-bubble-admin' : isStudent ? 'chat-bubble-student' : 'chat-bubble-classrep'}`}
                      >
                        <div className="chat-bubble-meta">
                          <span className="chat-bubble-sender">
                            {senderLabel}
                          </span>
                          <span className="chat-bubble-time">{timeAgo(msg.created_at)}</span>
                        </div>
                        <div className="chat-bubble-text">{msg.message}</div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Reply box */}
              <div className="chat-reply-box">
                <textarea
                  className="chat-reply-input"
                  placeholder={selected.status === 'closed' ? 'This issue is closed.' : 'Type your reply…'}
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  disabled={selected.status === 'closed'}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendReply()
                    }
                  }}
                  rows={3}
                />
                <Button
                  variant="primary"
                  icon={<Send size={15}/>}
                  loading={sending}
                  disabled={!reply.trim() || selected.status === 'closed'}
                  onClick={sendReply}
                >
                  Send
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
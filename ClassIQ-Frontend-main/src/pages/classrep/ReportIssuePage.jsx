import { useState, useEffect, useRef, useCallback } from 'react'
import { classrepApi } from '../../lib/api'
import { messagesApi } from '../../lib/api'
import { Card, PageHeader, Button, Alert } from '../../components/ui'
import { Send, Plus, MessageSquare, ChevronLeft } from 'lucide-react'
import '../../components/ui/components.css'
import './reportissue.css'

const POLL_THREAD_MS = 3000
const POLL_LIST_MS = 10000

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

export default function ReportIssuePage() {
  const [view,      setView]      = useState('list')   // list | thread | new
  const [issues,    setIssues]    = useState([])
  const [selected,  setSelected]  = useState(null)
  const [thread,    setThread]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [reply,     setReply]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [newForm,   setNewForm]   = useState({ subject: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [live, setLive] = useState(false)
  const bottomRef = useRef(null)

  const loadIssues = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    classrepApi.getMyIssues()
      .then(r => setIssues(r.data.issues || []))
      .catch(() => { if (!silent) setError('Failed to load issues.') })
      .finally(() => { if (!silent) setLoading(false) })
  }, [])

  useEffect(() => { loadIssues() }, [loadIssues])

  useEffect(() => {
    if (view !== 'list') return undefined
    const id = setInterval(() => loadIssues(true), POLL_LIST_MS)
    return () => clearInterval(id)
  }, [view, loadIssues])

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
    if (view !== 'thread' || !selected?.id) {
      setLive(false)
      return undefined
    }
    setLive(true)
    refreshThread(selected.id)
    const id = setInterval(() => refreshThread(selected.id), POLL_THREAD_MS)
    return () => { clearInterval(id); setLive(false) }
  }, [view, selected?.id, refreshThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  const openThread = async (issue) => {
    setSelected(issue)
    setView('thread')
    setLoadingThread(true)
    try {
      const r = await messagesApi.getThread(issue.id)
      setThread(r.data.messages || [])
    } catch { setThread([]) }
    finally { setLoadingThread(false) }
    loadIssues(true)
  }

  const sendReply = async () => {
    if (!reply.trim() || !selected) return
    setSending(true)
    try {
      await messagesApi.sendMessage({ issue_id: selected.id, message: reply.trim() })
      setReply('')
      await refreshThread(selected.id)
      loadIssues(true)
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to send.'
      setError(msg)
    } finally { setSending(false) }
  }

  const submitNew = async e => {
    e.preventDefault()
    if (!newForm.subject || !newForm.message) return
    setSubmitting(true)
    try {
      await classrepApi.reportIssue(newForm)
      setSuccess('Issue submitted! Admin will respond shortly.')
      setNewForm({ subject: '', message: '' })
      setView('list')
      loadIssues()
      setTimeout(() => setSuccess(''), 4000)
    } catch { setError('Failed to submit issue.') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Issues & Support"
        subtitle="Report problems and chat with the admin"
        actions={
          view !== 'new' && (
            <Button
              size="sm"
              icon={<Plus size={14}/>}
              onClick={() => setView('new')}
            >
              New Issue
            </Button>
          )
        }
      />

      {error   && <Alert variant="error"   onClose={() => setError('')}   style={{ marginBottom: 16 }}>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} style={{ marginBottom: 16 }}>{success}</Alert>}

      {/* ── New issue form ── */}
      {view === 'new' && (
        <Card className="animate-fade-up">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button
              onClick={() => setView('list')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', fontFamily: 'var(--font-body)' }}
            >
              <ChevronLeft size={16} /> Back
            </button>
            <h2 style={{ fontFamily: 'var(--font-head)', fontSize: '1rem', fontWeight: 700 }}>New Issue Report</h2>
          </div>
          <form onSubmit={submitNew} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="field">
              <label className="field-label">Subject</label>
              <input
                className="field-input"
                placeholder="Brief description of the issue"
                value={newForm.subject}
                onChange={e => setNewForm(f => ({ ...f, subject: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label className="field-label">Message</label>
              <textarea
                className="field-textarea"
                placeholder="Describe the problem in detail…"
                value={newForm.message}
                onChange={e => setNewForm(f => ({ ...f, message: e.target.value }))}
                rows={6}
                required
              />
            </div>
            <Button type="submit" loading={submitting} icon={<Send size={14}/>}>Submit Issue</Button>
          </form>
        </Card>
      )}

      {/* ── Issue list ── */}
      {view === 'list' && (
        <Card>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <div key={i} className="issues-skeleton" style={{ height: 72 }} />)}
            </div>
          ) : issues.length === 0 ? (
            <div className="ri-empty">
              <MessageSquare size={40} />
              <p>No issues reported yet</p>
              <span>Click "New Issue" to get started</span>
            </div>
          ) : (
            <div className="ri-list">
              {issues.map(issue => (
                <button
                  key={issue.id}
                  className={`ri-item ${issue.unread_count > 0 ? 'ri-item-unread' : ''}`}
                  onClick={() => openThread(issue)}
                >
                  <div className="ri-item-icon">
                    <MessageSquare size={18} />
                  </div>
                  <div className="ri-item-content">
                    <div className="ri-item-top">
                      <span className="ri-item-subject">{issue.subject}</span>
                      <span className="ri-item-time">{timeAgo(issue.created_at)}</span>
                    </div>
                    <div className="ri-item-bottom">
                      <span className={`ri-status ri-status-${issue.status}`}>
                        {issue.status === 'resolved' ? '✅ Resolved' : '🕐 Pending'}
                      </span>
                      {issue.unread_count > 0 && (
                        <span className="ri-unread">{issue.unread_count} new</span>
                      )}
                    </div>
                  </div>
                  <ChevronLeft size={16} style={{ transform: 'rotate(180deg)', color: 'var(--muted2)' }} />
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Thread view ── */}
      {view === 'thread' && selected && (
        <Card className="animate-fade-up" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Thread header */}
          <div className="ri-thread-header">
            <button
              className="ri-back-btn"
              onClick={() => { setView('list'); setSelected(null); setThread([]) }}
            >
              <ChevronLeft size={16} /> Back
            </button>
            <div>
              <p className="ri-thread-subject">{selected.subject}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span className={`ri-status ri-status-${selected.status}`}>
                  {selected.status === 'resolved' ? '✅ Resolved' : '🕐 Pending'}
                </span>
                {live && <span className="ri-live-badge">● Live</span>}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="ri-chat-messages">
            {/* Original message */}
            <div className="chat-bubble chat-bubble-classrep">
              <div className="chat-bubble-meta">
                <span className="chat-bubble-sender">You</span>
                <span className="chat-bubble-time">{timeAgo(selected.created_at)}</span>
              </div>
              <div className="chat-bubble-text">{selected.body || selected.message}</div>
            </div>

            {loadingThread ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)', fontSize: '0.85rem' }}>
                Loading…
              </div>
            ) : (
              thread.map((msg, i) => {
                const isAdmin = msg.sender_role === 'admin'
                return (
                  <div
                    key={i}
                    className={`chat-bubble ${isAdmin ? 'chat-bubble-admin' : 'chat-bubble-classrep'}`}
                  >
                    <div className="chat-bubble-meta">
                      <span className="chat-bubble-sender">{isAdmin ? '🛡️ Admin' : 'You'}</span>
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
              placeholder={selected.status === 'resolved' ? 'Reply to reopen this issue…' : 'Type your reply… (Enter to send)'}
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() }
              }}
              rows={3}
            />
            <Button
              variant="primary"
              icon={<Send size={15}/>}
              loading={sending}
              disabled={!reply.trim()}
              onClick={sendReply}
            >
              Send
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

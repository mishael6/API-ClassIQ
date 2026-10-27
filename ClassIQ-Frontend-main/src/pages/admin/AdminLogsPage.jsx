import { useState, useEffect } from 'react'
import { adminApi } from '../../lib/api'
import { Card, PageHeader, Alert } from '../../components/ui'
import '../../components/ui/components.css'

export default function AdminLogsPage() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    adminApi.getLogs()
      .then(r => setLogs(r.data.logs || []))
      .catch(() => setError('Failed to load logs.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="animate-fade-up">
      <PageHeader title="Login Logs" subtitle="Track all login activity" />
      {error && <Alert variant="error">{error}</Alert>}
      <Card>
        {loading ? (
          <p style={{ color: 'var(--muted)', padding: 24 }}>Loading…</p>
        ) : logs.length === 0 ? (
          <p style={{ color: 'var(--muted)', padding: 24 }}>No logs found.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>IP Address</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i}>
                    <td>{log.name || log.user_id}</td>
                    <td>{log.role}</td>
                    <td>{log.ip_address || '—'}</td>
                    <td>{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</td>
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
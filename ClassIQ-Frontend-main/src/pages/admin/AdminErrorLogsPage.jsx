import { useState, useEffect } from 'react'
import { adminApi } from '../../lib/api'
import { Card, PageHeader, Alert, Button, Table } from '../../components/ui'
import { RefreshCw } from 'lucide-react'
import '../../components/ui/components.css'

export default function AdminErrorLogsPage() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = () => {
    setLoading(true)
    adminApi.getErrorLogs()
      .then(r => setLogs(r.data.logs || []))
      .catch(() => setError('Failed to load error logs.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  return (
    <div className="animate-fade-up">
      <PageHeader title="Error Logs" subtitle="Global application errors & exceptions"
        actions={<Button size="sm" variant="secondary" icon={<RefreshCw size={14}/>} onClick={load}>Refresh</Button>}
      />
      {error && <Alert variant="error" onClose={() => setError('')} style={{ marginBottom: 16 }}>{error}</Alert>}
      <Card>
        {logs.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 40, color: 'var(--green)', fontWeight: 600 }}>✅ No errors logged</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {logs.map((log, i) => (
              <div key={i} style={{
                background: 'var(--red-lt)', border: '1px solid #fca5a5',
                borderRadius: 'var(--radius)', padding: '16px',
                fontFamily: 'Courier New, monospace', fontSize: '0.82rem',
                color: '#7f1d1d', lineHeight: 1.6
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, borderBottom: '1px solid #fca5a5', paddingBottom: 8 }}>
                  <strong>{log.time || new Date(log.created_at).toLocaleString()}</strong>
                  <span style={{ opacity: 0.7, wordBreak: 'break-all', marginLeft: 16 }}>{log.url}</span>
                </div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{log.message}</div>
                {log.stack && (
                  <pre style={{ margin: 0, padding: 8, background: 'rgba(255,255,255,0.4)', borderRadius: 4, overflowX: 'auto', fontSize: '0.75rem' }}>
                    {log.stack}
                  </pre>
                )}
                {log.user_agent && (
                  <div style={{ marginTop: 8, opacity: 0.6, fontSize: '0.7rem' }}>
                    Agent: {log.user_agent}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../../lib/api'
import { Card, PageHeader, Table, Badge, Alert, Button } from '../../components/ui'
import { RefreshCw, ChevronLeft, ChevronRight, XCircle } from 'lucide-react'
import '../../components/ui/components.css'

const PER_PAGE = 10

export default function AdminQRSessionsPage() {
  const [data, setData]       = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [endingId, setEndingId] = useState(null)

  const totalPages = Math.ceil(total / PER_PAGE) || 1

  const load = useCallback((p = page) => {
    setLoading(true)
    adminApi.getQrSessions({ limit: PER_PAGE, offset: (p - 1) * PER_PAGE })
      .then(r => { 
        setData(r.data.sessions || [])
        setTotal(r.data.total || 0)
      })
      .catch(() => setError('Failed to load.'))
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load(page) }, [page, load])

  const toast = (msg, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg)
    setTimeout(() => isErr ? setError('') : setSuccess(''), 4000)
  }

  const endSession = async (id) => {
    if (!confirm('Are you sure you want to end this active session?')) return
    setEndingId(id)
    try {
      await adminApi.endQrSession({ id, action: 'end' })
      toast('Session ended successfully.')
      load(page)
    } catch {
      toast('Failed to end session.', true)
    } finally {
      setEndingId(null)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="QR Sessions" subtitle="All attendance sessions generated"
        actions={<Button size="sm" variant="secondary" icon={<RefreshCw size={14}/>} onClick={() => load(page)}>Refresh</Button>}
      />
      
      {error && <Alert variant="error" onClose={() => setError('')} style={{ marginBottom: 16 }}>{error}</Alert>}
      {success && <Alert variant="success" onClose={() => setSuccess('')} style={{ marginBottom: 16 }}>{success}</Alert>}
      
      <Card>
        <Table
          columns={[
            { key: 'id',           label: 'ID' },
            { key: 'classrep_name',label: 'Class Rep' },
            { key: 'lecture_name', label: 'Lecture' },
            { key: 'code',         label: 'Code' },
            { key: 'radius_m',     label: 'Radius', render: r => `${r.radius_m || 100}m` },
            { key: 'created_at',   label: 'Created', render: r => new Date(r.created_at).toLocaleString() },
            { key: 'ended_at',     label: 'Status', render: r => r.ended_at
              ? <Badge variant="default">Ended at {new Date(r.ended_at).toLocaleTimeString()}</Badge>
              : <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Badge variant="present">🟢 Active</Badge>
                  <Button 
                    size="xs" 
                    variant="danger" 
                    icon={<XCircle size={12}/>} 
                    loading={endingId === r.id}
                    onClick={() => endSession(r.id)}
                  >
                    End
                  </Button>
                </div>
            },
          ]}
          data={data}
          emptyText="No QR sessions found."
        />

        {total > 0 && (
          <div className="stu-pagination" style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
            <span className="stu-page-info">
              Showing {(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, total)} of {total.toLocaleString()} sessions
            </span>
            <div className="stu-page-btns">
              <button className="stu-page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={16}/>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx-1] > 1) acc.push('...')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) => p === '...'
                  ? <span key={`e${i}`} className="stu-page-ellipsis">…</span>
                  : <button key={p} className={`stu-page-btn ${page === p ? 'stu-page-active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                )
              }
              <button className="stu-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={16}/>
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

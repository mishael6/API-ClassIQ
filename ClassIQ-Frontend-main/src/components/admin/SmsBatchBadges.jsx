import { Badge } from '../../components/ui'

export function SmsBatchBadges({ batches = [] }) {
  if (!batches.length) return null

  const variantMap = {
    success: 'present',
    partial: 'flagged',
    failed:  'blocked',
  }

  const labelMap = {
    success: '✓ Sent',
    partial: '⚠ Partial',
    failed:  '✗ Failed',
  }

  return (
    <div className="sms-batch-wrap">
      <p className="sms-batch-title">Delivery Batches ({batches.length})</p>
      <div className="sms-batch-grid">
        {batches.map(b => (
          <div key={b.batch} className={`sms-batch-card sms-batch-${b.status}`}>
            <div className="sms-batch-header">
              <span className="sms-batch-num">Batch {b.batch}</span>
              <Badge variant={variantMap[b.status] || 'default'}>
                {labelMap[b.status] || b.status}
              </Badge>
            </div>
            <p className="sms-batch-stats">
              <strong>{b.sent}</strong> sent · <strong>{b.failed}</strong> failed · {b.total} total
            </p>
            {b.errors?.length > 0 && (
              <p className="sms-batch-err">
                {b.errors[0]}{b.errors.length > 1 ? ` (+${b.errors.length - 1} more)` : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

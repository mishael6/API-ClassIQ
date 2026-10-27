import { useState } from 'react'
import { Loader2 } from 'lucide-react'

/* ── Button ─────────────────────────────────────────────────── */
export function Button({
  children, onClick, type = 'button', variant = 'primary',
  size = 'md', disabled, loading, fullWidth, icon, className = '', ...rest
}) {
  const base = `btn btn-${variant} btn-${size}${fullWidth ? ' btn-full' : ''}${className ? ' ' + className : ''}`
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={base} {...rest}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}

/* ── Input ──────────────────────────────────────────────────── */
export function Input({
  label, id, error, helper, icon, className = '', ...props
}) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <div className="field-wrap">
        {icon && <span className="field-icon">{icon}</span>}
        <input id={id} className={`field-input${icon ? ' has-icon' : ''}${error ? ' has-error' : ''}`} {...props} />
      </div>
      {error  && <p className="field-error">{error}</p>}
      {helper && <p className="field-helper">{helper}</p>}
    </div>
  )
}

/* ── Select ─────────────────────────────────────────────────── */
export function Select({ label, id, error, children, className = '', ...props }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <select id={id} className={`field-select${error ? ' has-error' : ''}`} {...props}>
        {children}
      </select>
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

/* ── Textarea ───────────────────────────────────────────────── */
export function Textarea({ label, id, error, className = '', ...props }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      <textarea id={id} className={`field-textarea${error ? ' has-error' : ''}`} {...props} />
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

/* ── Card ───────────────────────────────────────────────────── */
export function Card({ children, className = '', padding = true, ...rest }) {
  return (
    <div className={`card${padding ? ' card-pad' : ''}${className ? ' ' + className : ''}`} {...rest}>
      {children}
    </div>
  )
}

/* ── Badge ──────────────────────────────────────────────────── */
export function Badge({ children, variant = 'default' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

/* ── Alert ──────────────────────────────────────────────────── */
export function Alert({ children, variant = 'info', onClose }) {
  return (
    <div className={`alert alert-${variant}`}>
      <span>{children}</span>
      {onClose && <button onClick={onClose} className="alert-close">×</button>}
    </div>
  )
}

/* ── Spinner ────────────────────────────────────────────────── */
export function Spinner({ size = 24 }) {
  return <Loader2 size={size} className="animate-spin" style={{ color: 'var(--blue)' }} />
}

/* ── Modal ──────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, width = 500 }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: width }} onClick={e => e.stopPropagation()}>
        {title && (
          <div className="modal-head">
            <h3 className="modal-title">{title}</h3>
            <button onClick={onClose} className="modal-close">×</button>
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

/* ── Table ──────────────────────────────────────────────────── */
export function Table({ columns, data, emptyText = 'No records found.', rowClassName }) {
  if (!data?.length) {
    return <p className="table-empty">{emptyText}</p>
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className={rowClassName?.(row)}>
              {columns.map(c => (
                <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Stat Card ──────────────────────────────────────────────── */
export function StatCard({ label, value, icon, color = 'blue', change }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        <div className={`stat-icon stat-icon-${color}`}>{icon}</div>
      </div>
      <div className="stat-value">{value ?? '—'}</div>
      {change && <div className="stat-change">{change}</div>}
    </div>
  )
}

/* ── Page Header ────────────────────────────────────────────── */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

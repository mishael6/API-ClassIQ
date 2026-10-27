import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../../lib/api'
import { Button, Input, Alert } from '../../components/ui'
import { Mail, Lock, User, Building, BookOpen } from 'lucide-react'
import '../../components/ui/components.css'
import '../classrep/auth.css'

export default function LecturerRegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', institution: '', course: '', email: '', password: '', confirm_password: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError(''); setSuccess('')
    if (form.password !== form.confirm_password) { setError('Passwords do not match.'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    try {
      const { data } = await authApi.registerLecturer(form)
      if (data.success) {
        setSuccess('Application submitted! Wait for admin approval, then check your email.')
        setTimeout(() => navigate('/login'), 4000)
      } else {
        setError(data.message || 'Registration failed.')
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide animate-fade-up">
        <div className="auth-logo">
          <img src="/logo.png" alt="ClassIQ" className="brand-logo" />
          <h1 className="auth-title">Lecturer Registration</h1>
          <p className="auth-sub">Apply to teach on ClassIQ</p>
        </div>

        {error && <Alert variant="error" onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <form onSubmit={submit} className="auth-form">
          <div className="auth-grid">
            <Input label="Full Name" name="name" value={form.name} onChange={handle} placeholder="Kofi Mensah" icon={<User size={15}/>} required />
            <Input label="Email" name="email" type="email" value={form.email} onChange={handle} placeholder="you@example.com" icon={<Mail size={15}/>} required />
            <Input label="Institution" name="institution" value={form.institution} onChange={handle} placeholder="KsTU" icon={<Building size={15}/>} required />
            <Input label="Course" name="course" value={form.course} onChange={handle} icon={<BookOpen size={15}/>} required placeholder="e.g. Introduction to Programming" />
            <Input label="Password" name="password" type="password" value={form.password} onChange={handle} placeholder="Min. 6 characters" icon={<Lock size={15}/>} required />
            <Input label="Confirm Password" name="confirm_password" type="password" value={form.confirm_password} onChange={handle} placeholder="Repeat password" icon={<Lock size={15}/>} required />
          </div>
          <Button type="submit" fullWidth loading={loading} size="lg" style={{ marginTop: 8 }}>Submit Application</Button>
        </form>

        <p className="auth-foot">
          <Link to="/get-started" className="auth-link">← Back</Link> · Already registered? <Link to="/login" className="auth-link">Log in</Link>
        </p>
      </div>
    </div>
  )
}

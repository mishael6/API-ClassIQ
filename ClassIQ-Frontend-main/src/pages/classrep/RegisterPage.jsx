import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../../lib/api'
import { Button, Input, Alert } from '../../components/ui'
import { Mail, Lock, User, Phone, Building, BookOpen, GraduationCap } from 'lucide-react'
import '../../components/ui/components.css'
import './auth.css'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', email: '', phone: '', institution: '',
    department: '', program: '', password: '', confirm_password: ''
  })
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError(''); setSuccess('')

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.'); return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.'); return
    }

    setLoading(true)
    try {
      const { data } = await authApi.register(form)
      if (data.success) {
        setSuccess('Account created! Wait for admin approval before logging in.')
        setTimeout(() => navigate('/login'), 3000)
      } else {
        setError(data.message || 'Registration failed.')
      }
    } catch (err) {
      const msg = err?.response?.data?.message
      if (msg) {
        setError(msg)
      } else if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
        setError('Unable to reach the server. Please check your internet connection.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide animate-fade-up">
        <div className="auth-logo">
          <img src="/logo.png" alt="ClassIQ" className="brand-logo" />
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-sub">Register as a Class Representative</p>
        </div>

        {error   && <Alert variant="error"   onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert variant="success" onClose={() => setSuccess('')}>{success}</Alert>}

        <form onSubmit={submit} className="auth-form">
          <div className="auth-grid">
            <Input label="Full Name"    name="name"        value={form.name}        onChange={handle} placeholder="Kofi Mensah"           icon={<User         size={15}/>} required />
            <Input label="Email"        name="email"       value={form.email}       onChange={handle} placeholder="you@example.com"        icon={<Mail         size={15}/>} type="email" required />
            <Input label="Phone"        name="phone"       value={form.phone}       onChange={handle} placeholder="0240000000"             icon={<Phone        size={15}/>} />
            <Input label="Institution"  name="institution" value={form.institution} onChange={handle} placeholder="KsTU"                  icon={<Building     size={15}/>} />
            <Input label="Department"   name="department"  value={form.department}  onChange={handle} placeholder="e.g. Computer Science"  icon={<BookOpen     size={15}/>} />
            <Input label="Program"      name="program"     value={form.program}     onChange={handle} placeholder="e.g. HND Computing"     icon={<GraduationCap size={15}/>} />
            <Input label="Password"     name="password"    value={form.password}    onChange={handle} placeholder="Min. 6 characters"      icon={<Lock         size={15}/>} type="password" required />
            <Input label="Confirm Password" name="confirm_password" value={form.confirm_password} onChange={handle} placeholder="Repeat password" icon={<Lock size={15}/>} type="password" required />
          </div>
          <Button type="submit" fullWidth loading={loading} size="lg" style={{ marginTop: 8 }}>
            Create Account
          </Button>
        </form>

        <p className="auth-foot">
          Already have an account? <Link to="/login" className="auth-link">Sign in here</Link>
        </p>
      </div>
    </div>
  )
}

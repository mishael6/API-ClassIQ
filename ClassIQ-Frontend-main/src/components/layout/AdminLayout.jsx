import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Users, GraduationCap, QrCode,
  ClipboardList, FileText, AlertCircle, Bug,
  LogOut, Menu, Shield, Bell, MessageSquare, BookOpen
} from 'lucide-react'
import './layout.css'

const nav = [
  { to: '/admin',                label: 'Overview',       icon: LayoutDashboard },
  { to: '/admin/attendance',     label: 'Attendance',     icon: ClipboardList },
  { to: '/admin/classreps',      label: 'Class Reps',     icon: Users },
  { to: '/admin/lecturers',      label: 'Lecturers',      icon: BookOpen },
  { to: '/admin/students',       label: 'Students',       icon: GraduationCap },
  { to: '/admin/qr-sessions',    label: 'QR Sessions',    icon: QrCode },
  { to: '/admin/logs',           label: 'Logs',           icon: FileText },
  { to: '/admin/issues',         label: 'Reported Issues',icon: AlertCircle },
  { to: '/admin/error-logs',     label: 'Error Logs',     icon: Bug },
  { to: '/admin/send-message',   label: 'SMS Messages',   icon: MessageSquare },
  { to: '/admin/push',           label: 'Push Notifications', icon: Bell },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login')
  }

  return (
    <div className="layout">
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside className={`sidebar sidebar-admin ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/logo.png" alt="ClassIQ" className="brand-logo sm" />
          <span className="logo-text">Class<span>IQ</span> <small>Admin</small></span>
        </div>

        <nav className="sidebar-nav">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar admin-avatar"><Shield size={14} /></div>
            <div className="user-info">
              <p className="user-name">{user?.name || 'Admin'}</p>
              <p className="user-role">Administrator</p>
            </div>
          </div>
          <button onClick={handleLogout} className="nav-item nav-logout">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="layout-main">
        <header className="topbar">
          <button className="mobile-menu-btn" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="topbar-right">
            <div className="user-avatar admin-avatar sm"><Shield size={12} /></div>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

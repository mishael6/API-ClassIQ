import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LayoutDashboard, QrCode, ClipboardList, Calendar, LogOut, Menu, GraduationCap } from 'lucide-react'
import './layout.css'

const nav = [
  { to: '/lecturer', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/lecturer/classes', label: 'My Classes', icon: GraduationCap },
  { to: '/lecturer/weeks', label: 'Schedule', icon: Calendar },
  { to: '/lecturer/generate-qr', label: 'Generate QR', icon: QrCode },
  { to: '/lecturer/attendance', label: 'Attendance', icon: ClipboardList },
]

export default function LecturerLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'LC'

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="layout">
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/logo.png" alt="ClassIQ" className="brand-logo sm" />
          <span className="logo-text">Class<span>IQ</span></span>
        </div>
        <nav className="sidebar-nav">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/lecturer'}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
              onClick={() => setOpen(false)}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <p className="user-name">{user?.name}</p>
              <p className="user-role">Lecturer · {user?.course || 'Course'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="nav-item nav-logout">
            <LogOut size={18} /><span>Logout</span>
          </button>
        </div>
      </aside>
      <div className="layout-main">
        <header className="topbar">
          <button className="mobile-menu-btn" onClick={() => setOpen(true)}><Menu size={22} /></button>
          <div className="topbar-right"><div className="user-avatar sm">{initials}</div></div>
        </header>
        <main className="main-content"><Outlet /></main>
      </div>
    </div>
  )
}

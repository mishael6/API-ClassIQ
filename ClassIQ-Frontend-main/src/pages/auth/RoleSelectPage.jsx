import { Link } from 'react-router-dom'
import { Users, GraduationCap, ArrowRight } from 'lucide-react'
import './role-select.css'

export default function RoleSelectPage() {
  return (
    <div className="role-page">
      <section className="role-visual" aria-hidden="true">
        <img src="/clock2.jpg" alt="" className="role-visual-img" />
      </section>

      <section className="role-panel">
        <div className="role-panel-bg" aria-hidden="true" />
        <div className="role-panel-inner">
          <Link to="/" className="role-brand">
            <img src="/logo.png" alt="" className="brand-logo sm" />
            ClassIQ
          </Link>
          <h1 className="role-title">Join Us</h1>
          <p className="role-sub">Say goodbye to paper registers and missed lectures. Whether you lead a class or teach one, ClassIQ makes attendance effortless, accurate, and completely free. Pick your role and get started in minutes.</p>

          <div className="role-choices">
            <Link to="/register" className="role-choice role-choice-rep">
              <span className="role-choice-icon"><Users size={22} /></span>
              <span className="role-choice-copy">
                <span className="role-choice-title">Class Representative</span>
                <span className="role-choice-desc">Manage your class, students, and lecture attendance</span>
              </span>
              <ArrowRight size={18} className="role-choice-arrow" />
            </Link>

            <Link to="/register/lecturer" className="role-choice role-choice-lecturer">
              <span className="role-choice-icon"><GraduationCap size={22} /></span>
              <span className="role-choice-copy">
                <span className="role-choice-title">Lecturer</span>
                <span className="role-choice-desc">Teach your course and track weekly topic attendance</span>
              </span>
              <ArrowRight size={18} className="role-choice-arrow" />
            </Link>
          </div>

          <p className="role-foot">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </section>
    </div>
  )
}

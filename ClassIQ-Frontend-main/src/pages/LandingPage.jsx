import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, MotionConfig, useScroll, useSpring } from 'framer-motion'
import {
  GraduationCap, Smartphone, MapPin, Bot, Trophy, PenLine, Users, Rocket,
  BookOpen, Presentation, QrCode, Lightbulb, BarChart3, Moon, Lock, Flame,
  Mail, Phone, MessageCircle,
} from 'lucide-react'
import './landing.css'

function AndroidIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85a.637.637 0 0 0-.83.22l-1.88 3.24a11.43 11.43 0 0 0-8.94 0L5.65 5.67a.643.643 0 0 0-.87-.2c-.28.18-.37.54-.22.83L6.4 9.48A10.81 10.81 0 0 0 1 18h22a10.81 10.81 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
    </svg>
  )
}

function AppleIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

const PWA_URL = 'https://mobile-classiq.netlify.app/'

// Logos live in public/schools/. If a file is missing, the school falls back to a monogram badge.
const SCHOOLS = [
  { name: 'Kumasi Technical University', short: 'KsTU',  logo: '/schools/kstu.jpg' },
  { name: 'AAMUSTED',                    short: 'AAM',   logo: '/schools/aamusted.jpg' },
  { name: 'KNUST',                       short: 'KNUST', logo: '/schools/knust.jpg' },
  { name: 'University of Mines',         short: 'UMaT',  logo: '/schools/umat.jpg' },
  { name: 'University of Ghana',         short: 'UG',    logo: '/schools/ug.jpg' },
]

function SchoolLogo({ school, duplicate }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`lp-trust-item${duplicate ? ' lp-trust-dup' : ''}`} aria-hidden={duplicate || undefined}>
      {failed ? (
        <>
          <span className="lp-trust-mark">{school.short}</span>
          <span className="lp-trust-name">{school.name}</span>
        </>
      ) : (
        <img
          src={school.logo}
          alt={duplicate ? '' : school.name}
          className="lp-trust-logo"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

const EASE = [0.22, 1, 0.36, 1]
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
}
const stagger = (gap = 0.1, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
})
const inView = { once: true, amount: 0.2 }
const reveal = { initial: 'hidden', whileInView: 'show', viewport: inView, variants: fadeUp }
const grid = (gap = 0.12) => ({ initial: 'hidden', whileInView: 'show', viewport: inView, variants: stagger(gap) })

export default function LandingPage() {
  const navigate = useNavigate()
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 24,
    mass: 0.3,
    skipInitialAnimation: true,
  })

  useEffect(() => {
    const user = localStorage.getItem('classiq_user')
    if (user) {
      try {
        const p = JSON.parse(user)
        navigate(p.role === 'admin' ? '/admin' : p.role === 'lecturer' ? '/lecturer' : '/dashboard', { replace: true })
      } catch {}
    }
  }, [])

  return (
    <MotionConfig reducedMotion="user">
    <div className="lp-root">
      <motion.div className="lp-progress" style={{ scaleX: progress }} aria-hidden />

      {/* ── Header ── */}
      <motion.header
        className="lp-header"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="lp-nav">
          <div className="lp-logo">
            <img src="/logo.png" alt="ClassIQ" className="lp-logo-img" />
            <span>ClassIQ</span>
          </div>
          <div className="lp-nav-btns">
            <Link to="/login"    className="lp-btn lp-ghost">Log in</Link>
            <Link to="/get-started" className="lp-btn lp-solid">Get started</Link>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ── */}
      <section className="lp-hero">
        <motion.div className="lp-hero-inner" initial="hidden" animate="show" variants={stagger(0.12, 0.15)}>
          <motion.div className="lp-badge" variants={fadeUp}><GraduationCap size={15} /> The Academic Ecosystem for Everyone in Education</motion.div>
          <motion.h1 className="lp-h1" variants={fadeUp}>
            One platform for the<br/>
            <span className="lp-accent">entire academic journey</span>
          </motion.h1>
          <motion.p className="lp-hero-p" variants={fadeUp}>
            ClassIQ brings together smart attendance, AI-powered study tools,
            competitive learning, and a powerful mobile experience — everything
            academia needs, unified in one intelligent ecosystem.
          </motion.p>
          <motion.div className="lp-hero-cta" variants={fadeUp}>
            <motion.div whileHover={{ y: -3, scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link to="/get-started" className="lp-btn lp-solid lp-lg">Join ClassIQ free →</Link>
            </motion.div>
            <motion.div whileHover={{ y: -3, scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <a href={PWA_URL} target="_blank" rel="noopener noreferrer" className="lp-btn lp-outline lp-lg" style={{ textDecoration: 'none' }}>
                <Smartphone size={18} /> Download App
              </a>
            </motion.div>
          </motion.div>
          <motion.div className="lp-stats-row" variants={stagger(0.08)}>
            {[
              { value: '100+', label: 'Institutions' },
              { value: '10K+', label: 'Students' },
              { value: '4',    label: 'Core products' },
              { value: '99%',  label: 'Accuracy rate' },
            ].map((s, i) => (
              <motion.div
                key={i}
                className="lp-stat-pill"
                variants={{ hidden: { opacity: 0, y: 18, scale: 0.92 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE } } }}
                whileHover={{ y: -4, scale: 1.05 }}
              >
                <span className="lp-stat-val">{s.value}</span>
                <span className="lp-stat-lbl">{s.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
        <motion.div
          className="lp-hero-glow"
          aria-hidden
          animate={{ scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </section>

      {/* ── Trust bar ── */}
      <motion.section className="lp-trust" {...reveal}>
        <p className="lp-trust-label">Trusted across Ghanaian institutions</p>
        <div className="lp-trust-scroll">
          <div className="lp-trust-track">
            {[0, 1, 2, 3].flatMap(copy =>
              SCHOOLS.map(s => (
                <SchoolLogo key={`${copy}-${s.name}`} school={s} duplicate={copy > 0} />
              ))
            )}
          </div>
        </div>
      </motion.section>

      {/* ── Ecosystem Overview ── */}
      <section className="lp-ecosystem">
        <motion.div className="lp-section-label" {...reveal}>The Ecosystem</motion.div>
        <motion.h2 className="lp-h2" {...reveal}>Four pillars of academic excellence</motion.h2>
        <motion.p className="lp-ecosystem-intro" {...reveal}>
          ClassIQ is not just an attendance tool. It is a complete academic operating system
          designed to help institutions, class representatives, and students thrive together.
        </motion.p>
        <motion.div className="lp-ecosystem-grid" {...grid(0.12)}>
          {[
            {
              icon: MapPin,
              color: '#1A73E8',
              bg: '#1A73E815',
              title: 'Smart Attendance',
              tag: 'For Class Reps & Students',
              desc: 'GPS-verified QR code attendance that eliminates proxy marking. Generate a session, display the code, and watch attendance mark itself in real time.',
              points: ['GPS radius verification', 'Live QR sessions', 'Fraud detection & flagging', 'Instant attendance reports'],
            },
            {
              icon: Bot,
              color: '#6B46C1',
              bg: '#6B46C115',
              title: 'AI Study Assistant',
              tag: 'Powered by Six',
              desc: 'Meet Six — your personal AI tutor. Upload lecture notes or paste text and Six breaks it down, generates quizzes, flashcards, and study guides in seconds.',
              points: ['Explain complex topics simply', 'Generate MCQ questions', 'Create flashcard sets', 'Fill-in-the-blank exercises'],
            },
            {
              icon: Trophy,
              color: '#D69E2E',
              bg: '#D69E2E15',
              title: 'Trivia & Leaderboard',
              tag: 'Gamified Learning',
              desc: 'Turn studying into competition. AI-generated trivia challenges test students on their courses, award points, and rank them on a global leaderboard.',
              points: ['AI-generated course questions', '15-second timed challenges', 'Mixed question types', 'Global student rankings'],
            },
            {
              icon: Smartphone,
              color: '#38A169',
              bg: '#38A16915',
              title: 'Mobile App',
              tag: 'Android & iOS',
              desc: 'The ClassIQ mobile app puts the entire ecosystem in your pocket. Scan QR codes, study with Six, play trivia, and track attendance — anywhere, anytime.',
              points: ['QR code scanner', 'Full AI study access', 'Real-time trivia', 'Attendance history'],
            },
          ].map((p, i) => {
            const Icon = p.icon
            return (
            <motion.div
              key={i}
              className="lp-eco-card"
              style={{ '--eco-color': p.color, '--eco-bg': p.bg }}
              variants={fadeUp}
              whileHover={{ y: -8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            >
              <div className="lp-eco-card-top">
                <motion.div
                  className="lp-eco-icon"
                  style={{ background: p.bg, color: p.color }}
                  whileHover={{ rotate: [0, -8, 8, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                >
                  <Icon size={22} />
                </motion.div>
                <div className="lp-eco-tag">{p.tag}</div>
              </div>
              <h3 className="lp-eco-title" style={{ color: p.color }}>{p.title}</h3>
              <p className="lp-eco-desc">{p.desc}</p>
              <ul className="lp-eco-points">
                {p.points.map((pt, j) => (
                  <li key={j} className="lp-eco-point">
                    <span className="lp-eco-point-dot" style={{ background: p.color }} />
                    {pt}
                  </li>
                ))}
              </ul>
            </motion.div>
            )
          })}
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <section className="lp-how">
        <motion.div className="lp-section-label" {...reveal}>How it works</motion.div>
        <motion.h2 className="lp-h2" {...reveal}>From registration to results</motion.h2>
        <motion.div className="lp-steps" {...grid(0.15)}>
          {[
            { n: '01', color: '#0066ff', title: 'Register & get approved', icon: PenLine, desc: 'Class reps register on the web app. Once approved by admin, they get access to the full dashboard and a unique student registration link.' },
            { n: '02', color: '#00b57a', title: 'Onboard your students',   icon: Users, desc: 'Share your registration link with students. They sign up and install the ClassIQ PWA — ready to go in minutes.' },
            { n: '03', color: '#7c3aed', title: 'Run your class',          icon: Rocket, desc: 'Generate QR codes for attendance, let students study with Six, challenge them with trivia, and monitor everything from your dashboard.' },
          ].map((s, i) => {
            const Icon = s.icon
            return (
            <motion.div
              key={i}
              className="lp-step"
              style={{ '--accent': s.color }}
              variants={fadeUp}
              whileHover={{ y: -8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            >
              <div className="lp-step-icon"><Icon size={28} /></div>
              <div className="lp-step-num" style={{ color: s.color }}>{s.n}</div>
              <h3 className="lp-step-title">{s.title}</h3>
              <p className="lp-step-desc">{s.desc}</p>
            </motion.div>
            )
          })}
        </motion.div>
      </section>

      {/* ── Who it's for ── */}
      <section className="lp-who">
        <motion.div className="lp-section-label" {...reveal}>Who it's for</motion.div>
        <motion.h2 className="lp-h2" {...reveal}>Built for everyone in academia</motion.h2>
        <motion.div className="lp-who-grid" {...grid(0.15)}>
          <motion.div className="lp-who-card lp-who-classrep" variants={fadeUp} whileHover={{ y: -8 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
            <div className="lp-who-icon"><GraduationCap size={32} /></div>
            <h3>Class Representatives</h3>
            <p>Manage your class end-to-end. Generate QR attendance, track your students, view detailed reports, and communicate with your admin — all from one dashboard.</p>
            <Link to="/get-started" className="lp-btn lp-solid lp-sm" style={{ marginTop: 'auto', paddingTop: 20, alignSelf: 'flex-start' }}>
              Register as Class Rep →
            </Link>
          </motion.div>
          <motion.div className="lp-who-card lp-who-student" variants={fadeUp} whileHover={{ y: -8 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
            <div className="lp-who-icon"><BookOpen size={32} /></div>
            <h3>Students</h3>
            <p>Mark attendance by scanning a QR code, study smarter with AI, compete in trivia, and track your academic progress — all from the ClassIQ mobile app.</p>
            <a href={PWA_URL} target="_blank" rel="noopener noreferrer" className="lp-btn lp-solid lp-sm" style={{ marginTop: 'auto', background: '#38A169', textDecoration: 'none' }}>
              Download the App →
            </a>
          </motion.div>
          <motion.div className="lp-who-card lp-who-lecturer" variants={fadeUp} whileHover={{ y: -8 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}>
            <div className="lp-who-icon"><Presentation size={32} /></div>
            <h3>Lecturers</h3>
            <p>Take attendance for your course. Generate QR sessions, track weekly topics, and follow which students are present from one lecturer dashboard.</p>
            <Link to="/register/lecturer" className="lp-btn lp-solid lp-sm" style={{ marginTop: 'auto', background: '#7c3aed', alignSelf: 'flex-start' }}>
              Sign up as a Lecturer →
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Getting Started Guide ── */}
      <section className="lp-guide">
        <motion.div className="lp-section-label" {...reveal}>Get started</motion.div>
        <motion.h2 className="lp-h2" {...reveal}>Up and running in minutes</motion.h2>
        <motion.p className="lp-guide-intro" {...reveal}>
          Everything you need to know to get ClassIQ working for your class — from registration to marking attendance.
        </motion.p>
        <motion.div className="lp-guide-grid" {...reveal}>
          <div className="lp-guide-card">
            <div className="lp-guide-card-header" style={{ background: 'linear-gradient(135deg, #0066ff, #0044cc)' }}>
              <span className="lp-guide-card-emoji"><GraduationCap size={26} /></span>
              <div>
                <div className="lp-guide-card-tag">Step 1</div>
                <div className="lp-guide-card-title">Sign up as a Class Rep</div>
              </div>
            </div>
            <div className="lp-guide-card-body">
              {[
                { n: 1, text: 'Click "Get started" at the top of this page' },
                { n: 2, text: 'Fill in your name, institution, department, program and contact details' },
                { n: 3, text: 'Click "Create account" to submit your registration' },
                { n: 4, text: 'Wait for admin approval — usually a few hours' },
                { n: 5, text: 'Once approved, sign in and access your full dashboard' },
              ].map((s, i) => (
                <div key={i} className="lp-guide-step">
                  <div className="lp-guide-step-num" style={{ background: '#0066ff22', color: '#0066ff' }}>{s.n}</div>
                  <p className="lp-guide-step-text">{s.text}</p>
                </div>
              ))}
              <Link to="/get-started" className="lp-guide-cta" style={{ background: '#0066ff' }}>Get started →</Link>
            </div>
          </div>

          <div className="lp-guide-card">
            <div className="lp-guide-card-header" style={{ background: 'linear-gradient(135deg, #00b57a, #008f5e)' }}>
              <span className="lp-guide-card-emoji"><Users size={26} /></span>
              <div>
                <div className="lp-guide-card-tag">Step 2</div>
                <div className="lp-guide-card-title">Set up your class</div>
              </div>
            </div>
            <div className="lp-guide-card-body">
              {[
                { n: 1, text: 'Log into your ClassIQ dashboard after approval' },
                { n: 2, text: 'Copy your unique student registration link from your profile' },
                { n: 3, text: 'Share the link with your students via WhatsApp or any messaging app' },
                { n: 4, text: 'Students register using the link and appear in your student list' },
                { n: 5, text: 'Direct your students to install the ClassIQ mobile app below' },
              ].map((s, i) => (
                <div key={i} className="lp-guide-step">
                  <div className="lp-guide-step-num" style={{ background: '#00b57a22', color: '#00b57a' }}>{s.n}</div>
                  <p className="lp-guide-step-text">{s.text}</p>
                </div>
              ))}
              <a href="#app-download" className="lp-guide-cta" style={{ background: '#00b57a' }}>Download the app ↓</a>
            </div>
          </div>

          <div className="lp-guide-card">
            <div className="lp-guide-card-header" style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}>
              <span className="lp-guide-card-emoji"><QrCode size={26} /></span>
              <div>
                <div className="lp-guide-card-tag">Step 3</div>
                <div className="lp-guide-card-title">Mark attendance</div>
              </div>
            </div>
            <div className="lp-guide-card-body">
              {[
                { n: 1, text: 'Go to "Generate QR" in your dashboard at the start of each lecture' },
                { n: 2, text: 'Drop a pin on the map at your exact classroom location' },
                { n: 3, text: 'Set the GPS radius — how far students can be to mark attendance' },
                { n: 4, text: 'Enter the lecture name or number and click "Generate QR Code"' },
                { n: 5, text: 'Display the QR on your screen — students scan with ClassIQ or their camera' },
              ].map((s, i) => (
                <div key={i} className="lp-guide-step">
                  <div className="lp-guide-step-num" style={{ background: '#7c3aed22', color: '#7c3aed' }}>{s.n}</div>
                  <p className="lp-guide-step-text">{s.text}</p>
                </div>
              ))}
              <Link to="/login" className="lp-guide-cta" style={{ background: '#7c3aed' }}>Go to dashboard →</Link>
            </div>
          </div>
        </motion.div>

        <motion.div className="lp-guide-tip" {...reveal}>
          <span className="lp-guide-tip-icon"><Lightbulb size={20} /></span>
          <p><strong>Pro tip:</strong> End your QR session after class to prevent late entries. Go to your dashboard and click "End Session" when the lecture is over.</p>
        </motion.div>
      </section>

      {/* ── Mobile App Download ── */}
      <section className="lp-app" id="app-download">
        <div className="lp-app-inner">
          <motion.div className="lp-app-content" {...grid(0.1)}>
            <motion.div className="lp-section-label" style={{ textAlign: 'left' }} variants={fadeUp}>Mobile App</motion.div>
            <motion.h2 className="lp-h2" style={{ textAlign: 'left' }} variants={fadeUp}>
              The ecosystem,<br />
              <span className="lp-accent">in your pocket</span>
            </motion.h2>
            <motion.p className="lp-app-desc" variants={fadeUp}>
              The ClassIQ mobile app is the student's gateway to the entire ecosystem.
              Mark attendance, study with Six, compete in trivia, and track your academic
              progress — all from one beautifully designed app.
            </motion.p>
            <motion.div className="lp-app-features" variants={stagger(0.08)}>
              {[
                { icon: QrCode, title: 'QR Attendance',      desc: 'Scan your class QR code to mark attendance in seconds — GPS verified.' },
                { icon: Bot, title: 'AI Study with Six',  desc: 'Upload notes and let Six explain, generate MCQs, flashcards and fill-in-the-blank questions.' },
                { icon: Trophy, title: 'Trivia & Rankings',  desc: 'Test your knowledge with AI-generated trivia and climb the global leaderboard.' },
                { icon: BarChart3, title: 'Attendance History', desc: 'Track your attendance rate and see every lecture you have attended.' },
                { icon: Moon, title: 'Dark & Light Mode',  desc: 'Switch between beautiful dark and light themes to suit your preference.' },
                { icon: Lock, title: 'Secure & Private',   desc: 'Your data is encrypted and stored securely. No personal data is ever sold.' },
              ].map((f, i) => {
                const Icon = f.icon
                return (
                <motion.div
                  key={i}
                  className="lp-app-feature-row"
                  variants={{ hidden: { opacity: 0, x: -24 }, show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE } } }}
                  whileHover={{ x: 6 }}
                >
                  <div className="lp-app-feature-icon"><Icon size={18} /></div>
                  <div>
                    <div className="lp-app-feature-title">{f.title}</div>
                    <div className="lp-app-feature-desc">{f.desc}</div>
                  </div>
                </motion.div>
                )
              })}
            </motion.div>
            <motion.div className="lp-app-btns" variants={fadeUp}>
              <motion.a href={PWA_URL} target="_blank" rel="noopener noreferrer" className="lp-app-download-btn lp-app-android" style={{ textDecoration: 'none', cursor: 'pointer' }} whileHover={{ y: -3, scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <div className="lp-app-btn-icon"><AndroidIcon size={26} /></div>
                <div className="lp-app-btn-text">
                  <span className="lp-app-btn-sub">Install for</span>
                  <span className="lp-app-btn-main">Android</span>
                </div>
              </motion.a>
              <motion.a href={PWA_URL} target="_blank" rel="noopener noreferrer" className="lp-app-download-btn lp-app-ios" style={{ textDecoration: 'none', cursor: 'pointer' }} whileHover={{ y: -3, scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <div className="lp-app-btn-icon"><AppleIcon size={24} /></div>
                <div className="lp-app-btn-text">
                  <span className="lp-app-btn-sub">Install for</span>
                  <span className="lp-app-btn-main">iOS / iPhone</span>
                </div>
              </motion.a>
            </motion.div>
            <motion.p className="lp-app-note" variants={fadeUp}><Smartphone size={14} /> PWA · Free to use · Works on Android & iOS · No installation needed</motion.p>
          </motion.div>

          <motion.div
            className="lp-app-mockup"
            initial={{ opacity: 0, x: 60, rotate: 4 }}
            whileInView={{ opacity: 1, x: 0, rotate: 0 }}
            viewport={inView}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <motion.div
              className="lp-phone"
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="lp-phone-screen">
                <div className="lp-phone-notch" />
                <div className="lp-phone-content">
                  <div className="lp-phone-header">
                    <div className="lp-phone-avatar">C</div>
                    <div>
                      <div className="lp-phone-name">ClassIQ</div>
                      <div className="lp-phone-sub">Academic Ecosystem</div>
                    </div>
                  </div>
                  <div className="lp-phone-cards">
                    {[
                      { icon: QrCode, label: 'Scan QR',    color: '#1A73E8' },
                      { icon: Bot, label: 'AI Study',   color: '#6B46C1' },
                      { icon: Trophy, label: 'Trivia',     color: '#D69E2E' },
                      { icon: BarChart3, label: 'Attendance', color: '#38A169' },
                    ].map((c, i) => {
                      const Icon = c.icon
                      return (
                      <motion.div
                        key={i}
                        className="lp-phone-card"
                        style={{ '--card-color': c.color }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={inView}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.4, ease: EASE }}
                      >
                        <span className="lp-phone-card-icon"><Icon size={18} /></span>
                        <span className="lp-phone-card-label">{c.label}</span>
                      </motion.div>
                      )
                    })}
                  </div>
                  <div className="lp-phone-banner">
                    <span className="lp-phone-banner-title"><Flame size={14} /> Daily Trivia Challenge</span>
                    <span className="lp-phone-banner-cta">Play →</span>
                  </div>
                  <div className="lp-phone-stat-row">
                    <div className="lp-phone-stat">
                      <span className="lp-phone-stat-val" style={{ color: '#1A73E8' }}>12</span>
                      <span className="lp-phone-stat-lbl">Classes</span>
                    </div>
                    <div className="lp-phone-stat">
                      <span className="lp-phone-stat-val" style={{ color: '#38A169' }}>94%</span>
                      <span className="lp-phone-stat-lbl">Rate</span>
                    </div>
                    <div className="lp-phone-stat">
                      <span className="lp-phone-stat-val" style={{ color: '#D69E2E' }}>48</span>
                      <span className="lp-phone-stat-lbl">Points</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            <div className="lp-app-glow" aria-hidden />
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta">
        <motion.div className="lp-cta-inner" {...grid(0.12)}>
          <motion.div variants={fadeUp}>
            <motion.img
              src="/logo.png"
              alt="ClassIQ"
              className="lp-cta-logo"
              animate={{ rotate: [0, 6, -6, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
          <motion.h2 className="lp-cta-h2" variants={fadeUp}>Join the academic ecosystem</motion.h2>
          <motion.p className="lp-cta-p" variants={fadeUp}>
            Thousands of students and class representatives across Ghana are already
            using ClassIQ to learn smarter, attend better, and compete harder.
          </motion.p>
          <motion.div variants={fadeUp} style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <motion.div whileHover={{ y: -3, scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link to="/get-started" className="lp-btn lp-white lp-lg">Get started free →</Link>
            </motion.div>
            <motion.div whileHover={{ y: -3, scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <a href={PWA_URL} target="_blank" rel="noopener noreferrer" className="lp-btn lp-lg" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.3)', textDecoration: 'none' }}>
                <Smartphone size={18} /> Download App
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
        <div className="lp-cta-glow" aria-hidden />
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <div className="lp-footer-logo">
              <img src="/logo.png" alt="" className="lp-footer-logo-img" />
              <span>ClassIQ</span>
            </div>
            <p className="lp-footer-tagline">
              The academic ecosystem for attendance, AI study, and competitive learning.
            </p>
          </div>

          <nav className="lp-footer-col" aria-label="Platform">
            <p className="lp-footer-label">Platform</p>
            <Link to="/get-started">Get started</Link>
            <a href={PWA_URL} target="_blank" rel="noopener noreferrer">Download the app</a>
            <a href="#app-download">Mobile app</a>
          </nav>

          <nav className="lp-footer-col" aria-label="Account">
            <p className="lp-footer-label">Account</p>
            <Link to="/login">Log in</Link>
            <Link to="/register">Class rep registration</Link>
            <Link to="/register/lecturer">Lecturer registration</Link>
            <Link to="/admin/login">Admin</Link>
          </nav>

          <div className="lp-footer-col">
            <p className="lp-footer-label">Contact</p>
            <a href="mailto:classiq660@gmail.com" className="lp-footer-contact-link"><Mail size={15} /> classiq660@gmail.com</a>
            <a href="tel:+233502076920" className="lp-footer-contact-link"><Phone size={15} /> 0502 076 920</a>
            <a href="https://whatsapp.com/channel/0029VbCbXOOHrDZpFFYw3r0O" target="_blank" rel="noopener noreferrer" className="lp-footer-contact-link lp-footer-whatsapp">
              <MessageCircle size={15} /> WhatsApp channel
            </a>
          </div>
        </div>

        <div className="lp-footer-bar">
          <p>© 2026 ClassIQ. All rights reserved.</p>
          <Link to="/privacy">Privacy Policy</Link>
        </div>
      </footer>

    </div>
    </MotionConfig>
  )
}
import { Link } from 'react-router-dom'
import './privacy.css'

export default function PrivacyPolicyPage() {
  return (
    <div className="privacy-page">
      <div className="privacy-inner">
        <Link to="/" className="privacy-back">← Back to ClassIQ</Link>
        <h1>ClassIQ Privacy Policy</h1>
        <p className="privacy-updated">Last updated: July 2026</p>

        <p>
          ClassIQ (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) provides attendance tracking, study tools,
          and communication features for students and class representatives. This policy explains
          what data we collect and how we use it.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li><strong>Account data:</strong> name, email, phone number, institution, program, and login credentials.</li>
          <li><strong>Attendance data:</strong> QR scan records, timestamps, lecture names, and GPS location at the time of marking (to verify you are on campus).</li>
          <li><strong>Device data:</strong> device identifiers used to prevent attendance fraud.</li>
          <li><strong>Support messages:</strong> issues you report to administrators through the in-app chat.</li>
        </ul>

        <h2>How we use your information</h2>
        <ul>
          <li>Mark and verify class attendance</li>
          <li>Provide dashboards for class reps, lecturers, and administrators</li>
          <li>Send SMS and push notifications about attendance, admin replies, and app updates (with your consent for push)</li>
          <li>Improve app security and prevent proxy attendance</li>
        </ul>

        <h2>Location &amp; camera</h2>
        <p>
          Location is used only when you mark attendance or generate a QR session, to confirm physical
          presence. The camera is used only to scan QR codes. We do not track your location in the background.
        </p>

        <h2>Data sharing</h2>
        <p>
          We do not sell your personal data. Information is shared only with your class representative,
          lecturer, or institution administrators as required for attendance management. SMS delivery
          uses third-party providers (Payloqa).
        </p>

        <h2>Data retention &amp; security</h2>
        <p>
          Data is stored on secure servers. You may request account deletion by contacting us.
          Passwords are stored using industry-standard hashing.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>You can disable push notifications in app Settings.</li>
          <li>Location and camera access require your device permission and are needed for attendance features.</li>
          <li>You may log out at any time from Settings.</li>
        </ul>

        <h2>Children</h2>
        <p>
          ClassIQ is intended for university and college students. Users under 13 should not register
          without institutional supervision.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy:{' '}
          <a href="mailto:classiq660@gmail.com">classiq660@gmail.com</a>
        </p>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'

export default function SubscribePage() {
  const [studentName, setStudentName] = useState('Student')
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('student_id')
    const name = params.get('name') || 'Student'
    if (!id) { setInvalid(true); return }
    setStudentName(decodeURIComponent(name))
  }, [])

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src="/logo.png" alt="ClassIQ" style={styles.logo} />
        <h1 style={styles.title}>{invalid ? 'Open ClassIQ' : 'Six is free'}</h1>
        <p style={styles.subtitle}>
          {invalid
            ? 'Go back to the ClassIQ app to study with Six.'
            : `Hi ${studentName}. Explanations, MCQs, flashcards, fill-in-the-blank questions, and PDF upload are free. No payment is required.`}
        </p>
        <ul style={styles.featureList}>
          {[
            'Unlimited AI explanations',
            'Unlimited MCQ generation',
            'Unlimited flashcards',
            'Fill-in-the-blank questions',
            'PDF upload',
          ].map(feature => (
            <li key={feature} style={styles.featureItem}>{feature}</li>
          ))}
        </ul>
        <p style={styles.hint}>Go back to the ClassIQ app to continue studying.</p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh', backgroundColor: '#F5F7FA',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    backgroundColor: '#fff', borderRadius: '24px', padding: '40px 32px',
    maxWidth: '420px', width: '100%',
    boxShadow: '0 4px 40px rgba(0,0,0,0.10)', textAlign: 'center',
  },
  logo: { width: 56, height: 56, objectFit: 'contain', marginBottom: 16 },
  title: { fontSize: '26px', fontWeight: '800', color: '#0D1B2A', marginBottom: '8px' },
  subtitle: { fontSize: '15px', color: '#4A5568', marginBottom: '24px', lineHeight: '1.6' },
  featureList: { listStyle: 'none', padding: '0', margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' },
  featureItem: { fontSize: '14px', color: '#0D1B2A', fontWeight: '500' },
  hint: { fontSize: '13px', color: '#9AA5B4', lineHeight: '1.6' },
}

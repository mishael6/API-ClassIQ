import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { lecturerApi } from '../../lib/api'
import { L, ensureLeafletIcons } from '../../lib/leafletSetup'
import { Button, Select, Alert, Card, PageHeader } from '../../components/ui'
import { QrCode, Navigation, Loader2, ArrowLeft, Bookmark, Save, Trash2 } from 'lucide-react'
import QRCode from 'qrcode'
import '../../components/ui/components.css'
import '../classrep/generateqr.css'

const RADII = [10, 20, 30, 50, 100, 150, 200]

export default function LecturerGenerateQRPage() {
  const [step, setStep] = useState('map')
  const [semesters, setSemesters] = useState([])
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [semesterId, setSemesterId] = useState('')
  const [weekId, setWeekId] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [radius, setRadius] = useState(100)
  const [pin, setPin] = useState(null)
  const [session, setSession] = useState(null)
  const [qrUrl, setQrUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState('')
  const [mapReady, setMapReady] = useState(false)
  const [pinStatus, setPinStatus] = useState('idle')
  const [savedLocs, setSavedLocs] = useState([])
  const [saving, setSaving] = useState(false)
  const [locName, setLocName] = useState('')
  const [deleting, setDeleting] = useState(null)

  const mapRef = useRef(null)
  const leaflet = useRef(null)
  const markerRef = useRef(null)
  const circleRef = useRef(null)
  const radiusRef = useRef(radius)

  useEffect(() => { radiusRef.current = radius }, [radius])

  const getSessions = (week) => week?.sessions || week?.classes || []

  useEffect(() => {
    lecturerApi.getSchedule()
      .then(r => {
        const list = r.data.semesters || []
        setSemesters(list)
        if (list.length) {
          const sem = list[0]
          setSemesterId(String(sem.id))
          const wk = sem.weeks?.[0]
          if (wk) {
            setWeekId(String(wk.id))
            const sess = getSessions(wk)[0]
            if (sess) setSessionId(String(sess.id))
          }
        }
      })
      .catch(() => setError('Failed to load schedule. Set up your schedule first.'))
      .finally(() => setScheduleLoading(false))
  }, [])

  useEffect(() => {
    lecturerApi.getSavedLocations()
      .then(r => setSavedLocs(r.data.locations || []))
      .catch(() => {})
  }, [])

  const selectedSemester = semesters.find(s => String(s.id) === String(semesterId))
  const weeks = selectedSemester?.weeks || []
  const selectedWeek = weeks.find(w => String(w.id) === String(weekId))
  const sessions = getSessions(selectedWeek)
  const selectedSession = sessions.find(s => String(s.id) === String(sessionId))
  const hasSessions = semesters.some(s => (s.weeks || []).some(w => getSessions(w).length > 0))

  const placePin = useCallback((map, pinIcon, lat, lng) => {
    if (markerRef.current) map.removeLayer(markerRef.current)
    if (circleRef.current) map.removeLayer(circleRef.current)

    const r = radiusRef.current
    const marker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map)
    const circle = L.circle([lat, lng], {
      radius: r, color: '#0066ff', fillColor: '#0066ff', fillOpacity: 0.1, weight: 2, dashArray: '6 4',
    }).addTo(map)

    marker.on('dragend', e => {
      const { lat: la, lng: lo } = e.target.getLatLng()
      setPin({ lat: la, lng: lo })
      circle.setLatLng([la, lo])
    })

    markerRef.current = marker
    circleRef.current = circle
    setPin({ lat, lng })
    setPinStatus('set')
    map.setView([lat, lng], 18)
  }, [])

  const mapActive = step === 'map' && !scheduleLoading && hasSessions

  useEffect(() => {
    if (!mapActive || !mapRef.current) return

    ensureLeafletIcons()
    setMapReady(false)

    const pinIcon = L.divIcon({
      className: '', html: '<div class="map-pin-icon"></div>',
      iconSize: [28, 28], iconAnchor: [14, 28],
    })

    const map = L.map(mapRef.current, { zoomControl: true }).setView([6.6884, -1.6244], 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map)

    map.on('click', e => placePin(map, pinIcon, e.latlng.lat, e.latlng.lng))
    leaflet.current = { map, pinIcon }

    const refresh = () => map.invalidateSize()
    const t1 = setTimeout(refresh, 100)
    const t2 = setTimeout(refresh, 400)
    const t3 = setTimeout(() => { refresh(); setMapReady(true) }, 600)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      map.remove()
      leaflet.current = null
      markerRef.current = null
      circleRef.current = null
      setMapReady(false)
    }
  }, [mapActive, placePin])

  useEffect(() => {
    if (circleRef.current) circleRef.current.setRadius(radius)
  }, [radius])

  const applySavedLocation = (id) => {
    const loc = savedLocs.find(l => String(l.id) === String(id))
    if (!loc || !leaflet.current) return
    setRadius(parseInt(loc.radius_m, 10) || 100)
    placePin(leaflet.current.map, leaflet.current.pinIcon, parseFloat(loc.lat), parseFloat(loc.lng))
  }

  const savePreset = async () => {
    if (!locName.trim() || !pin) return
    setSaving(true)
    try {
      const res = await lecturerApi.saveLocation({ name: locName.trim(), lat: pin.lat, lng: pin.lng, radius_m: radius })
      if (res.data.success !== false) {
        setSavedLocs([{ id: res.data.id, name: locName.trim(), lat: pin.lat, lng: pin.lng, radius_m: radius }, ...savedLocs])
        setLocName('')
      } else setError(res.data.message || 'Failed to save location.')
    } catch {
      setError('Failed to save location.')
    } finally {
      setSaving(false)
    }
  }

  const removeSavedLocation = async (id, e) => {
    e?.stopPropagation()
    if (!confirm('Delete this saved location?')) return
    setDeleting(id)
    try {
      await lecturerApi.deleteSavedLocation(id)
      setSavedLocs(savedLocs.filter(l => l.id !== id))
    } catch {
      setError('Failed to delete saved location.')
    } finally {
      setDeleting(null)
    }
  }

  const autoLocate = () => {
    if (!navigator.geolocation || !leaflet.current) return
    const { map, pinIcon } = leaflet.current
    navigator.geolocation.getCurrentPosition(
      p => placePin(map, pinIcon, p.coords.latitude, p.coords.longitude),
      () => setError('Could not get your location.'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const generate = async () => {
    if (!pin) { setError('Please drop a pin on the map first.'); return }
    if (!sessionId) { setError('Please select semester, week, class and topic.'); return }
    setError(''); setLoading(true)
    try {
      const { data } = await lecturerApi.generateQR({
        session_id: parseInt(sessionId, 10), lat: pin.lat, lng: pin.lng, radius_m: radius,
      })
      if (data.success !== false && (data.session || data.attendance_url)) {
        setSession(data.session)
        const url = await QRCode.toDataURL(data.attendance_url || data.session?.attendance_url, { width: 500, margin: 2 })
        setQrUrl(url)
        setStep('qr')
      } else setError(data.message || 'Failed to generate QR.')
    } catch (err) {
      setError(err?.response?.data?.message || 'Connection error.')
    } finally { setLoading(false) }
  }

  const endSession = async () => {
    if (!session) return
    setEnding(true)
    try {
      await lecturerApi.endSession({ session_id: session.id })
      setSession(null); setQrUrl(''); setPin(null); setPinStatus('idle'); setStep('map')
    } catch { setError('Failed to end session.') }
    finally { setEnding(false) }
  }

  if (scheduleLoading) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Generate Attendance QR" subtitle="Loading your schedule…" />
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--blue)', margin: '0 auto' }} />
        </Card>
      </div>
    )
  }

  if (!hasSessions) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Generate Attendance QR" subtitle="Set up your teaching schedule first" />
        <Card style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
            Add classes under My Classes, then create semester → week → class session with a topic.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/lecturer/classes"><Button variant="secondary">My Classes</Button></Link>
            <Link to="/lecturer/weeks"><Button>Set Up Schedule</Button></Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="animate-fade-up qr-page">
      <PageHeader
        title="Generate Attendance QR"
        subtitle={step === 'map' ? 'Pin your classroom, pick semester/week/class/topic, then generate' : 'Show this QR to students'}
      />
      {error && <Alert variant="error" onClose={() => setError('')} style={{ marginBottom: 16 }}>{error}</Alert>}

      {step === 'map' && (
        <div className="qr-map-step">
          <Card>
            <div className="step-head" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="step-num">1</div>
                <div>
                  <p className="step-title">Pin Your Classroom</p>
                  <p className="step-sub">Click the map, use GPS, or pick a saved location</p>
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {savedLocs.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Bookmark size={15} style={{ color: 'var(--blue)' }}/>
                    <select
                      onChange={e => applySavedLocation(e.target.value)}
                      value=""
                      style={{ padding: '6px 28px 6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem', minWidth: 140, cursor: 'pointer', background: 'var(--surface)' }}
                    >
                      <option value="" disabled>Saved locations…</option>
                      {savedLocs.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name} ({loc.radius_m}m)</option>
                      ))}
                    </select>
                  </div>
                )}
                <Button variant="ghost" size="sm" icon={<Navigation size={14}/>} onClick={autoLocate}>Use GPS</Button>
              </div>
            </div>

            {savedLocs.length > 0 && (
              <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, marginBottom: 12, display: 'flex', gap: 8, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', marginRight: 4 }}>Saved:</span>
                {savedLocs.map(loc => (
                  <span key={loc.id} style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ cursor: 'pointer' }} onClick={() => applySavedLocation(loc.id)}>{loc.name}</span>
                    <Trash2 size={12} style={{ cursor: 'pointer', color: 'var(--red)', opacity: deleting === loc.id ? 0.5 : 1 }} onClick={(e) => removeSavedLocation(loc.id, e)}/>
                  </span>
                ))}
              </div>
            )}

            <div className="qr-map-wrap">
              {!mapReady && (
                <div className="qr-map-loading">
                  <Loader2 size={28} className="animate-spin" style={{ color: 'var(--blue)' }}/>
                  <p>Loading map…</p>
                </div>
              )}
              <div ref={mapRef} className="qr-map" style={{ opacity: mapReady ? 1 : 0 }} />
            </div>

            <div className={`pin-status ${pinStatus === 'set' ? 'ps-ok' : 'ps-wait'}`}>
              {pinStatus === 'set' ? `✅ Pinned at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : '🗺️ Pin your classroom on the map'}
            </div>

            <div className="radius-row">
              <span className="radius-label">Allowed radius:</span>
              <div className="radius-chips">
                {RADII.map(r => (
                  <button key={r} type="button" className={`chip ${radius === r ? 'chip-active' : ''}`} onClick={() => setRadius(r)}>{r}m</button>
                ))}
              </div>
            </div>

            {pinStatus === 'set' && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(0,102,255,0.04)', border: '1px solid rgba(0,102,255,0.1)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--blue)' }}>Save for next time:</span>
                <input
                  placeholder="e.g. Lecture Hall C, Room 204"
                  value={locName}
                  onChange={e => setLocName(e.target.value)}
                  style={{ flex: 1, minWidth: 150, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem' }}
                />
                <Button size="sm" variant="secondary" loading={saving} onClick={savePreset} disabled={!locName.trim()} icon={<Save size={14}/>}>
                  Save Location
                </Button>
              </div>
            )}
          </Card>

          {pinStatus === 'set' && (
            <Card style={{ marginTop: 16 }}>
              <div className="step-head">
                <div className="step-num">2</div>
                <div>
                  <p className="step-title">Select Semester, Week & Session</p>
                  <p className="step-sub">Attendance is saved per class session</p>
                </div>
              </div>
              <Select label="Semester" value={semesterId} onChange={e => {
                const id = e.target.value
                setSemesterId(id)
                const sem = semesters.find(s => String(s.id) === id)
                const wk = sem?.weeks?.[0]
                setWeekId(wk ? String(wk.id) : '')
                const sess = wk ? getSessions(wk)[0] : null
                setSessionId(sess ? String(sess.id) : '')
              }} style={{ marginTop: 12 }}>
                {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Select label="Week" value={weekId} onChange={e => {
                const id = e.target.value
                setWeekId(id)
                const wk = weeks.find(w => String(w.id) === id)
                const sess = wk ? getSessions(wk)[0] : null
                setSessionId(sess ? String(sess.id) : '')
              }} style={{ marginTop: 12 }} disabled={!weeks.length}>
                {weeks.map(w => <option key={w.id} value={w.id}>Week {w.week_number}</option>)}
              </Select>
              <Select label="Class & Topic" value={sessionId} onChange={e => setSessionId(e.target.value)} style={{ marginTop: 12 }} disabled={!sessions.length}>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.class_name} — {s.topic}</option>
                ))}
              </Select>
              {selectedSession && (
                <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: 8 }}>
                  {selectedSemester?.name} · Week {selectedWeek?.week_number} · <strong>{selectedSession.class_name}</strong> · {selectedSession.topic}
                </p>
              )}
              <Button fullWidth loading={loading} onClick={generate} icon={<QrCode size={16}/>} style={{ marginTop: 16 }} size="lg">
                Generate QR Code
              </Button>
            </Card>
          )}
        </div>
      )}

      {step === 'qr' && session && qrUrl && (
        <div className="qr-display-step animate-fade-up">
          <Card className="qr-main-card">
            <div className="qr-top-badges">
              <span className="qr-live-badge"><span className="live-dot"/>Live Session</span>
              <span className="qr-badge-item">📅 {session.semester_name}</span>
              <span className="qr-badge-item">Week {session.week_number}</span>
              <span className="qr-badge-item">{session.class_name}</span>
              <span className="qr-badge-item">📚 {session.topic}</span>
              <span className="qr-badge-item">🔑 {session.code}</span>
            </div>
            <div className="qr-frame-big"><img src={qrUrl} alt="Attendance QR" className="qr-img-big"/></div>
            <div className="qr-link-row">
              <input readOnly value={session.attendance_url || ''} className="qr-link-input"/>
              <Button size="sm" onClick={() => navigator.clipboard.writeText(session.attendance_url || '')}>Copy Link</Button>
            </div>
            <div className="qr-actions">
              <Button variant="secondary" icon={<ArrowLeft size={15}/>} onClick={() => setStep('map')} style={{ flex: 1 }}>Back to Map</Button>
              <Button variant="danger" loading={ending} onClick={endSession} style={{ flex: 1 }}>⛔ End Session</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

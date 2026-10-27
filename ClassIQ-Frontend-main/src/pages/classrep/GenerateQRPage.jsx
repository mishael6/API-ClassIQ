import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { classrepApi } from '../../lib/api'
import { L, ensureLeafletIcons } from '../../lib/leafletSetup'
import { Button, Select, Alert, Card, PageHeader } from '../../components/ui'
import { MapPin, QrCode, Navigation, Loader2, ArrowLeft, Bookmark, Save, Trash2, Search } from 'lucide-react'
import QRCode from 'qrcode'
import '../../components/ui/components.css'
import './generateqr.css'

const RADII       = [10, 20, 30, 50, 100, 150, 200]

export default function GenerateQRPage() {
  const [step,      setStep]      = useState('map')
  const [lecture,   setLecture]   = useState('')
  const [savedLectures, setSavedLectures] = useState([])
  const [radius,    setRadius]    = useState(100)
  const [pin,       setPin]       = useState(null)
  const [session,   setSession]   = useState(null)
  const [qrUrl,     setQrUrl]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [ending,    setEnding]    = useState(false)
  const [error,     setError]     = useState('')
  const [mapReady,  setMapReady]  = useState(false)
  const [pinStatus, setPinStatus] = useState('idle')

  // Coordinate input states
  const [manualLat,  setManualLat]  = useState('')
  const [manualLng,  setManualLng]  = useState('')
  const [coordError, setCoordError] = useState('')

  // Saved Locations states
  const [savedLocs, setSavedLocs] = useState([])
  const [saving,    setSaving]    = useState(false)
  const [locName,   setLocName]   = useState('')
  const [deleting,  setDeleting]  = useState(null)

  const mapRef    = useRef(null)
  const leaflet   = useRef(null)
  const markerRef = useRef(null)
  const circleRef = useRef(null)
  const radiusRef = useRef(radius)

  useEffect(() => { radiusRef.current = radius }, [radius])

  useEffect(() => {
    classrepApi.getSavedLocations()
      .then(res => setSavedLocs(res.data.locations || []))
      .catch(() => {})
    classrepApi.getSavedLectures()
      .then(res => {
        const list = res.data.lectures || []
        setSavedLectures(list)
        if (list.length) setLecture(list[0].name)
      })
      .catch(() => {})
  }, [])

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
      setManualLat(la.toFixed(6))
      setManualLng(lo.toFixed(6))
      circle.setLatLng([la, lo])
    })

    markerRef.current = marker
    circleRef.current = circle
    setPin({ lat, lng })
    setManualLat(lat.toFixed(6))
    setManualLng(lng.toFixed(6))
    setPinStatus('set')
    map.setView([lat, lng], 18)
  }, [])

  useEffect(() => {
    if (step !== 'map' || !mapRef.current) return

    ensureLeafletIcons()
    setMapReady(false)

    const pinIcon = L.divIcon({
      className: '', html: `<div class="map-pin-icon"></div>`,
      iconSize: [28, 28], iconAnchor: [14, 28],
    })

    const map = L.map(mapRef.current, { zoomControl: true }).setView([6.6884, -1.6244], 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(map)

    map.on('click', e => placePin(map, pinIcon, e.latlng.lat, e.latlng.lng))
    leaflet.current = { map, L, pinIcon }

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
  }, [step, placePin])

  useEffect(() => {
    if (circleRef.current) circleRef.current.setRadius(radius)
  }, [radius])

  const placePinOnMap = (lat, lng) => {
    if (!leaflet.current) return
    const { map, pinIcon } = leaflet.current
    placePin(map, pinIcon, lat, lng)
  }

  const autoLocate = () => {
    if (!navigator.geolocation) { setError('GPS not supported.'); return }
    if (!leaflet.current) { setError('Map not ready yet.'); return }
    navigator.geolocation.getCurrentPosition(
      p => placePinOnMap(p.coords.latitude, p.coords.longitude),
      () => setError('Could not get your location. Enter coordinates manually or click the map.'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // ── New: Apply manually entered coordinates ──
  const applyManualCoords = () => {
    setCoordError('')
    const lat = parseFloat(manualLat)
    const lng = parseFloat(manualLng)

    if (isNaN(lat) || isNaN(lng)) {
      setCoordError('Please enter valid numbers for both latitude and longitude.')
      return
    }
    if (lat < -90 || lat > 90) {
      setCoordError('Latitude must be between -90 and 90.')
      return
    }
    if (lng < -180 || lng > 180) {
      setCoordError('Longitude must be between -180 and 180.')
      return
    }
    if (!leaflet.current) {
      setCoordError('Map not ready yet. Please wait a moment.')
      return
    }

    const { map, pinIcon } = leaflet.current
    placePin(map, pinIcon, lat, lng)
  }

  const applySavedLocation = (id) => {
    const loc = savedLocs.find(l => String(l.id) === String(id))
    if (!loc || !leaflet.current) return
    const lat = parseFloat(loc.lat)
    const lng = parseFloat(loc.lng)
    setRadius(parseInt(loc.radius_m))
    placePin(leaflet.current.map, leaflet.current.pinIcon, lat, lng)
  }

  const savePreset = async () => {
    if (!locName.trim() || !pin) return
    setSaving(true)
    try {
      const res = await classrepApi.saveLocation({ name: locName, lat: pin.lat, lng: pin.lng, radius_m: radius })
      if (res.data.success) {
        setSavedLocs([{ id: res.data.id, name: locName, lat: pin.lat, lng: pin.lng, radius_m: radius }, ...savedLocs])
        setLocName('')
      } else setError(res.data.message || 'Error saving location.')
    } catch {
      setError('Network error saving location.')
    } finally { setSaving(false) }
  }

  const removeSavedLocation = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Delete this saved location?')) return
    setDeleting(id)
    try {
      await classrepApi.deleteSavedLocation(id)
      setSavedLocs(savedLocs.filter(l => l.id !== id))
    } catch {
      setError('Failed to delete saved location.')
    } finally { setDeleting(null) }
  }

  const generate = async () => {
    if (!pin) { setError('Please drop a pin on the map first.'); return }
    if (!lecture) { setError('Please select a lecture. Add lecture names on your dashboard first.'); return }
    setError(''); setLoading(true)
    try {
      const { data } = await classrepApi.generateQR({
        lecture_name: lecture, lat: pin.lat, lng: pin.lng, radius_m: radius,
      })
      if (data.success) {
        setSession(data.session)
        const url = await QRCode.toDataURL(
          data.attendance_url || data.session?.attendance_url,
          { width: 500, margin: 2, color: { dark: '#000000', light: '#ffffff' } }
        )
        setQrUrl(url)
        setStep('qr')
      } else setError(data.message || 'Failed to generate QR.')
    } catch (err) {
      setError(err?.response?.data?.message || 'Connection error. Please try again.')
    } finally { setLoading(false) }
  }

  const endSession = async () => {
    if (!session) return
    setEnding(true)
    try {
      await classrepApi.endSession({ session_id: session.id })
      setSession(null); setQrUrl(''); setPin(null)
      setManualLat(''); setManualLng('')
      setPinStatus('idle'); setStep('map')
    } catch { setError('Failed to end session.') }
    finally { setEnding(false) }
  }

  return (
    <div className="animate-fade-up qr-page">
      <PageHeader
        title="Generate Attendance QR"
        subtitle={step === 'map'
          ? 'Pin your classroom on the map, select lecture, then generate QR'
          : 'Show this QR code to your students to mark attendance'}
      />

      {error && <Alert variant="error" onClose={() => setError('')} style={{ marginBottom: 16 }}>{error}</Alert>}

      {/* ── MAP STEP ── */}
      {step === 'map' && (
        <div className="qr-map-step">
          <Card>
            <div className="step-head" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="step-num">1</div>
                <div>
                  <p className="step-title">Pin Your Classroom</p>
                  <p className="step-sub">Click the map, use GPS, enter coordinates, or select a saved preset</p>
                </div>
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {savedLocs.length > 0 && (
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Bookmark size={15} style={{ color: 'var(--blue)' }}/>
                    <select
                      onChange={e => applySavedLocation(e.target.value)}
                      value=""
                      style={{ padding: '6px 28px 6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem', minWidth: 140, cursor: 'pointer', background: 'var(--surface)' }}
                    >
                      <option value="" disabled>Quick Select...</option>
                      {savedLocs.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name} ({loc.radius_m}m)</option>
                      ))}
                    </select>
                  </div>
                )}
                <Button variant="ghost" size="sm" icon={<Navigation size={14}/>} onClick={autoLocate}>
                  Use GPS
                </Button>
              </div>
            </div>

            {/* Saved location chips */}
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

            {/* ── Manual Coordinate Input ── */}
            <div style={{
              padding: '14px 16px',
              background: 'rgba(0,102,255,0.04)',
              border: '1px solid rgba(0,102,255,0.15)',
              borderRadius: 10,
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <MapPin size={15} style={{ color: 'var(--blue)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--blue)' }}>
                  Enter Exact Coordinates
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: 4 }}>
                  — for more precise location than GPS
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 6.688400"
                    value={manualLat}
                    onChange={e => setManualLat(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px',
                      border: '1px solid var(--border)', borderRadius: 8,
                      fontSize: '0.9rem', background: 'var(--surface)',
                      color: 'var(--text)', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. -1.624400"
                    value={manualLng}
                    onChange={e => setManualLng(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px',
                      border: '1px solid var(--border)', borderRadius: 8,
                      fontSize: '0.9rem', background: 'var(--surface)',
                      color: 'var(--text)', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={applyManualCoords}
                  icon={<Search size={14}/>}
                  style={{ whiteSpace: 'nowrap', height: 38 }}
                >
                  Pin Location
                </Button>
              </div>
              {coordError && (
                <p style={{ fontSize: '0.78rem', color: 'var(--red)', marginTop: 8, margin: '8px 0 0' }}>
                  ⚠️ {coordError}
                </p>
              )}
              <p style={{ fontSize: '0.73rem', color: 'var(--muted)', marginTop: 8, margin: '8px 0 0' }}>
                💡 Tip: Open Google Maps, long-press your classroom and copy the coordinates shown at the bottom.
              </p>
            </div>

            {/* Map */}
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
              {pinStatus === 'set'
                ? `✅ Pinned at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)} — drag marker to adjust`
                : '🗺️ Click the map, use GPS, or enter coordinates above to pin your classroom'}
            </div>

            <div className="radius-row">
              <span className="radius-label">Allowed radius:</span>
              <div className="radius-chips">
                {RADII.map(r => (
                  <button key={r} type="button"
                    className={`chip ${radius === r ? 'chip-active' : ''}`}
                    onClick={() => setRadius(r)}
                  >{r}m</button>
                ))}
              </div>
            </div>

            {pinStatus === 'set' && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(0,102,255,0.04)', border: '1px solid rgba(0,102,255,0.1)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--blue)' }}>Save this preset for next time:</span>
                <input
                  placeholder="e.g. Lecture Hall C"
                  value={locName}
                  onChange={e => setLocName(e.target.value)}
                  style={{ flex: 1, minWidth: 150, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.85rem' }}
                />
                <Button size="sm" variant="secondary" loading={saving} onClick={savePreset} disabled={!locName.trim()}>
                  <Save size={14} style={{ marginRight: 6 }}/> Save
                </Button>
              </div>
            )}
          </Card>

          {/* Step 2 — lecture + generate */}
          {pinStatus === 'set' && (
            <Card className="animate-fade-up" style={{ marginTop: 16 }}>
              <div className="step-head">
                <div className="step-num">2</div>
                <div>
                  <p className="step-title">Select Lecture &amp; Generate</p>
                  <p className="step-sub">Choose a saved lecture name, then generate the QR code</p>
                </div>
              </div>

              <div className="pin-confirm-box">
                <div className="pin-confirm-item">
                  <span className="pc-label">📍 Location</span>
                  <span className="pc-value">{pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</span>
                </div>
                <div className="pc-divider"/>
                <div className="pin-confirm-item">
                  <span className="pc-label">📏 Radius</span>
                  <span className="pc-value">{radius}m</span>
                </div>
              </div>

              {savedLectures.length === 0 ? (
                <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(229,62,62,0.06)', border: '1px solid rgba(229,62,62,0.15)', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--txt2)' }}>
                    No lectures saved yet. Go to your{' '}
                    <Link to="/dashboard" style={{ color: 'var(--blue)', fontWeight: 700 }}>dashboard</Link>
                    {' '}and add lecture names under <strong>My Lectures</strong> first.
                  </p>
                </div>
              ) : (
                <Select label="Lecture Name" id="lecture" value={lecture}
                  onChange={e => setLecture(e.target.value)} style={{ marginTop: 16 }}>
                  <option value="" disabled>Select a lecture...</option>
                  {savedLectures.map(l => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </Select>
              )}

              <Button fullWidth loading={loading} onClick={generate}
                icon={<QrCode size={16}/>} style={{ marginTop: 16 }} size="lg"
                disabled={!lecture || savedLectures.length === 0}>
                Generate QR Code
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* ── QR STEP ── */}
      {step === 'qr' && session && qrUrl && (
        <div className="qr-display-step animate-fade-up">
          <Card className="qr-main-card">
            <div className="qr-top-badges">
              <span className="qr-live-badge"><span className="live-dot"/>Live Session</span>
              <span className="qr-badge-item">📚 {session.lecture_name}</span>
              <span className="qr-badge-item">📏 {radius}m radius</span>
              <span className="qr-badge-item">🔑 {session.code}</span>
            </div>

            <div className="qr-frame-big">
              <img src={qrUrl} alt="Attendance QR Code" className="qr-img-big"/>
            </div>

            <div className="qr-info-strip">
              <div className="qr-info-item">
                <span className="qr-info-label">Location</span>
                <span className="qr-info-value">{pin?.lat.toFixed(5)}, {pin?.lng.toFixed(5)}</span>
              </div>
              <div className="qr-info-divider"/>
              <div className="qr-info-item">
                <span className="qr-info-label">Lecture</span>
                <span className="qr-info-value">{session.lecture_name}</span>
              </div>
              <div className="qr-info-divider"/>
              <div className="qr-info-item">
                <span className="qr-info-label">Code</span>
                <span className="qr-info-value" style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>{session.code}</span>
              </div>
            </div>

            <div className="qr-link-row">
              <input readOnly value={session.attendance_url || ''} className="qr-link-input"/>
              <Button size="sm" onClick={() => navigator.clipboard.writeText(session.attendance_url || '')}>
                Copy Link
              </Button>
            </div>

            <p className="qr-hint">
              Show this QR to your students — they must be within <strong>{radius}m</strong> of your pinned location to mark attendance
            </p>

            <div className="qr-actions">
              <Button
                variant="secondary"
                icon={<ArrowLeft size={15}/>}
                onClick={() => setStep('map')}
                style={{ flex: 1 }}
              >
                Back to Map
              </Button>
              <Button
                variant="danger"
                loading={ending}
                onClick={endSession}
                style={{ flex: 1 }}
              >
                ⛔ End Session
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

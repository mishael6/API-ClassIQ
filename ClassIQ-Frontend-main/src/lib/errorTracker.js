export function initErrorTracking() {
  const sendError = (errData) => {
    fetch('https://api-classiq.onrender.com/system_ping.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errData)
    }).catch(() => {}) // silently fail network errors to avoid loops
  }

  // Native window errors (e.g. React crashes, syntax errors)
  window.addEventListener('error', (event) => {
    sendError({
      message: event.message || 'Unknown window error',
      stack: event.error?.stack || '',
      url: window.location.href
    })
  })

  // Unhandled Promises (e.g. dropped API calls without catches)
  window.addEventListener('unhandledrejection', (event) => {
    sendError({
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack || '',
      url: window.location.href
    })
  })
}

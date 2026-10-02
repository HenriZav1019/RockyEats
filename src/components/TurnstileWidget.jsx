import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.onload = () => resolve(window.turnstile)
      script.onerror = () => {
        scriptPromise = null
        reject(new Error('Turnstile failed to load'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

// Cloudflare Turnstile checkbox. Calls onToken(token) when solved and
// onToken(null) when the token expires or errors. Parent can call
// ref.current.reset() to get a fresh token (tokens are single-use).
const TurnstileWidget = forwardRef(function TurnstileWidget({ siteKey, language, onToken }, ref) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current(null)
      if (window.turnstile && widgetIdRef.current !== null) window.turnstile.reset(widgetIdRef.current)
    },
  }))

  useEffect(() => {
    let cancelled = false
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          language: language || 'auto',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        })
      })
      .catch(() => onTokenRef.current(null))
    return () => {
      cancelled = true
      if (window.turnstile && widgetIdRef.current !== null) window.turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [siteKey, language])

  return <div ref={containerRef} className="flex min-h-[65px] justify-center" />
})

export default TurnstileWidget

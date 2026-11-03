import { useEffect, useState } from 'react'

// "Add to home screen" support.
// - Android Chrome/Edge/Samsung fire `beforeinstallprompt`; we keep it so the
//   guide can offer a one-tap "Instalar" button.
// - iPhone/iPad never fire it: the only way is Share > Add to Home Screen,
//   so the guide shows those steps.
// - Facebook/Instagram/TikTok in-app browsers can't install at all; the guide
//   tells people to open the page in their real browser first.

let deferredPrompt = null
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // we show our own button instead of the mini-infobar
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

export function detectPlatform() {
  const ua = navigator.userAgent || ''
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  if (/iPhone|iPad|iPod/i.test(ua) || iPadOS) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

export function isInAppBrowser() {
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Snapchat/i.test(navigator.userAgent || '')
}

export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  )
}

export function useInstall() {
  const [canPrompt, setCanPrompt] = useState(Boolean(deferredPrompt))
  const [installed, setInstalled] = useState(() => isStandalone())
  useEffect(() => {
    const update = () => setCanPrompt(Boolean(deferredPrompt))
    listeners.add(update)
    const mq = window.matchMedia?.('(display-mode: standalone)')
    const onMode = () => setInstalled(isStandalone())
    mq?.addEventListener?.('change', onMode)
    return () => {
      listeners.delete(update)
      mq?.removeEventListener?.('change', onMode)
    }
  }, [])

  // Returns 'accepted' | 'dismissed' | 'unavailable'
  const prompt = async () => {
    if (!deferredPrompt) return 'unavailable'
    const e = deferredPrompt
    deferredPrompt = null
    notify()
    await e.prompt()
    const { outcome } = await e.userChoice
    if (outcome === 'accepted') setInstalled(true)
    return outcome
  }

  return { canPrompt, installed, prompt }
}

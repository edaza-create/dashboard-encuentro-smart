import { useState, useEffect } from 'react'

/**
 * Countdown en tiempo real hasta `closesAt`.
 * @param {string|null} closesAt — ISO 8601 timestamp
 * @returns {{ remaining: string, progress: number, expired: boolean, totalSeconds: number }}
 */
export function useCountdown(closesAt) {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (!closesAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [closesAt])

  if (!closesAt) return { remaining: '--:--', progress: 0, expired: true, totalSeconds: 0 }

  const end = new Date(closesAt).getTime()
  const diff = Math.max(0, end - now)
  const totalSeconds = Math.ceil(diff / 1000)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  const remaining = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  const DURATION = 35 * 60 * 1000
  const elapsed = DURATION - diff
  const progress = Math.min(1, Math.max(0, elapsed / DURATION))

  return { remaining, progress, expired: diff <= 0, totalSeconds }
}

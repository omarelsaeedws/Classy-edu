import React, { useEffect, useState } from 'react'

const getRemainingSeconds = (expiresAt: string) => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))

export const AttendanceCountdown: React.FC<{ expiresAt: string }> = ({ expiresAt }) => {
  const [remaining, setRemaining] = useState(() => getRemainingSeconds(expiresAt))

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(getRemainingSeconds(expiresAt)), 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  if (remaining <= 0) return <span role="status">انتهى وقت تسجيل الحضور</span>
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0')
  const seconds = (remaining % 60).toString().padStart(2, '0')
  return <span role="timer" aria-live="off">متبقي {minutes}:{seconds}</span>
}

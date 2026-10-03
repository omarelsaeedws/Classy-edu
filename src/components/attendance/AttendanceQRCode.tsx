import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export const AttendanceQRCode: React.FC<{ value: string }> = ({ value }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(value, { errorCorrectionLevel: 'M', margin: 1, width: 256 })
      .then((url) => { if (!cancelled) setImageUrl(url) })
      .catch((error: unknown) => {
        console.error('Could not generate attendance QR code:', error)
        if (!cancelled) setFailed(true)
      })
    return () => { cancelled = true }
  }, [value])

  if (failed) return <p role="alert" className="text-sm text-[#B91C1C]">تعذّر إنشاء QR. استخدم كود الحضور اليدوي.</p>
  if (!imageUrl) return <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">جارٍ إنشاء QR...</p>
  return <img src={imageUrl} alt="رمز QR لتسجيل الحضور" className="mx-auto h-64 w-64 rounded-lg border border-[#E2E8F0] bg-white p-2 dark:border-[#334155]" />
}

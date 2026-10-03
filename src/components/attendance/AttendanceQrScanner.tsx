import React, { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface DetectedBarcode { rawValue: string }
interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
interface NativeBarcodeDetectorConstructor {
  new(options?: { formats: string[] }): NativeBarcodeDetector
}
type WindowWithBarcodeDetector = Window & { BarcodeDetector?: NativeBarcodeDetectorConstructor }

export const AttendanceQrScanner: React.FC<{ onPayload: (payload: string) => void }> = ({ onPayload }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const [active, setActive] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const stop = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setActive(false)
  }

  const scanFrame = async (detector: NativeBarcodeDetector) => {
    const video = videoRef.current
    if (!video || !streamRef.current) return
    try {
      const results = await detector.detect(video)
      if (results[0]?.rawValue) {
        stop()
        onPayload(results[0].rawValue)
        return
      }
    } catch (scanError) {
      console.warn('QR camera scan failed:', scanError)
      setMessage('تعذّر قراءة الرمز. يمكنك إدخال الكود يدويًا.')
      stop()
      return
    }
    timerRef.current = window.setTimeout(() => { void scanFrame(detector) }, 350)
  }

  const start = async () => {
    setMessage('')
    const Detector = (window as WindowWithBarcodeDetector).BarcodeDetector
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setMessage('المتصفح لا يدعم قراءة QR بالكاميرا. أدخل كود الحضور يدويًا.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setActive(true)
      void scanFrame(new Detector({ formats: ['qr_code'] }))
    } catch (cameraError) {
      console.warn('Could not access attendance QR camera:', cameraError)
      setMessage('لم نتمكن من فتح الكاميرا. تحقق من الإذن أو أدخل الكود يدويًا.')
      stop()
    }
  }

  return <section className="space-y-3">
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void (active ? Promise.resolve(stop()) : start())}>{active ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}{active ? 'إيقاف الكاميرا' : 'مسح رمز QR'}</Button></div>
    {active && <video ref={videoRef} className="max-h-72 w-full rounded-lg border border-[#E2E8F0] object-cover dark:border-[#334155]" muted playsInline aria-label="كاميرا مسح رمز الحضور" />}
    {message && <p role="status" className="text-sm text-[#64748B] dark:text-[#94A3B8]">{message}</p>}
  </section>
}

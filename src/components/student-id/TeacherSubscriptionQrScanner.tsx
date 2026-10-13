import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { Camera, CameraOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface TeacherSubscriptionQrScannerProps {
  disabled?: boolean
  onPayload: (payload: string) => void
}

export const TeacherSubscriptionQrScanner = ({ disabled = false, onPayload }: TeacherSubscriptionQrScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const activeRef = useRef(false)
  const mountedRef = useRef(true)
  const runIdRef = useRef(0)
  const [scanning, setScanning] = useState(false)
  const [message, setMessage] = useState('')

  const stop = () => {
    runIdRef.current += 1
    activeRef.current = false
    controlsRef.current?.stop()
    controlsRef.current = null
    setScanning(false)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      runIdRef.current += 1
      activeRef.current = false
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [])

  const start = async () => {
    if (!videoRef.current || activeRef.current) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('الكاميرا غير متاحة في هذا المتصفح. استخدم إدخال الرقم يدويًا.')
      return
    }
    setMessage('')
    activeRef.current = true
    setScanning(true)
    const runId = ++runIdRef.current
    const reader = new BrowserQRCodeReader()
    try {
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result, _scanError, callbackControls) => {
          if (!result || !activeRef.current || runId !== runIdRef.current) return
          activeRef.current = false
          callbackControls.stop()
          controlsRef.current = null
          if (mountedRef.current) setScanning(false)
          onPayload(result.getText())
        },
      )
      if (!mountedRef.current || !activeRef.current || runId !== runIdRef.current) controls.stop()
      else controlsRef.current = controls
    } catch (cameraError) {
      console.warn('Could not start subscription QR scanner:', cameraError)
      activeRef.current = false
      if (mountedRef.current) {
        setScanning(false)
        setMessage('تعذّر فتح الكاميرا. اسمح باستخدامها أو أدخل الرقم التعريفي يدويًا.')
      }
    }
  }

  return <section className="space-y-3 rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]" aria-label="ماسح QR للاشتراك">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">مسح بطاقة الطالب</h2><p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">لن نطلب إذن الكاميرا إلا بعد بدء المسح.</p></div><Button type="button" variant="outline" disabled={disabled} onClick={() => scanning ? stop() : void start()}>{scanning ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}{scanning ? 'إيقاف المسح' : 'بدء مسح QR'}</Button></div>
    <video ref={videoRef} className={scanning ? 'max-h-80 w-full rounded-lg bg-black object-cover' : 'hidden'} muted playsInline aria-label="عرض الكاميرا لمسح بطاقة الطالب" />
    {message && <p role="status" className="text-sm text-[#64748B] dark:text-[#94A3B8]">{message}</p>}
  </section>
}

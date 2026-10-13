import { useEffect, useRef, useState } from 'react'
import { Camera, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase/client'

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']

export const StudentAvatarSettings = () => {
  const { profile, user, refreshProfile } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [signedAvatar, setSignedAvatar] = useState<{ path: string; url: string } | null>(null)
  const currentPath = profile?.avatar_url ?? null
  const currentUrl = currentPath && signedAvatar?.path === currentPath ? signedAvatar.url : null
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const path = currentPath
    if (!path || !user) return

    void supabase.storage.from('student-avatars').createSignedUrl(path, 900)
      .then(({ data, error: signError }) => {
        if (cancelled) return
        if (signError) {
          console.error('Could not sign current student avatar:', signError)
        } else setSignedAvatar({ path, url: data.signedUrl })
      })
    return () => { cancelled = true }
  }, [currentPath, user])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const chooseFile = (file: File | undefined) => {
    if (!file) return
    setMessage('')
    setError('')
    if (!acceptedTypes.includes(file.type)) {
      setError('اختر صورة بصيغة JPG أو PNG أو WebP.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('حجم الصورة يجب ألا يتجاوز 2 ميجابايت.')
      return
    }
    setPreviewUrl(URL.createObjectURL(file))
    setSelectedFile(file)
  }

  const saveImage = async () => {
    if (!selectedFile || !user) return
    setUploading(true)
    setError('')
    setMessage('')
    const extension = selectedFile.type === 'image/jpeg' ? 'jpg' : selectedFile.type.split('/')[1]
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`
    let uploaded = false
    try {
      const { error: uploadError } = await supabase.storage.from('student-avatars').upload(path, selectedFile, {
        cacheControl: '3600',
        contentType: selectedFile.type,
        upsert: false,
      })
      if (uploadError) throw uploadError
      uploaded = true

      const { error: saveError } = await supabase.rpc('save_my_student_avatar', { p_avatar_path: path })
      if (saveError) throw saveError

      const previousPath = profile?.avatar_url
      if (previousPath && previousPath.startsWith(`${user.id}/`)) {
        const { error: removeError } = await supabase.storage.from('student-avatars').remove([previousPath])
        if (removeError) console.warn('Could not remove previous student avatar:', removeError)
      }

      await refreshProfile()
      setSelectedFile(null)
      setPreviewUrl(null)
      setMessage('تم حفظ الصورة الشخصية بنجاح.')
    } catch (saveError) {
      console.error('Could not save student avatar:', saveError)
      if (uploaded) await supabase.storage.from('student-avatars').remove([path])
      setError('تعذّر حفظ الصورة. تحقق من الاتصال وحاول مرة أخرى.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const image = previewUrl ?? currentUrl

  return <section id="profile-picture" className="scroll-mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]" aria-labelledby="student-avatar-heading">
    <h2 id="student-avatar-heading" className="font-semibold">الصورة الشخصية</h2>
    <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">تظهر صورتك في بطاقة الطالب. الصيغ المدعومة JPG وPNG وWebP، بحد أقصى 2 ميجابايت.</p>
    <div className="mt-4 flex flex-wrap items-center gap-4">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E2E8F0] bg-[#F8FAFC] dark:border-[#334155] dark:bg-[#111827]">
        {image ? <img src={image} alt="معاينة الصورة الشخصية" className="h-full w-full object-cover" /> : <UserRound className="h-9 w-9 text-[#64748B]" />}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => chooseFile(event.target.files?.[0])}
          aria-label="اختيار صورة شخصية"
        />
        <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          <Camera className="h-4 w-4" />{selectedFile ? 'اختيار صورة أخرى' : 'اختيار صورة'}
        </Button>
        {selectedFile && <Button type="button" disabled={uploading} onClick={() => void saveImage()}>
          {uploading ? 'جارٍ الرفع والحفظ...' : 'حفظ الصورة'}
        </Button>}
      </div>
    </div>
    {uploading && <div className="mt-4 space-y-2" role="status" aria-live="polite"><p className="text-sm text-[#64748B] dark:text-[#94A3B8]">جارٍ رفع الصورة وحفظها في حسابك...</p><progress className="h-2 w-full accent-[#2563EB]" aria-label="تقدم رفع الصورة" /></div>}
    {message && <p role="status" className="mt-3 text-sm text-green-700 dark:text-green-300">{message}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
  </section>
}

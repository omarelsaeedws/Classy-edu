import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Camera, Plus, Save, UserRound, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AVAILABLE_SUBJECTS } from '@/constants/education'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TeacherGroupsPage } from '@/pages/Teacher/TeacherGroupsPage'
import { teacherProfileService } from '@/features/teacher-profile/teacherProfileService'
import type { TeacherSemester } from '@/features/teacher-profile/types'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { PAYMENT_PROVIDERS, type PaymentProvider } from '@/features/teacher-subscriptions/types'
import type { TeacherStudentPaymentMethod } from '@/features/teacher-profile/types'

const panelClass = 'rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B] sm:p-6'
const fieldClass = 'h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#F8FAFC]'

export const TeacherProfilePage: React.FC = () => {
  const { refreshProfile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarPath, setAvatarPath] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [subjects, setSubjects] = useState<string[]>([])
  const [newSubject, setNewSubject] = useState('')
  const [semester, setSemester] = useState<TeacherSemester>('FIRST')
  const [address, setAddress] = useState('')
  const [bio, setBio] = useState('')
  const [lessonTitle, setLessonTitle] = useState('')
  const [teachingArea, setTeachingArea] = useState('أبو كبير')
  const [monthlyPrice, setMonthlyPrice] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<TeacherStudentPaymentMethod[]>([])
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('INSTAPAY')
  const [paymentAccountHolder, setPaymentAccountHolder] = useState('')
  const [paymentAccountIdentifier, setPaymentAccountIdentifier] = useState('')
  const [paymentInstructions, setPaymentInstructions] = useState('')
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<string | null>(null)
  const [savingPaymentMethod, setSavingPaymentMethod] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const loadProfile = useCallback(async () => {
    setError('')
    try {
      const [data, methods] = await Promise.all([
        teacherProfileService.getOwnProfile(),
        teacherProfileService.getPaymentMethods(),
      ])
      setFullName(data.account?.full_name ?? '')
      setPhone(data.account?.phone ?? '')
      setAvatarPath(data.account?.avatar_path ?? null)
      setAvatarUrl(data.account?.avatar_url ?? null)
      setSubjects(data.profile?.subjects ?? (data.profile ? [data.profile.subject] : []))
      setPaymentMethods(methods)
      if (data.profile) {
        setSemester(data.profile.semester)
        setAddress(data.profile.teaching_address)
        setBio(data.profile.bio ?? '')
        setLessonTitle(data.profile.lesson_title ?? '')
        setTeachingArea(data.profile.teaching_area ?? 'أبو كبير')
        setMonthlyPrice(data.profile.monthly_price === null ? '' : String(data.profile.monthly_price))
      }
    } catch (loadError) {
      console.error('Could not load teacher workspace:', loadError)
      setError('تعذّر تحميل بياناتك. تأكد من تطبيق ترحيل بيانات المدرس والاشتراكات الطلابية في Supabase ثم أعد المحاولة.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProfile() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadProfile])

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const markChanged = () => setSaved(false)
  const addSubject = (candidate: string) => {
    const normalized = candidate.trim()
    if (normalized.length < 2 || subjects.length >= 12 || subjects.includes(normalized)) return
    setSubjects((current) => [...current, normalized])
    setNewSubject('')
    markChanged()
  }
  const chooseAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setAvatarFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    markChanged()
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSaved(false)
    if (fullName.trim().length < 2 || !/^01[0125]\d{8}$/.test(phone.trim())) {
      setError('أدخل اسمًا صحيحًا ورقم هاتف مصريًا مكوّنًا من 11 رقمًا.')
      return
    }
    if (!subjects.length || !address.trim() || lessonTitle.trim().length < 2 || !teachingArea.trim()) {
      setError('أضف مادة واحدة على الأقل، واكتب عنوان الدروس وعنوانها التعريفي.')
      return
    }
    if (!Number.isFinite(Number(monthlyPrice)) || Number(monthlyPrice) <= 0 || Number(monthlyPrice) > 100000) {
      setError('أدخل سعرًا شهريًا أكبر من صفر ولا يتجاوز 100000 جنيه.')
      return
    }

    setSaving(true)
    try {
      await teacherProfileService.saveWorkspace({
        fullName, phone, avatarPath, avatarFile, subjects, semester, teachingAddress: address,
        bio, lessonTitle, teachingArea, monthlyPrice: Number(monthlyPrice),
      })
      setAvatarFile(null)
      setPreviewUrl(null)
      await Promise.all([loadProfile(), refreshProfile()])
      setSaved(true)
    } catch (saveError) {
      console.error('Could not save teacher workspace:', saveError)
      const message = saveError instanceof Error ? saveError.message : ''
      setError(message.includes('active teacher subscription')
        ? 'يجب أن يكون اشتراك المنصة فعّالًا لتعديل بيانات المدرس.'
        : message.includes('subject assigned to an existing group')
          ? 'لا يمكن حذف مادة مرتبطة بمجموعة موجودة. احذف المجموعة أو غيّر مادتها أولًا.'
          : message.includes('Unsupported image') || message.includes('2 MB')
            ? 'الصورة يجب أن تكون JPG أو PNG أو WEBP وألا يتجاوز حجمها 2 ميجابايت.'
            : 'تعذّر حفظ البيانات. راجع الحقول وحاول مرة أخرى.')
    } finally { setSaving(false) }
  }

  const savePaymentMethod = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (paymentAccountHolder.trim().length < 2 || paymentAccountIdentifier.trim().length < 3) {
      setError('أدخل اسم صاحب وسيلة الدفع وبيانات التحويل بشكل صحيح.')
      return
    }
    setSavingPaymentMethod(true)
    setError('')
    try {
      await teacherProfileService.savePaymentMethod({
        id: editingPaymentMethodId ?? undefined,
        provider: paymentProvider,
        accountHolder: paymentAccountHolder,
        accountIdentifier: paymentAccountIdentifier,
        instructions: paymentInstructions,
        isActive: true,
      })
      setPaymentMethods(await teacherProfileService.getPaymentMethods())
      setPaymentAccountHolder('')
      setPaymentAccountIdentifier('')
      setPaymentInstructions('')
      setEditingPaymentMethodId(null)
      setSaved(true)
    } catch (methodError) {
      console.error('Could not save student payment method:', methodError)
      setError('تعذّر حفظ وسيلة الدفع. تأكد من عدم تكرار بيانات الحساب وحاول مرة أخرى.')
    } finally { setSavingPaymentMethod(false) }
  }

  const editPaymentMethod = (method: TeacherStudentPaymentMethod) => {
    setEditingPaymentMethodId(method.id)
    setPaymentProvider(method.provider)
    setPaymentAccountHolder(method.account_holder)
    setPaymentAccountIdentifier(method.account_identifier)
    setPaymentInstructions(method.instructions ?? '')
    setSaved(false)
  }

  const togglePaymentMethod = async (method: TeacherStudentPaymentMethod) => {
    try {
      await teacherProfileService.setPaymentMethodActive(method.id, !method.is_active)
      setPaymentMethods((current) => current.map((item) => item.id === method.id ? { ...item, is_active: !item.is_active } : item))
    } catch (methodError) {
      console.error('Could not update student payment method:', methodError)
      setError('تعذّر تحديث حالة وسيلة الدفع. حاول مرة أخرى.')
    }
  }

  const shownAvatar = previewUrl ?? avatarUrl
  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] transition-colors dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:px-6" dir="rtl">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <Link to="/teacher" className="mb-3 inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#3B82F6]"><ArrowRight className="h-4 w-4" />العودة للوحة المدرس</Link>
          <h1 className="text-2xl font-bold">بيانات المدرس والمجموعات والحصص</h1>
          <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">أكمل ملفك مرة واحدة، ثم أنشئ مجموعات المادة والصف وحدد مواعيد كل مجموعة.</p>
        </header>

        {error && <div role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
        {saved && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">تم حفظ بيانات المدرس بنجاح.</div>}

        {loading ? <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">جارٍ تحميل بياناتك...</p> : <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <section className={`${panelClass} space-y-4`}>
            <div><h2 className="text-base font-semibold">البيانات الشخصية</h2><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">اسمك وصورتك ورقم التواصل الذي يظهر في ملف المدرس.</p></div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94A3B8]">{shownAvatar ? <img src={shownAvatar} alt="صورة المدرس" className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8" />}</div>
              <div><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={chooseAvatar} /><Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4" />اختيار صورة</Button><p className="mt-2 text-xs text-[#64748B] dark:text-[#94A3B8]">JPG أو PNG أو WEBP، بحد أقصى 2 ميجابايت.</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2"><Input label="اسم المدرس" value={fullName} onChange={(event) => { setFullName(event.target.value); markChanged() }} maxLength={120} required /><Input label="رقم الهاتف" value={phone} onChange={(event) => { setPhone(event.target.value); markChanged() }} inputMode="tel" placeholder="01xxxxxxxxx" maxLength={11} required /></div>
          </section>

          <section className={`${panelClass} space-y-4`}>
            <div><h2 className="text-base font-semibold">المواد والبيانات التعليمية</h2><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">أضف المواد التي تدرّسها. ستختار مادة واحدة لكل مجموعة.</p></div>
            <div className="flex flex-wrap gap-2">{subjects.map((subject) => <span key={subject} className="inline-flex items-center gap-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-1.5 text-sm text-[#1D4ED8] dark:border-[#1E40AF]/50 dark:bg-[#1E3A8A]/40 dark:text-[#93C5FD]">{subject}<button type="button" aria-label={`حذف مادة ${subject}`} onClick={() => { setSubjects((current) => current.filter((item) => item !== subject)); markChanged() }} className="ms-1 text-[#64748B] hover:text-[#DC2626]">×</button></span>)}{subjects.length === 0 && <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">لم تضف مواد بعد.</p>}</div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><Input label="إضافة مادة" list="classy-subject-options" value={newSubject} onChange={(event) => setNewSubject(event.target.value)} maxLength={120} placeholder="اختر أو اكتب المادة" /><datalist id="classy-subject-options">{AVAILABLE_SUBJECTS.filter((item) => !subjects.includes(item)).map((item) => <option key={item} value={item} />)}</datalist><div className="self-end"><Button type="button" variant="outline" disabled={!newSubject.trim() || subjects.length >= 12} onClick={() => addSubject(newSubject)}><Plus className="h-4 w-4" />إضافة</Button></div></div>
            <label className="block text-sm font-medium"><span className="mb-1.5 block">الفصل الدراسي</span><select className={fieldClass} value={semester} onChange={(event) => { setSemester(event.target.value as TeacherSemester); markChanged() }}><option value="FIRST">الفصل الدراسي الأول</option><option value="SECOND">الفصل الدراسي الثاني</option><option value="BOTH">الفصلان الدراسيان</option></select></label>
            <Input label="عنوان مكان الدروس" value={address} onChange={(event) => { setAddress(event.target.value); markChanged() }} maxLength={300} required helperText="عنوان مكان التدريس الذي تريد مشاركته." />
          </section>

          <section className={`${panelClass} space-y-4`}>
            <div><h2 className="text-base font-semibold">معلومات ملفك للطلاب</h2><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">تظهر هذه المعلومات للطالب عند البحث عن مدرسين مناسبين لصفه.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="عنوان الدرس" value={lessonTitle} onChange={(event) => { setLessonTitle(event.target.value); markChanged() }} maxLength={160} required placeholder="مثال: تأسيس ومراجعة الرياضيات" />
              <Input label="المنطقة داخل أبو كبير" value={teachingArea} onChange={(event) => { setTeachingArea(event.target.value); markChanged() }} maxLength={120} required helperText="اكتب اسم القرية أو المنطقة؛ النطاق الحالي أبو كبير، الشرقية." />
              <Input label="السعر الشهري للطالب (جنيه)" type="number" min={1} max={100000} step="0.01" value={monthlyPrice} onChange={(event) => { setMonthlyPrice(event.target.value); markChanged() }} required />
            </div>
            <label className="block text-sm font-medium"><span className="mb-1.5 block">نبذة عن المدرس</span><textarea className={`${fieldClass} h-28 py-3`} value={bio} onChange={(event) => { setBio(event.target.value); markChanged() }} maxLength={2000} placeholder="اكتب خبرتك وطريقة شرحك بإيجاز" /></label>
          </section>

          <Button type="submit" disabled={saving} className="w-full justify-center"><Save className="h-4 w-4" />{saving ? 'جارٍ الحفظ...' : 'حفظ بيانات المدرس'}</Button>
        </form>}

        {!loading && <section className={`${panelClass} space-y-5`}>
          <div><h2 className="text-base font-semibold">طرق استلام مدفوعات الطلاب</h2><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">أضف بيانات التحويل التي ستظهر للطالب عند الاشتراك. هذه الوسائل منفصلة عن وسائل دفع اشتراكك في منصة Classy.</p></div>
          {paymentMethods.length > 0 && <div className="space-y-3">{paymentMethods.map((method) => <article key={method.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] p-4 dark:border-[#334155]">
            <div><p className="font-medium">{PAYMENT_PROVIDERS.find((item) => item.value === method.provider)?.label ?? method.provider} · {method.account_identifier}</p><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">صاحب الحساب: {method.account_holder} · {method.is_active ? 'ظاهرة للطلاب' : 'متوقفة'}</p></div>
            <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => editPaymentMethod(method)}><Pencil className="h-4 w-4" />تعديل</Button><Button type="button" size="sm" variant="outline" onClick={() => void togglePaymentMethod(method)}>{method.is_active ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}{method.is_active ? 'إيقاف' : 'تفعيل'}</Button></div>
          </article>)}</div>}
          <form onSubmit={(event) => void savePaymentMethod(event)} className="grid gap-4 border-t border-[#E2E8F0] pt-5 dark:border-[#334155] sm:grid-cols-2">
            <label className="block text-sm font-medium"><span className="mb-1.5 block">وسيلة الدفع</span><select className={fieldClass} value={paymentProvider} onChange={(event) => setPaymentProvider(event.target.value as PaymentProvider)}>{PAYMENT_PROVIDERS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label>
            <Input label="اسم صاحب الحساب" value={paymentAccountHolder} onChange={(event) => setPaymentAccountHolder(event.target.value)} maxLength={120} required />
            <Input label="رقم الهاتف أو معرّف التحويل" value={paymentAccountIdentifier} onChange={(event) => setPaymentAccountIdentifier(event.target.value)} maxLength={160} required />
            <Input label="تعليمات للطالب (اختياري)" value={paymentInstructions} onChange={(event) => setPaymentInstructions(event.target.value)} maxLength={1000} />
            <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={savingPaymentMethod}><Save className="h-4 w-4" />{savingPaymentMethod ? 'جارٍ الحفظ...' : editingPaymentMethodId ? 'حفظ التعديل' : 'إضافة وسيلة دفع'}</Button>{editingPaymentMethodId && <Button type="button" variant="ghost" onClick={() => { setEditingPaymentMethodId(null); setPaymentAccountHolder(''); setPaymentAccountIdentifier(''); setPaymentInstructions('') }}>إلغاء التعديل</Button>}</div>
          </form>
        </section>}

        {!loading && <section className={`${panelClass} space-y-5`}><div><h2 className="text-base font-semibold">المجموعات المرتبطة بموادك</h2><p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">لكل مادة ومرحلة وصف مجموعة مستقلة بمواعيدها الأسبوعية.</p></div><TeacherGroupsPage embedded /></section>}
      </div>
    </main>
  )
}

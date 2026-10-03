import React, { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Plus, Save } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { subscriptionService } from '@/features/teacher-subscriptions/subscriptionService'
import { PAYMENT_PROVIDERS, getPaymentProviderLabel, type PlatformPaymentMethod, type PaymentProvider } from '@/features/teacher-subscriptions/types'

const blankMethod = { id: null as string | null, provider: 'INSTAPAY' as PaymentProvider, accountHolder: '', accountIdentifier: '', instructions: '', active: true }

export const PaymentMethodSettingsPage: React.FC = () => {
  const [methods, setMethods] = useState<PlatformPaymentMethod[]>([])
  const [form, setForm] = useState(blankMethod)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setMethods(await subscriptionService.getAdminPaymentMethods()) }
    catch (loadError) {
      console.error('Could not load payment methods:', loadError)
      setError('تعذّر تحميل وسائل الدفع. تأكد من الدخول بحساب أدمن.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload() }, 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  const edit = (method: PlatformPaymentMethod) => setForm({
    id: method.id,
    provider: method.provider,
    accountHolder: method.account_holder,
    accountIdentifier: method.account_identifier,
    instructions: method.instructions ?? '',
    active: method.is_active,
  })

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (form.id && !window.confirm(form.active ? 'هل تريد حفظ التغييرات على وسيلة الدفع؟' : 'هل تريد إيقاف وسيلة الدفع هذه؟')) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await subscriptionService.savePaymentMethod({
        id: form.id,
        provider: form.provider,
        accountHolder: form.accountHolder,
        accountIdentifier: form.accountIdentifier,
        instructions: form.instructions,
        active: form.active,
      })
      setForm(blankMethod)
      setMessage('تم حفظ وسيلة الدفع.')
      await reload()
    } catch (saveError) {
      console.error('Could not save payment method:', saveError)
      setError('تعذّر الحفظ. تأكد من البيانات أو أن وسيلة الدفع غير مكررة.')
    } finally { setSaving(false) }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:px-6" dir="rtl">
      <div className="mx-auto max-w-4xl space-y-5">
        <header>
          <Link to="/admin" className="mb-3 inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#3B82F6]"><ArrowRight className="h-4 w-4" />لوحة الإدارة</Link>
          <h1 className="text-2xl font-bold">بيانات التحويل للمنصة</h1>
          <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">أضف الحسابات التي سيحوّل إليها المدرسون. لا تُعرض الوسائل غير المفعّلة.</p>
        </header>
        {error && <div role="alert" className="rounded-lg bg-[#FEF2F2] p-3 text-sm text-[#B91C1C] dark:bg-red-950/40 dark:text-red-300">{error}</div>}
        {message && <div role="status" className="rounded-lg bg-[#F0FDF4] p-3 text-sm text-[#166534] dark:bg-green-950/40 dark:text-green-300">{message}</div>}
        <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">{form.id ? 'تعديل وسيلة الدفع' : 'إضافة وسيلة دفع'}</h2>
            {form.id && <Button variant="ghost" size="sm" onClick={() => setForm(blankMethod)}><Plus className="h-4 w-4" />إضافة جديدة</Button>}
          </div>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Select label="وسيلة الدفع" value={form.provider} options={PAYMENT_PROVIDERS.map((item) => ({ value: item.value, label: item.label }))} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value as PaymentProvider }))} />
            <Input label="اسم صاحب الحساب" value={form.accountHolder} onChange={(event) => setForm((current) => ({ ...current, accountHolder: event.target.value }))} maxLength={120} required />
            <Input label="رقم الحساب أو معرّفه" value={form.accountIdentifier} onChange={(event) => setForm((current) => ({ ...current, accountIdentifier: event.target.value }))} maxLength={160} required />
            <Input label="تعليمات إضافية (اختياري)" value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} maxLength={1000} />
            <label className="flex h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />إتاحة وسيلة الدفع</label>
            <div><Button type="submit" disabled={saving}><Save className="h-4 w-4" />{saving ? 'جارٍ الحفظ...' : 'حفظ بيانات الدفع'}</Button></div>
          </form>
        </section>
        <section className="space-y-3">
          <h2 className="font-semibold">وسائل الدفع الحالية</h2>
          {loading && <p className="text-sm">جارٍ التحميل...</p>}
          {!loading && !methods.length && <p className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-sm text-[#64748B] dark:border-[#334155] dark:bg-[#1E293B] dark:text-[#94A3B8]">لم تتم إضافة حسابات بعد.</p>}
          {methods.map((method) => (
            <article key={method.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 dark:border-[#334155] dark:bg-[#1E293B]">
              <div>
                <h3 className="font-medium">{getPaymentProviderLabel(method.provider)} · {method.is_active ? 'مفعّلة' : 'متوقفة'}</h3>
                <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">{method.account_holder} · <span dir="ltr" className="inline-block">{method.account_identifier}</span></p>
              </div>
              <Button variant="outline" size="sm" onClick={() => edit(method)}>تعديل</Button>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}

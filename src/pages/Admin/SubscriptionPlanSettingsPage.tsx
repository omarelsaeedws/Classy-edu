import React, { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Save } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { subscriptionService } from '@/features/teacher-subscriptions/subscriptionService'

const SUPPORTED_DURATIONS = [1, 3, 6] as const

export const SubscriptionPlanSettingsPage: React.FC = () => {
  const [prices, setPrices] = useState<Record<number, string>>({})
  const [enabled, setEnabled] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await subscriptionService.getAdminPlans()
      setPrices(Object.fromEntries(SUPPORTED_DURATIONS.map((duration) => [duration, result.find((plan) => plan.duration_months === duration)?.price.toString() ?? ''])))
      setEnabled(Object.fromEntries(SUPPORTED_DURATIONS.map((duration) => [duration, result.find((plan) => plan.duration_months === duration)?.is_active ?? false])))
    } catch (loadError) {
      console.error('Could not load plans:', loadError)
      setError('تعذّر تحميل الخطط. تأكد من الدخول بحساب أدمن.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload() }, 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  const save = async (durationMonths: number) => {
    const price = Number(prices[durationMonths])
    if (!Number.isFinite(price) || price <= 0) {
      setError('أدخل سعراً أكبر من صفر قبل الحفظ.')
      return
    }
    if (!window.confirm(`هل تريد حفظ سعر وحالة خطة ${durationMonths} ${durationMonths === 1 ? 'شهر' : 'أشهر'}؟`)) return
    setSaving(durationMonths)
    setError('')
    setMessage('')
    try {
      await subscriptionService.savePlan(durationMonths, price, enabled[durationMonths] ?? false)
      setMessage(`تم حفظ خطة ${durationMonths} ${durationMonths === 1 ? 'شهر' : 'أشهر'}.`)
      await reload()
    } catch (saveError) {
      console.error('Could not save subscription plan:', saveError)
      setError('تعذّر حفظ الخطة. تحقق من السعر والصلاحيات.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] sm:px-6" dir="rtl">
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <Link to="/admin" className="mb-3 inline-flex items-center gap-2 text-sm text-[#2563EB] dark:text-[#3B82F6]"><ArrowRight className="h-4 w-4" />لوحة الإدارة</Link>
          <h1 className="text-2xl font-bold">أسعار اشتراك المدرسين</h1>
          <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">المدد المتاحة ثابتة: شهر أو 3 أشهر أو 6 أشهر. السعر وحالة إتاحة كل خطة من هنا.</p>
        </header>
        {error && <div role="alert" className="rounded-lg bg-[#FEF2F2] p-3 text-sm text-[#B91C1C] dark:bg-red-950/40 dark:text-red-300">{error}</div>}
        {message && <div role="status" className="rounded-lg bg-[#F0FDF4] p-3 text-sm text-[#166534] dark:bg-green-950/40 dark:text-green-300">{message}</div>}
        {loading ? <p>جارٍ تحميل الخطط...</p> : (
          <div className="space-y-3">
            {SUPPORTED_DURATIONS.map((durationMonths) => (
              <section key={durationMonths} className="rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#334155] dark:bg-[#1E293B]">
                <h2 className="mb-4 font-semibold">خطة {durationMonths} {durationMonths === 1 ? 'شهر' : 'أشهر'}</h2>
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Input label="السعر بالجنيه المصري" type="number" min="0.01" step="0.01" value={prices[durationMonths] ?? ''} onChange={(event) => setPrices((current) => ({ ...current, [durationMonths]: event.target.value }))} placeholder="أدخل السعر" />
                  <label className="flex h-11 items-center gap-2 text-sm"><input type="checkbox" checked={enabled[durationMonths] ?? false} onChange={(event) => setEnabled((current) => ({ ...current, [durationMonths]: event.target.checked }))} />إتاحة الخطة للمدرسين</label>
                </div>
                <Button className="mt-4" size="sm" disabled={saving === durationMonths} onClick={() => void save(durationMonths)}><Save className="h-4 w-4" />حفظ الخطة</Button>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

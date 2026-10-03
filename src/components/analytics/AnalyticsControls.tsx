import { useState } from 'react'
import { getAnalyticsRange, type AnalyticsRange } from '@/features/analytics/analyticsService'

export function AnalyticsControls({ range, onChange, groups, groupId = '', onGroupChange }: {
  range: AnalyticsRange
  onChange: (range: AnalyticsRange) => void
  groups?: Array<{ id: string; name: string }>
  groupId?: string
  onGroupChange?: (groupId: string) => void
}) {
  const [preset, setPreset] = useState('30')
  const [start, setStart] = useState(range.start)
  const [end, setEnd] = useState(range.end)
  const [dateError, setDateError] = useState('')

  const changePreset = (value: string) => {
    setPreset(value)
    setDateError('')
    if (value !== 'custom') onChange(getAnalyticsRange(value))
  }

  const applyCustomRange = (nextStart: string, nextEnd: string) => {
    setStart(nextStart)
    setEnd(nextEnd)
    if (!nextStart || !nextEnd) return
    if (nextStart > nextEnd) {
      setDateError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية.')
      return
    }
    setDateError('')
    onChange({ start: nextStart, end: nextEnd })
  }

  return <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[#E2E8F0] bg-white p-3 dark:border-[#334155] dark:bg-[#1E293B]">
    <label className="min-w-40 text-sm">الفترة الزمنية<select value={preset} onChange={(event) => changePreset(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm dark:border-[#334155] dark:bg-[#0F172A]"><option value="7">آخر 7 أيام</option><option value="30">آخر 30 يومًا</option><option value="90">آخر 3 أشهر</option><option value="year">هذه السنة</option><option value="custom">فترة مخصصة</option></select></label>
    {preset === 'custom' && <>
      <label className="text-sm">من<input type="date" value={start} max={end || undefined} onChange={(event) => applyCustomRange(event.target.value, end)} className="mt-1 h-10 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm dark:border-[#334155] dark:bg-[#0F172A]" /></label>
      <label className="text-sm">إلى<input type="date" value={end} min={start || undefined} onChange={(event) => applyCustomRange(start, event.target.value)} className="mt-1 h-10 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm dark:border-[#334155] dark:bg-[#0F172A]" /></label>
    </>}
    {groups && <label className="min-w-44 text-sm">المجموعة<select value={groupId} onChange={(event) => onGroupChange?.(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm dark:border-[#334155] dark:bg-[#0F172A]"><option value="">كل المجموعات</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
    {dateError && <p role="alert" className="w-full text-sm text-red-700 dark:text-red-300">{dateError}</p>}
  </div>
}

export function AnalyticsBars({ title, rows, emptyText = 'لا توجد بيانات كافية لعرض الإحصائيات.' }: {
  title: string
  rows: Array<{ label: string; value: number }>
  emptyText?: string
}) {
  const max = Math.max(0, ...rows.map((row) => row.value))
  return <section aria-label={title} className="rounded-xl border border-[#E2E8F0] bg-white p-5 text-right dark:border-[#334155] dark:bg-[#1E293B]">
    <h2 className="font-semibold">{title}</h2>
    {rows.length === 0 || max === 0 ? <p className="mt-3 text-sm text-[#64748B] dark:text-[#94A3B8]">{emptyText}</p> : <ul className="mt-4 space-y-3">{rows.map((row) => <li key={row.label}>
      <div className="mb-1 flex justify-between gap-3 text-xs"><span>{row.label}</span><span className="text-[#64748B] dark:text-[#94A3B8]">{row.value}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#334155]" role="img" aria-label={`${row.label}: ${row.value}`}><div className="h-full rounded-full bg-[#2563EB] dark:bg-[#3B82F6]" style={{ width: `${Math.max(2, row.value / max * 100)}%` }} /></div>
    </li>)}</ul>}
  </section>
}

export function RatingDistribution({ distribution }: { distribution: Record<'1' | '2' | '3' | '4' | '5', number> }) {
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0)
  return <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 text-right dark:border-[#334155] dark:bg-[#1E293B]" aria-label="توزيع التقييمات">
    <h2 className="font-semibold">توزيع التقييمات</h2>
    {total === 0 ? <p className="mt-3 text-sm text-[#64748B] dark:text-[#94A3B8]">لا توجد تقييمات حتى الآن.</p> : <ul className="mt-3 space-y-2">{(['5', '4', '3', '2', '1'] as const).map((rating) => <li className="flex items-center justify-between text-sm" key={rating}><span aria-label={`${rating} نجوم`}>{'★'.repeat(Number(rating))}{'☆'.repeat(5 - Number(rating))}</span><span>{distribution[rating]}</span></li>)}</ul>}
  </section>
}

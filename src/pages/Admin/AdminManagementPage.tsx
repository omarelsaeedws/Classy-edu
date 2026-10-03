import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { adminManagementService, type AdminEntity, type AdminListResult } from '@/features/admin/adminManagementService'
import type { Json } from '@/lib/supabase/types'

const config: Record<AdminEntity, { title: string; empty: string; columns: [string, string][]; statuses?: [string,string][]; detail?: string }> = {
  teachers: { title: 'إدارة المدرسين', empty: 'لا يوجد مدرسون', detail: '/admin/teachers', statuses: [['PENDING','بانتظار الاشتراك'],['ACTIVE','نشط'],['REJECTED','مرفوض'],['EXPIRED','منتهي'],['CANCELLED','ملغي']], columns: [['full_name','الاسم'],['phone','الهاتف'],['email','البريد'],['subjects','المادة'],['semester','الفصل الدراسي'],['teacher_status','حالة المدرس'],['platform_status','اشتراك Classy'],['expires_at','انتهاء الاشتراك'],['student_count','الطلاب النشطون'],['group_count','المجموعات'],['average_rating','التقييم'],['created_at','تاريخ التسجيل']] },
  students: { title: 'إدارة الطلاب', empty: 'لا يوجد طلاب', detail: '/admin/students', statuses: [['ACTIVE','اشتراك نشط'],['PENDING_PAYMENT','بانتظار الدفع'],['UNDER_REVIEW','قيد المراجعة'],['REJECTED','مرفوض'],['EXPIRED','منتهي'],['CANCELLED','ملغي']], columns: [['full_name','الاسم'],['phone','الهاتف'],['email','البريد'],['stage','المرحلة'],['grade','الصف'],['active_subscriptions','اشتراكات نشطة'],['subscription_status','آخر حالة اشتراك'],['created_at','تاريخ التسجيل']] },
  teacher_subscriptions: { title: 'اشتراكات المدرسين', empty: 'لا توجد اشتراكات مدرسين', detail: '/admin/teachers', statuses: [['PENDING_PAYMENT','بانتظار الدفع'],['PAYMENT_SUBMITTED','تم إرسال الدفع'],['UNDER_REVIEW','قيد المراجعة'],['APPROVED','مقبول'],['REJECTED','مرفوض'],['EXPIRED','منتهي'],['CANCELLED','ملغي']], columns: [['teacher_name','المدرس'],['email','البريد'],['duration_months','المدة (شهر)'],['amount_due','السعر'],['status','حالة الاشتراك'],['payment_status','حالة الدفع'],['transferred_amount','المبلغ المحول'],['submitted_at','تاريخ الإرسال'],['approved_at','تاريخ القبول'],['expires_at','ينتهي في']] },
  student_subscriptions: { title: 'اشتراكات الطلاب', empty: 'لا توجد اشتراكات طلاب', detail: '/admin/students', statuses: [['PENDING_PAYMENT','بانتظار الدفع'],['UNDER_REVIEW','قيد المراجعة'],['ACTIVE','نشط'],['REJECTED','مرفوض'],['CANCELLED','ملغي'],['EXPIRED','منتهي']], columns: [['student_name','الطالب'],['teacher_name','المدرس'],['group_name','المجموعة'],['subject','المادة'],['monthly_price_snapshot','السعر الشهري'],['status','الحالة'],['payment_status','حالة الدفع'],['created_at','تاريخ الطلب'],['started_at','بدأ في'],['expires_at','ينتهي في']] },
  groups: { title: 'مجموعات المنصة', empty: 'لا توجد مجموعات', statuses: [['ACTIVE','نشطة'],['INACTIVE','متوقفة']], columns: [['teacher_name','المدرس'],['name','المجموعة'],['subject','المادة'],['educational_stage','المرحلة'],['grade','الصف'],['schedule','المواعيد'],['max_students','السعة'],['active_students','طلاب نشطون'],['status','الحالة']] },
  sessions: { title: 'جلسات المنصة', empty: 'لا توجد جلسات', detail: '/admin/sessions', statuses: [['SCHEDULED','مجدولة'],['OPEN','مفتوحة'],['COMPLETED','مكتملة'],['CANCELLED','ملغاة']], columns: [['teacher_name','المدرس'],['group_name','المجموعة'],['subject','المادة'],['session_date','التاريخ'],['start_time','من'],['end_time','إلى'],['status','الحالة'],['attendance_count','سجل حضور']] },
  reviews: { title: 'إدارة التقييمات', empty: 'لا توجد تقييمات', statuses: [['VISIBLE','ظاهرة'],['HIDDEN','مخفية']], columns: [['teacher_name','المدرس'],['student_name','الطالب'],['rating','التقييم'],['comment','التعليق'],['is_visible','حالة العرض'],['created_at','التاريخ']] },
  audit_logs: { title: 'سجل عمليات الإدارة', empty: 'لا توجد سجلات عمليات', columns: [['admin_name','المدير'],['action','الإجراء'],['target_type','نوع العنصر'],['target_id','معرّف العنصر'],['metadata','تفاصيل آمنة'],['created_at','التاريخ']] },
}

const readable = (value: Json | undefined): string => {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'ظاهر' : 'مخفي'
  if (Array.isArray(value)) return value.map((entry) => typeof entry === 'object' && entry !== null ? Object.values(entry).filter((part) => typeof part !== 'object').join(' – ') : String(entry)).join('، ') || '—'
  if (typeof value === 'object') return Object.entries(value).map(([key, entry]) => `${key}: ${String(entry ?? '')}`).join('، ')
  return statusNames[String(value)] ?? String(value)
}
const statusNames: Record<string,string> = { PENDING:'قيد المراجعة', PENDING_PAYMENT:'بانتظار الدفع', PAYMENT_SUBMITTED:'تم إرسال الدفع', UNDER_REVIEW:'قيد المراجعة', APPROVED:'مقبول', ACTIVE:'نشط', REJECTED:'مرفوض', EXPIRED:'منتهي', CANCELLED:'ملغي', INACTIVE:'متوقف', SCHEDULED:'مجدول', OPEN:'مفتوح', COMPLETED:'مكتمل', VISIBLE:'ظاهر', HIDDEN:'مخفي' }

export const AdminManagementPage = ({ entity }: { entity: AdminEntity }) => {
  const meta = config[entity]
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [status, setStatus] = useState(searchParams.get('status') ?? '')
  const [extra, setExtra] = useState('')
  const [stage, setStage] = useState('')
  const [subscriptionStatus, setSubscriptionStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [offset, setOffset] = useState(0)
  const [result, setResult] = useState<AdminListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const limit = 20
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setResult(await adminManagementService.list(entity, { query, status: status || undefined, secondaryStatus: entity === 'teachers' ? subscriptionStatus || undefined : entity === 'teacher_subscriptions' || entity === 'reviews' || entity === 'audit_logs' ? extra || undefined : undefined, stage: entity === 'teachers' || entity === 'students' || entity === 'groups' ? stage || undefined : undefined, subject: entity === 'groups' || entity === 'teachers' ? extra || undefined : undefined, from: from || undefined, to: to || undefined, offset, limit })) }
    catch (e) { console.error('Admin list request failed', e); setError('تعذّر تحميل البيانات. تحقق من تطبيق ترحيل Phase 10 وصلاحية حساب الإدارة.') }
    finally { setLoading(false) }
  }, [entity, query, status, extra, stage, subscriptionStatus, from, to, offset])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  const submit = (event: React.FormEvent) => { event.preventDefault(); setOffset(0); setSearchParams(query ? { q: query } : {}) }
  const toggleReview = async (row: Record<string, Json>) => {
    const id = row.id
    if (typeof id !== 'string') return
    const visible = row.is_visible !== true
    if (!window.confirm(visible ? 'هل تريد إعادة إظهار هذا التقييم؟' : 'هل تريد إخفاء هذا التقييم عن الطلاب؟')) return
    try { await adminManagementService.setReviewVisibility(id, visible); setSuccess(visible ? 'تم إظهار التقييم.' : 'تم إخفاء التقييم.'); await load() }
    catch (e) { console.error('Review moderation failed', e); setError('تعذّر تحديث حالة التقييم.') }
  }
  return <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">{meta.title}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">استعرض البيانات مع صلاحيات الإدارة وترقيم الصفحات.</p></div>{entity==='teacher_subscriptions'&&<Link to="/admin/subscriptions" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">مراجعة إيصالات الدفع</Link>}</header>
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2 lg:grid-cols-6">
      <label className="relative lg:col-span-2"><span className="sr-only">بحث</span><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="بحث بالاسم أو الهاتف" className="w-full rounded-md border border-slate-300 bg-transparent py-2 pe-9 ps-3 dark:border-slate-600"/></label>
      {meta.statuses && <label><span className="sr-only">الحالة</span><select value={status} onChange={(e)=>{setStatus(e.target.value);setOffset(0)}} className="w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600"><option value="">كل الحالات</option>{meta.statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
      {entity==='teachers' && <label><span className="sr-only">حالة اشتراك Classy</span><select value={subscriptionStatus} onChange={(e)=>setSubscriptionStatus(e.target.value)} className="w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600"><option value="">كل اشتراكات Classy</option>{[['PENDING_PAYMENT','بانتظار الدفع'],['PAYMENT_SUBMITTED','تم إرسال الدفع'],['UNDER_REVIEW','قيد المراجعة'],['APPROVED','مقبول'],['REJECTED','مرفوض'],['EXPIRED','منتهي'],['CANCELLED','ملغي']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
      {entity==='teachers' && <><label><span className="sr-only">المرحلة التعليمية</span><input value={stage} onChange={(e)=>setStage(e.target.value)} placeholder="المرحلة التعليمية" className="w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600"/></label><label><span className="sr-only">المادة</span><input value={extra} onChange={(e)=>setExtra(e.target.value)} placeholder="المادة" className="w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600"/></label></>}
      {entity==='students' && <label><span className="sr-only">المرحلة التعليمية</span><input value={stage} onChange={(e)=>setStage(e.target.value)} placeholder="المرحلة التعليمية" className="w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600"/></label>}
      {entity==='groups' && <label><span className="sr-only">المرحلة التعليمية</span><input value={stage} onChange={(e)=>setStage(e.target.value)} placeholder="المرحلة التعليمية" className="w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600"/></label>}
      {entity==='groups' && <label><span className="sr-only">المادة</span><input value={extra} onChange={(e)=>setExtra(e.target.value)} placeholder="المادة" className="w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600"/></label>}
      {entity==='teacher_subscriptions' && <label><span className="sr-only">حالة الدفع</span><select value={extra} onChange={(e)=>setExtra(e.target.value)} className="w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600"><option value="">كل حالات الدفع</option><option value="PAYMENT_SUBMITTED">مرسل</option><option value="UNDER_REVIEW">قيد المراجعة</option><option value="APPROVED">مقبول</option><option value="REJECTED">مرفوض</option></select></label>}
      {entity==='reviews' && <label><span className="sr-only">التقييم</span><select value={extra} onChange={(e)=>setExtra(e.target.value)} className="w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600"><option value="">كل التقييمات</option>{[5,4,3,2,1].map((value)=><option key={value} value={String(value)}>{value} نجوم</option>)}</select></label>}
      {entity==='audit_logs' && <><label><span className="sr-only">الإجراء</span><input value={status} onChange={(e)=>setStatus(e.target.value)} placeholder="تصفية باسم الإجراء" className="w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600"/></label><label><span className="sr-only">نوع العنصر</span><input value={extra} onChange={(e)=>setExtra(e.target.value)} placeholder="نوع العنصر" className="w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600"/></label></>}
      {(entity==='teacher_subscriptions'||entity==='student_subscriptions'||entity==='reviews'||entity==='audit_logs'||entity==='sessions') && <><label><span className="sr-only">من تاريخ</span><input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600"/></label><label><span className="sr-only">إلى تاريخ</span><input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600"/></label></>}
      <Button type="submit" variant="outline">تطبيق البحث</Button>
    </form>
    {success && <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">{success}</p>}
    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      {loading ? <p role="status" className="p-8 text-center text-slate-500">جارٍ تحميل البيانات...</p> : result?.rows.length ? <div className="overflow-x-auto"><table className="min-w-full text-right text-sm"><thead className="bg-slate-50 dark:bg-slate-900"><tr>{meta.columns.map(([,label])=><th key={label} className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>)}{(meta.detail||entity==='reviews')&&<th className="px-4 py-3">إجراء</th>}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{result.rows.map((row,index)=>{const detailKey=entity==='teacher_subscriptions'?'teacher_id':entity==='student_subscriptions'?'student_id':'id';const detailId=row[detailKey];return <tr key={String(row.id??index)} className="align-top">{meta.columns.map(([key])=><td key={key} className="max-w-64 px-4 py-3">{readable(row[key])}</td>)}{(meta.detail||entity==='reviews')&&<td className="whitespace-nowrap px-4 py-3">{meta.detail&&typeof detailId==='string'&&<Link className="text-blue-600 hover:underline" to={`${meta.detail}/${detailId}`}>{entity==='sessions'?'تفاصيل الجلسة':'التفاصيل'}</Link>}{entity==='reviews'&&<Button variant="outline" size="sm" className="mr-2" onClick={()=>void toggleReview(row)}>{row.is_visible===true?<><EyeOff className="h-4 w-4"/>إخفاء</>:<><Eye className="h-4 w-4"/>إظهار</>}</Button>}</td>}</tr>})}</tbody></table></div>:<div className="p-10 text-center"><p className="font-medium">{meta.empty}</p><p className="mt-1 text-sm text-slate-500">لا توجد نتائج مطابقة للفلاتر الحالية.</p></div>}
      <footer className="flex items-center justify-between border-t border-slate-200 p-3 text-sm dark:border-slate-700"><span>{result?`النتائج ${result.total?offset+1:0}–${Math.min(offset+limit,result.total)} من ${result.total}`:' '}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={offset===0||loading} onClick={()=>setOffset(Math.max(0,offset-limit))}>السابق</Button><Button variant="outline" size="sm" disabled={!result||offset+limit>=result.total||loading} onClick={()=>setOffset(offset+limit)}>التالي</Button></div></footer>
    </section>
  </main>
}

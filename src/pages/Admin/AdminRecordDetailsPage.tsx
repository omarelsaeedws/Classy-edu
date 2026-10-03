import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { adminManagementService } from '@/features/admin/adminManagementService'
import type { Json } from '@/lib/supabase/types'

const labels: Record<string,string> = {
  profile:'الملف الشخصي',email:'البريد الإلكتروني',teacher_profile:'بيانات المدرس',groups:'المجموعات',subscriptions:'الاشتراكات',student_subscriptions:'اشتراكات الطلاب',sessions:'الجلسات',reviews:'التقييمات',attendance:'سجل الحضور',
  full_name:'الاسم',phone:'الهاتف',role:'نوع الحساب',teacher_status:'حالة المدرس',stage:'المرحلة',grade:'الصف',avatar_url:'الصورة',subject:'المادة',subjects:'المواد',semester:'الفصل الدراسي',teaching_address:'عنوان التدريس',teaching_area:'المنطقة',bio:'نبذة',lesson_title:'عنوان الدرس',monthly_price:'السعر الشهري',name:'المجموعة',educational_stage:'المرحلة التعليمية',max_students:'السعة',status:'الحالة',schedule:'المواعيد',active_students:'الطلاب النشطون',group_name:'المجموعة',student_name:'الطالب',teacher_name:'المدرس',duration_months:'المدة بالشهور',amount_due:'المبلغ المطلوب',expires_at:'تاريخ الانتهاء',started_at:'تاريخ البداية',created_at:'تاريخ الإنشاء',session_date:'تاريخ الحصة',start_time:'وقت البداية',end_time:'وقت النهاية',attendance_count:'عدد الحضور',rating:'التقييم',comment:'التعليق',is_visible:'ظاهر للطلاب',attended_at:'وقت التسجيل',price:'السعر',payment:'الدفع',payments:'المدفوعات',payment_method:'وسيلة الدفع',transferred_amount:'المبلغ المحول',provider:'المزود',receipt_path:'إيصال الدفع',receipt_bucket:'',submitted_at:'تاريخ الإرسال',reviewed_at:'تاريخ المراجعة',rejection_reason:'سبب الرفض',payment_status:'حالة الدفع',monthly_price_snapshot:'السعر الشهري',
}
const simple = (value: Json): string => {
  if (value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا'
  if (Array.isArray(value)) return value.map((part)=> typeof part==='object'&&part!==null?Object.values(part).filter((item)=>typeof item!=='object').join(' – '):String(part)).join('، ')||'—'
  if (typeof value === 'object') return '—'
  return String(value)
}

const ReceiptLink = ({ path, bucket }: { path: string; bucket: string }) => {
  const [url,setUrl]=useState('')
  useEffect(()=>{let alive=true; void supabase.storage.from(bucket).createSignedUrl(path,60).then(({data,error})=>{if(alive&&!error)setUrl(data.signedUrl)});return()=>{alive=false}},[path,bucket])
  return url ? <a className="text-blue-600 underline" href={url} target="_blank" rel="noreferrer">عرض الإيصال</a> : <span className="text-slate-500">جارٍ تجهيز رابط خاص...</span>
}

const AvatarPreview = ({ path }: { path: string }) => {
  const [url,setUrl]=useState(path.startsWith('http')?path:'')
  useEffect(()=>{if(path.startsWith('http'))return;let alive=true;void supabase.storage.from('teacher-avatars').createSignedUrl(path,300).then(({data,error})=>{if(alive&&!error)setUrl(data.signedUrl)});return()=>{alive=false}},[path])
  return url ? <img src={url} alt="صورة الملف الشخصي" className="h-24 w-24 rounded-full object-cover"/> : <span className="text-slate-500">تعذّر تحميل الصورة</span>
}

const DetailValue = ({ name, value, receiptBucket }: { name: string; value: Json; receiptBucket?: string }) => {
  if (value === null || typeof value !== 'object') {
    if (name==='avatar_url' && typeof value==='string') return <AvatarPreview path={value}/>
    if (name==='receipt_path' && typeof value==='string') {
      return <ReceiptLink path={value} bucket={receiptBucket ?? 'teacher-payment-receipts'}/>
    }
    return <span>{simple(value)}</span>
  }
  if (Array.isArray(value)) return value.length ? <div className="grid gap-3 sm:grid-cols-2">{value.map((item,index)=><article key={index} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><DetailValue name={name} value={item}/></article>)}</div> : <span className="text-slate-500">لا توجد بيانات</span>
  const bucket=value.receipt_bucket
  return <dl className="grid gap-3 sm:grid-cols-2">{Object.entries(value).filter(([key])=>key!=='receipt_bucket').map(([key,child])=><div key={key} className="min-w-0"><dt className="text-xs text-slate-500 dark:text-slate-400">{labels[key]??key}</dt><dd className="mt-1 break-words text-sm">{child===undefined?'—':<DetailValue name={key} value={child} receiptBucket={typeof bucket==='string'?bucket:undefined}/>}</dd></div>)}</dl>
}

export const AdminRecordDetailsPage = ({ entity }: { entity: 'teacher'|'student'|'session' }) => {
  const { id='' }=useParams()
  const [data,setData]=useState<Json|null>(null)
  const [error,setError]=useState(false)
  useEffect(()=>{let active=true;void adminManagementService.details(entity,id).then((value)=>{if(active)setData(value)}).catch((cause:unknown)=>{console.error('Admin detail load failed',cause);if(active)setError(true)});return()=>{active=false}},[entity,id])
  const title=entity==='teacher'?'تفاصيل المدرس':entity==='student'?'تفاصيل الطالب':'تفاصيل الجلسة'
  return <main dir="rtl" className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6"><Link to={entity==='teacher'?'/admin/teachers':entity==='student'?'/admin/students':'/admin/sessions'} className="text-sm text-blue-600">→ العودة للقائمة</Link><h1 className="text-2xl font-bold">{title}</h1>
    {!data&&!error&&<p role="status" className="rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">جارٍ تحميل التفاصيل...</p>}
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-950/30 dark:text-red-300">تعذّر تحميل التفاصيل. تحقق من ترحيل Phase 10 وصلاحية حساب الإدارة.</p>}
    {data&&typeof data==='object'&&!Array.isArray(data)&&Object.entries(data).map(([key,value])=><section key={key} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><h2 className="font-semibold">{labels[key]??key}</h2>{value===undefined?<p>—</p>:<DetailValue name={key} value={value}/>}</section>)}
  </main>
}

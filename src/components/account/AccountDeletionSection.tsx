import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, LoaderCircle, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase/client'

export function AccountDeletionSection() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const close = () => {
    if (isDeleting) return
    setIsOpen(false)
    setConfirmation('')
    setErrorMessage(null)
  }

  const deleteAccount = async () => {
    if (confirmation.trim() !== 'حذف حسابي') return
    setIsDeleting(true)
    setErrorMessage(null)
    try {
      const { data, error } = await supabase.functions.invoke<{ success?: boolean; error?: string }>('delete-account')
      if (error) {
        let message = data?.error
        const context = 'context' in error ? error.context : null
        if (!message && context instanceof Response) {
          const responseBody = await context.clone().json().catch(() => null) as { error?: string } | null
          message = responseBody?.error
        }
        if (!message && error.message.includes('Failed to send a request to the Edge Function')) {
          message = 'تعذّر الاتصال بخدمة حذف الحساب. تأكد من نشر وظيفة delete-account على Supabase ثم أعد المحاولة.'
        }
        throw new Error(message || error.message)
      }
      if (!data?.success) throw new Error(data?.error || 'تعذّر إكمال حذف الحساب.')
      await supabase.auth.signOut({ scope: 'local' })
      navigate('/', { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'تعذّر حذف الحساب. حاول مرة أخرى.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <section className="rounded-xl border border-red-200 bg-white p-5 text-right dark:border-red-900/70 dark:bg-[#1E293B]" aria-labelledby="delete-account-heading">
        <h2 id="delete-account-heading" className="font-semibold text-red-700 dark:text-red-300">حذف الحساب نهائيًا</h2>
        <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3B8]">سيؤدي ذلك إلى حذف حسابك وكل بياناتك وسجلاتك المرتبطة به، ولا يمكن التراجع عن هذا الإجراء.</p>
        <Button type="button" variant="outline" className="mt-4 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40" onClick={() => setIsOpen(true)}>
          <Trash2 className="h-4 w-4" /> حذف الحساب
        </Button>
      </section>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-account-dialog-title" className="w-full max-w-md space-y-4 rounded-xl border border-[#E2E8F0] bg-white p-6 text-right shadow-xl dark:border-[#334155] dark:bg-[#1E293B]">
            <div className="flex items-start justify-between gap-4">
              <button type="button" aria-label="إغلاق" onClick={close} disabled={isDeleting} className="rounded-md p-1 text-[#64748B] hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
              <div>
                <h2 id="delete-account-dialog-title" className="text-lg font-bold text-red-700 dark:text-red-300">تأكيد حذف الحساب</h2>
                <p className="mt-2 flex items-start gap-2 text-sm text-[#475569] dark:text-[#CBD5E1]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />سيتم حذف الملف الشخصي والاشتراكات والمدفوعات والحضور والتقييمات والملفات المرتبطة بالحساب.</p>
              </div>
            </div>
            <label htmlFor="delete-account-confirmation" className="block text-sm font-medium">اكتب <span className="font-bold text-red-700 dark:text-red-300">حذف حسابي</span> للتأكيد</label>
            <input id="delete-account-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" dir="rtl" className="h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:border-[#475569] dark:bg-[#0F172A] dark:focus:ring-red-900" />
            {errorMessage && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{errorMessage}</p>}
            <div className="flex justify-start gap-2">
              <Button type="button" variant="outline" onClick={close} disabled={isDeleting}>إلغاء</Button>
              <Button type="button" onClick={() => void deleteAccount()} disabled={isDeleting || confirmation.trim() !== 'حذف حسابي'} className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {isDeleting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> جارٍ الحذف...</> : 'حذف نهائي'}
              </Button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

import { Link } from 'react-router-dom'
import { CreditCard, Wallet } from 'lucide-react'

export const AdminSettingsPage = () => <main dir="rtl" className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
  <header><h1 className="text-2xl font-bold">إعدادات المنصة</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">إدارة خطط اشتراك المدرسين ووسائل التحويل للمنصة.</p></header>
  <section className="grid gap-4 sm:grid-cols-2">
    <Link to="/admin/settings/plans" className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800"><CreditCard className="mt-1 h-5 w-5 text-blue-600"/><div><h2 className="font-semibold">خطط اشتراك المدرسين</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">تعديل أسعار خطط شهر و3 أشهر و6 أشهر من قاعدة البيانات.</p></div></Link>
    <Link to="/admin/settings/payment-methods" className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800"><Wallet className="mt-1 h-5 w-5 text-blue-600"/><div><h2 className="font-semibold">وسائل دفع المنصة</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">إدارة حسابات استقبال مدفوعات المدرسين وإتاحتها.</p></div></Link>
  </section>
</main>

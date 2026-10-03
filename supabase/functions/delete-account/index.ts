import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2'

const allowedOrigins = new Set((Deno.env.get('APP_ALLOWED_ORIGINS') || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean))

const isAllowedOrigin = (request: Request) => {
  const origin = request.headers.get('Origin')
  return origin === null || allowedOrigins.has(origin)
}

const getCorsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get('Origin')
  return {
    ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

const json = (body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headers, 'Content-Type': 'application/json' },
})

async function collectFiles(
  client: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const files: string[] = []
  let offset = 0
  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error) throw error
    const entries = data ?? []
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`
      if (entry.id === null) files.push(...await collectFiles(client, bucket, path))
      else files.push(path)
    }
    if (entries.length < 1000) break
    offset += entries.length
  }
  return files
}

Deno.serve(async (request) => {
  const corsHeaders = getCorsHeaders(request)
  if (!isAllowedOrigin(request)) return json({ error: 'المصدر غير مسموح.' }, 403, corsHeaders)
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'الطريقة غير مدعومة.' }, 405, corsHeaders)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'يجب تسجيل الدخول أولاً.' }, 401, corsHeaders)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Account deletion is missing server-side Supabase configuration.')
    return json({ error: 'خدمة حذف الحساب غير مهيأة حالياً.' }, 500, corsHeaders)
  }

  const token = authorization.slice('Bearer '.length)
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser(token)
  if (authError || !user) return json({ error: 'تعذّر التحقق من جلسة الدخول.' }, 401, corsHeaders)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  try {
    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('role').eq('id', user.id).maybeSingle()
    if (profileError) throw profileError
    if (!profile || !['STUDENT', 'TEACHER'].includes(profile.role)) {
      return json({ error: 'حذف هذا النوع من الحسابات غير متاح من هنا.' }, 403, corsHeaders)
    }

    for (const bucket of ['teacher-avatars', 'teacher-payment-receipts', 'student-payment-receipts']) {
      const paths = await collectFiles(admin, bucket, user.id)
      for (let index = 0; index < paths.length; index += 100) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(index, index + 100))
        if (error) throw error
      }
    }

    const { error: purgeError } = await admin.rpc('purge_account_related_data', { p_user_id: user.id })
    if (purgeError) throw purgeError

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error('Related account data was purged, but Auth account deletion failed:', deleteError)
      return json({ error: 'تم حذف بيانات الحساب، لكن تعذّر حذف تسجيل الدخول. تواصل مع الدعم لإكمال الحذف.' }, 500, corsHeaders)
    }

    return json({ success: true }, 200, corsHeaders)
  } catch (error) {
    console.error('Account deletion failed:', error)
    return json({ error: 'تعذّر حذف الحساب وبياناته المرتبطة. حاول مرة أخرى.' }, 500, corsHeaders)
  }
})

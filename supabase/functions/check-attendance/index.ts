import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

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

const jsonResponse = (body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) => new Response(
  JSON.stringify(body),
  { status, headers: { ...headers, 'Content-Type': 'application/json' } },
)

Deno.serve(async (request: Request) => {
  const corsHeaders = getCorsHeaders(request)
  if (!isAllowedOrigin(request)) return jsonResponse({ ok: false, code: 'ORIGIN_NOT_ALLOWED' }, 403, corsHeaders)
  if (request.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, code: 'INVALID_REQUEST' }, 405, corsHeaders)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ ok: false, code: 'UNAUTHORIZED' }, 401, corsHeaders)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Attendance function is missing server-side Supabase environment configuration.')
    return jsonResponse({ ok: false, code: 'SERVER_ERROR' }, 500, corsHeaders)
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return jsonResponse({ ok: false, code: 'UNAUTHORIZED' }, 401, corsHeaders)

  let body: unknown
  try { body = await request.json() }
  catch { return jsonResponse({ ok: false, code: 'INVALID_REQUEST' }, 400, corsHeaders) }
  if (!body || typeof body !== 'object') return jsonResponse({ ok: false, code: 'INVALID_REQUEST' }, 400, corsHeaders)

  const payload = body as { session_id?: unknown; attendance_code?: unknown }
  const sessionId = payload.session_id === null || payload.session_id === undefined ? null : payload.session_id
  const attendanceCode = payload.attendance_code
  const isUuid = typeof sessionId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)
  if ((sessionId !== null && !isUuid) || typeof attendanceCode !== 'string' || !/^\d{6}$/.test(attendanceCode)) {
    return jsonResponse({ ok: false, code: 'INVALID_CODE' }, 400, corsHeaders)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: mayAttemptAttendance, error: rateLimitError } = await adminClient.rpc('consume_attendance_code_attempt', {
    p_student_id: user.id,
  })
  if (rateLimitError) {
    console.error('The attendance rate-limit operation failed:', rateLimitError.message)
    return jsonResponse({ ok: false, code: 'SERVER_ERROR' }, 500, corsHeaders)
  }
  if (mayAttemptAttendance !== true) {
    return jsonResponse({ ok: false, code: 'RATE_LIMITED' }, 429, { ...corsHeaders, 'Retry-After': '300' })
  }

  const { data, error } = await adminClient.rpc('record_student_attendance', {
    p_student_id: user.id,
    p_session_id: sessionId,
    p_attendance_code: attendanceCode,
  })
  if (error) {
    console.error('The attendance database operation failed:', error.message)
    return jsonResponse({ ok: false, code: 'SERVER_ERROR' }, 500, corsHeaders)
  }
  if (!data || typeof data !== 'object' || !('code' in data) || typeof data.code !== 'string') {
    return jsonResponse({ ok: false, code: 'SERVER_ERROR' }, 500, corsHeaders)
  }
  return jsonResponse({ ok: data.ok === true, code: data.code }, 200, corsHeaders)
})

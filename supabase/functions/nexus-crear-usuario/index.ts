import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigins = new Set([
  'https://auditoriasg.github.io',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
])

function headers(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'https://auditoriasg.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  }
}

function reply(origin: string | null, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) })
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')
  if (request.method === 'OPTIONS') return new Response('ok', { headers: headers(origin) })
  if (request.method !== 'POST') return reply(origin, { error: 'Método no permitido' }, 405)
  if (origin && !allowedOrigins.has(origin)) return reply(origin, { error: 'Origen no permitido' }, 403)

  try {
    const authorization = request.headers.get('authorization') || ''
    const token = authorization.replace(/^Bearer\s+/i, '')
    if (!token) return reply(origin, { error: 'Sesión no válida' }, 401)

    const input = await request.json()
    const email = String(input.email || '').trim().toLowerCase()
    const password = String(input.password || '')
    const pin = String(input.pin || '')
    const employeeId = input.empleadoId || null
    const profileId = input.perfilId || null
    const scope = String(input.alcanceTipo || 'GLOBAL')
    if (!/^\S+@\S+\.\S+$/.test(email)) return reply(origin, { error: 'Ingresa un correo válido' }, 400)
    if (password.length < 8) return reply(origin, { error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
    if (!/^\d{4}$/.test(pin)) return reply(origin, { error: 'El PIN debe contener 4 números' }, 400)
    if (!profileId) return reply(origin, { error: 'Selecciona un nivel de seguridad' }, 400)

    const url = Deno.env.get('SUPABASE_URL') || ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!url || !serviceKey) return reply(origin, { error: 'Configuración de acceso no disponible' }, 500)
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: callerData, error: callerError } = await admin.auth.getUser(token)
    if (callerError || !callerData.user) return reply(origin, { error: 'Tu sesión expiró. Inicia sesión de nuevo.' }, 401)

    const { data: createdData, error: createdError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createdError || !createdData.user) {
      const message = /already|exists|registered/i.test(createdError?.message || '')
        ? 'Ya existe una cuenta con este correo. Usa otro correo o restablece su contraseña.'
        : 'No se pudo crear la cuenta. Revisa el correo y los requisitos de contraseña.'
      return reply(origin, { error: message }, 400)
    }

    const { data: assignmentId, error: assignmentError } = await admin.rpc('nexus_crear_usuario_desde_panel', {
      p_administrador_id: callerData.user.id,
      p_auth_usuario_id: createdData.user.id,
      p_empleado_id: employeeId,
      p_perfil_id: profileId,
      p_alcance_tipo: scope,
      p_pin: pin,
    })
    if (assignmentError) {
      await admin.auth.admin.deleteUser(createdData.user.id)
      return reply(origin, { error: 'No tienes permiso para crear usuarios o los datos no son válidos.' }, 403)
    }

    return reply(origin, { assignmentId, userId: createdData.user.id }, 201)
  } catch (_) {
    return reply(origin, { error: 'No se pudo completar el alta del usuario' }, 500)
  }
})

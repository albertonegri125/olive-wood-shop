// supabase/functions/manage-admin/index.ts
//
// Edge Function chiamata dal frontend (AdminUsers.jsx, sezione "Gestione
// Admin" del pannello /admin/utenti) per promuovere o rimuovere altri
// amministratori, senza dover eseguire SQL manuale nel SQL Editor di
// Supabase.
//
// PERCHÉ UNA EDGE FUNCTION E NON UNA QUERY DIRETTA DAL CLIENT: la colonna
// "is_admin" di "profiles" è protetta da un trigger e da una REVOKE che
// bloccano SEMPRE la sua scrittura da parte di un utente autenticato
// "normale" (vedi schema_security_fix_A.sql) — anche se quell'utente è già
// admin lui stesso. È una scelta voluta, non un limite tecnico da aggirare:
// l'unico canale legittimo per cambiare is_admin resta una scrittura fatta
// con la Service Role Key, che bypassa RLS/trigger/REVOKE (esattamente come
// fa già stripe-webhook per scrivere ordini). Questa funzione è quel
// canale, con in più il controllo — fatto qui, lato server — che chi
// chiama sia già admin: non ci fidiamo di un flag "isAdmin" letto dal
// frontend, falsificabile da chiunque apra la console del browser.
//
// Un'unica function con un parametro "action" gestisce sia le letture
// (elenco admin attuali, ricerca utenti per email) sia le scritture
// (promuovi/rimuovi): così ogni accesso ai profili di ALTRI utenti passa da
// qui, mai da una query diretta del client su "profiles" — che le policy
// RLS attuali (auth.uid() = id) comunque impedirebbero, essendo ogni
// utente limitato a leggere/scrivere solo la propria riga.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type AdminClient = ReturnType<typeof createClient>

// Sottoinsieme di "auth.users" che ci serve qui: solo per loggare/tracciare
// chi ha fatto cosa, mai per decisioni di autorizzazione (quelle si basano
// sempre su "profiles.is_admin", riletto dal database, non su questo).
type Caller = { id: string; email: string | null }

Deno.serve(async (req: Request) => {
  // Richiesta "preflight" del browser prima della vera POST.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    // SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY sono già
    // disponibili automaticamente in ogni Edge Function di Supabase: non
    // vanno impostate a mano come secret (vedi create-checkout-session).

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('[manage-admin] Variabili d\'ambiente Supabase mancanti.')
      return jsonResponse({ error: 'Configurazione mancante lato server.' }, 500)
    }

    // --- 1. Verifica di chi ha fatto la richiesta ---------------------------
    // Client "per conto dell'utente", costruito con il suo token JWT
    // (inviato automaticamente da supabase.functions.invoke() nel
    // frontend): getUser() lo verifica presso Supabase Auth e restituisce
    // l'utente SOLO se il token è valido.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Devi effettuare l\'accesso.' }, 401)
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
      error: callerAuthError,
    } = await userClient.auth.getUser()

    if (callerAuthError || !caller) {
      return jsonResponse({ error: 'Sessione non valida: effettua di nuovo l\'accesso.' }, 401)
    }

    // Client con la Service Role Key: bypassa la Row Level Security. Ci
    // serve per due motivi indipendenti: leggere/scrivere i profili di
    // ALTRI utenti (la RLS attuale lascia leggere/scrivere solo la propria
    // riga) ed essere l'unico ruolo per cui trigger + REVOKE su "is_admin"
    // permettono la scrittura (vedi schema_security_fix_A.sql).
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

    // --- 2. Verifica che chi chiama sia GIÀ admin, lato server -------------
    // Rilettura diretta della riga vera in "profiles": non ci fidiamo di
    // nessun valore mandato dal frontend nel corpo della richiesta.
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('id, is_admin')
      .eq('id', caller.id)
      .maybeSingle()

    if (callerProfileError) {
      console.error('[manage-admin] Errore nel leggere il profilo del chiamante:', callerProfileError)
      return jsonResponse({ error: 'Errore nella verifica dei permessi.' }, 500)
    }

    if (!callerProfile || callerProfile.is_admin !== true) {
      console.warn(
        `[manage-admin] Richiesta RIFIUTATA: l'utente ${caller.id} (${caller.email ?? 'email sconosciuta'}) non è amministratore.`
      )
      return jsonResponse({ error: 'Non hai i permessi per gestire gli amministratori.' }, 403)
    }

    // --- 3. Corpo della richiesta: quale azione eseguire --------------------
    const body = await req.json().catch(() => null)
    const action = body?.action
    const callerInfo: Caller = { id: caller.id, email: caller.email ?? null }

    switch (action) {
      case 'list':
        return await handleList(adminClient)
      case 'search':
        return await handleSearch(adminClient, body?.email)
      case 'promote':
        return await handlePromote(adminClient, callerInfo, body?.user_id)
      case 'revoke':
        return await handleRevoke(adminClient, callerInfo, body?.user_id)
      default:
        return jsonResponse({ error: 'Azione non riconosciuta.' }, 400)
    }
  } catch (error) {
    // Rete di sicurezza finale: qualunque eccezione non prevista sopra
    // viene comunque loggata in modo esplicito invece di risultare in un
    // 500 "muto" senza traccia nei log.
    console.error('[manage-admin] ERRORE NON GESTITO:', error)
    return jsonResponse({ error: 'Errore interno.' }, 500)
  }
})

// --- Azioni -----------------------------------------------------------------

// Elenca tutti gli utenti attualmente admin, con l'email di chi li ha
// promossi (se nota) risolta lato server per evitare N chiamate separate
// dal client.
async function handleList(adminClient: AdminClient) {
  const { data, error } = await adminClient
    .from('profiles')
    .select('id, email, full_name, promoted_by, promoted_at')
    .eq('is_admin', true)
    .order('promoted_at', { ascending: true, nullsFirst: true })

  if (error) {
    console.error('[manage-admin] Errore nel leggere la lista admin:', error)
    return jsonResponse({ error: 'Errore nel caricamento degli amministratori.' }, 500)
  }

  const admins = data ?? []

  const promoterIds = [...new Set(admins.map((admin) => admin.promoted_by).filter(Boolean))]
  let promoterEmailById: Record<string, string | null> = {}

  if (promoterIds.length > 0) {
    const { data: promoters, error: promotersError } = await adminClient
      .from('profiles')
      .select('id, email')
      .in('id', promoterIds)

    if (promotersError) {
      // Non blocchiamo la lista per questo: mostriamo comunque gli admin,
      // semplicemente senza il nome di chi li ha promossi.
      console.error('[manage-admin] Errore nel risolvere gli email di chi ha promosso:', promotersError)
    } else {
      promoterEmailById = Object.fromEntries((promoters ?? []).map((p) => [p.id, p.email]))
    }
  }

  const enriched = admins.map((admin) => ({
    ...admin,
    promoted_by_email: admin.promoted_by ? promoterEmailById[admin.promoted_by] ?? null : null,
  }))

  return jsonResponse({ admins: enriched })
}

// Cerca tra gli utenti già registrati per email (match parziale), per poter
// scegliere chi promuovere. Include anche gli utenti già admin (segnalati
// con is_admin: true) così il frontend può mostrarli come tali invece di
// proporre di nuovo "Promuovi".
async function handleSearch(adminClient: AdminClient, rawEmail: unknown) {
  const email = typeof rawEmail === 'string' ? rawEmail.trim() : ''

  if (!email) {
    return jsonResponse({ error: 'Inserisci un\'email da cercare.' }, 400)
  }

  const { data, error } = await adminClient
    .from('profiles')
    .select('id, email, full_name, is_admin')
    .ilike('email', `%${email}%`)
    .order('email')
    .limit(10)

  if (error) {
    console.error('[manage-admin] Errore nella ricerca utenti:', error)
    return jsonResponse({ error: 'Errore nella ricerca.' }, 500)
  }

  return jsonResponse({ results: data ?? [] })
}

// Promuove un utente esistente ad amministratore.
async function handlePromote(adminClient: AdminClient, caller: Caller, rawUserId: unknown) {
  const userId = typeof rawUserId === 'string' ? rawUserId : null
  if (!userId) {
    return jsonResponse({ error: 'Utente da promuovere non valido.' }, 400)
  }

  const { data: target, error: targetError } = await adminClient
    .from('profiles')
    .select('id, email, is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (targetError) {
    console.error('[manage-admin] Errore nel leggere il profilo target (promote):', targetError)
    return jsonResponse({ error: 'Errore nella verifica dell\'utente.' }, 500)
  }

  if (!target) {
    return jsonResponse({ error: 'Utente non trovato.' }, 404)
  }

  if (target.is_admin === true) {
    return jsonResponse({ error: 'Questo utente è già amministratore.' }, 409)
  }

  const { data: updated, error: updateError } = await adminClient
    .from('profiles')
    .update({
      is_admin: true,
      promoted_by: caller.id,
      promoted_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id, email, full_name, promoted_by, promoted_at')
    .single()

  if (updateError) {
    console.error('[manage-admin] Errore nella promozione:', updateError)
    return jsonResponse({ error: 'Errore nella promozione dell\'utente.' }, 500)
  }

  // AUDIT: chi ha promosso chi, e quando (i log delle Edge Function di
  // Supabase conservano la cronologia di queste righe).
  console.log(
    `[manage-admin] AUDIT: ${caller.email ?? caller.id} ha promosso ad admin ${target.email ?? userId} (${userId}).`
  )

  return jsonResponse({ profile: updated })
}

// Rimuove i privilegi admin a un utente, con protezione anti-lockout.
async function handleRevoke(adminClient: AdminClient, caller: Caller, rawUserId: unknown) {
  const userId = typeof rawUserId === 'string' ? rawUserId : null
  if (!userId) {
    return jsonResponse({ error: 'Utente da rimuovere non valido.' }, 400)
  }

  const { data: target, error: targetError } = await adminClient
    .from('profiles')
    .select('id, email, is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (targetError) {
    console.error('[manage-admin] Errore nel leggere il profilo target (revoke):', targetError)
    return jsonResponse({ error: 'Errore nella verifica dell\'utente.' }, 500)
  }

  if (!target) {
    return jsonResponse({ error: 'Utente non trovato.' }, 404)
  }

  if (target.is_admin !== true) {
    return jsonResponse({ error: 'Questo utente non è amministratore.' }, 409)
  }

  // Rete di sicurezza anti-lockout: se questo fosse l'unico admin rimasto,
  // rimuoverlo lascerebbe il pannello /admin (e questa stessa funzione, che
  // richiede un admin per essere invocata) irraggiungibile per chiunque.
  // Blocchiamo la richiesta A PRESCINDERE da chi sia il target: copre sia
  // l'auto-rimozione sia la rimozione dell'ultimo ALTRO admin rimasto.
  const { count, error: countError } = await adminClient
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin', true)

  if (countError) {
    console.error('[manage-admin] Errore nel contare gli admin attuali:', countError)
    return jsonResponse({ error: 'Errore nel controllo di sicurezza.' }, 500)
  }

  if ((count ?? 0) <= 1) {
    console.warn(
      `[manage-admin] Rimozione RIFIUTATA: ${target.email ?? userId} è l'unico admin rimasto (richiesta da ${caller.email ?? caller.id}).`
    )
    return jsonResponse(
      {
        error:
          'Impossibile rimuovere l\'ultimo amministratore rimasto: il pannello admin resterebbe inaccessibile a chiunque.',
      },
      409
    )
  }

  // "promoted_by"/"promoted_at" NON vengono azzerati qui: restano come
  // traccia storica dell'ultima promozione avvenuta (vedi
  // schema_admin_users.sql).
  const { data: updated, error: updateError } = await adminClient
    .from('profiles')
    .update({ is_admin: false })
    .eq('id', userId)
    .select('id, email, full_name')
    .single()

  if (updateError) {
    console.error('[manage-admin] Errore nella rimozione dei privilegi:', updateError)
    return jsonResponse({ error: 'Errore nella rimozione dei privilegi admin.' }, 500)
  }

  // AUDIT: chi ha rimosso chi, e quando.
  console.log(
    `[manage-admin] AUDIT: ${caller.email ?? caller.id} ha rimosso i privilegi admin di ${target.email ?? userId} (${userId}).`
  )

  return jsonResponse({ profile: updated })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAccount } from '@/lib/session'

function value(form: FormData, key: string) { return String(form.get(key) ?? '').trim() }
function positive(value: string, allowZero = false) {
  const n = Number(value)
  return Number.isFinite(n) && (allowZero ? n >= 0 : n > 0) ? n : null
}
function feedback(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message.slice(0, 160))}`)
}
function guardRole(actual: string, expected: string): void {
  if (actual !== expected) feedback('/dashboard', 'Your account cannot perform this action')
}

export async function signIn(form: FormData) {
  const email = value(form, 'email')
  const password = value(form, 'password')
  if (!email || !password) feedback('/login', 'Email and password are required')
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) feedback('/login', 'Invalid credentials or account not confirmed')
  redirect('/dashboard')
}

export async function signUp(form: FormData) {
  const email = value(form, 'email'), password = value(form, 'password')
  const fullName = value(form, 'full_name').slice(0, 100)
  const role = value(form, 'role')
  if (!['customer','planner','vendor'].includes(role)) feedback('/login', 'Choose a valid account type')
  if (!email.includes('@') || password.length < 8 || fullName.length < 2) {
    feedback('/login', 'Provide your name, email and a password of at least 8 characters')
  }
  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const { error, data } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, role }, emailRedirectTo: `${siteUrl}/auth/confirm` },
  })
  if (error) feedback('/login', error.message)
  if (data.session) redirect('/dashboard')
  redirect('/login?notice=Check%20your%20email%20for%20an%20account%20confirmation%20link')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function createEvent(form: FormData) {
  const { supabase, userId, profile } = await requireAccount()
  guardRole(profile.role, 'customer')
  const title = value(form, 'title'), kind = value(form, 'kind'), eventDate = value(form, 'event_date')
  const city = value(form, 'city'), guests = positive(value(form,'guests'))
  const budget = positive(value(form, 'budget'), true)
  const services = value(form,'services'), notes = value(form,'notes')
  if (title.length < 3 || !kind || city.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) ||
      !guests || budget === null || services.length > 400 || notes.length > 2000) {
    feedback('/dashboard', 'Please complete the required event information')
  }
  if (eventDate < new Date().toISOString().slice(0,10)) feedback('/dashboard', 'Choose a future event date')
  const { data, error } = await supabase.from('events').insert({
    customer_id: userId, title, kind, event_date: eventDate, city,
    guests, budget, services, notes,
  }).select('id').single()
  if (error || !data) feedback('/dashboard', error?.message || 'Could not create event')
  revalidatePath('/dashboard')
  redirect(`/dashboard/events/${data.id}`)
}

export async function applyAsVendor(form: FormData) {
  const { supabase, userId, profile } = await requireAccount()
  guardRole(profile.role, 'vendor')
  const name = value(form,'name'), category = value(form,'category'), city = value(form,'city')
  const description = value(form,'description'), price = positive(value(form,'starting_price'),true)
  if (name.length < 2 || !category || city.length < 2 || description.length > 1000 || price===null) {
    feedback('/dashboard', 'Provide the business details and a valid starting price')
  }
  const { error } = await supabase.from('businesses').insert({
    owner_id: userId, name, category, city, description, starting_price: price,
  })
  if (error) feedback('/dashboard', error.message)
  revalidatePath('/dashboard')
  redirect('/dashboard?notice=Business%20submitted%20for%20review')
}

export async function assignPlanner(form: FormData) {
  const { supabase, profile } = await requireAccount()
  guardRole(profile.role, 'admin')
  const id = value(form,'event_id'), plannerId = value(form,'planner_id')
  if (!id || !plannerId) feedback('/dashboard', 'Choose an event and a planner')
  const { error } = await supabase.from('events').update({ planner_id: plannerId }).eq('id', id)
  if (error) feedback('/dashboard', error.message)
  revalidatePath('/dashboard')
  redirect('/dashboard?notice=Planner%20assigned')
}

export async function approveBusiness(form: FormData) {
  const { supabase, profile } = await requireAccount()
  guardRole(profile.role, 'admin')
  const id=value(form,'business_id'), choice=value(form,'decision')
  if (!['approved','suspended'].includes(choice)) feedback('/dashboard', 'Invalid decision')
  const { error } = await supabase.from('businesses').update({status:choice}).eq('id',id)
  if (error) feedback('/dashboard', error.message)
  revalidatePath('/dashboard')
  redirect('/dashboard?notice=Vendor%20review%20saved')
}

export async function requestVendorQuote(form: FormData) {
  const { supabase, profile } = await requireAccount()
  guardRole(profile.role, 'planner')
  const eventId=value(form,'event_id'), businessId=value(form,'business_id')
  if (!eventId || !businessId) feedback('/dashboard', 'Choose a supplier')
  const { error } = await supabase.from('event_vendor_requests').insert({event_id:eventId,business_id:businessId})
  if (error) feedback(`/dashboard/events/${eventId}`, error.code==='23505' ? 'Vendor already invited' : error.message)
  const { error: updateError } = await supabase.from('events').update({status:'sourcing'}).eq('id',eventId).eq('status','new')
  if (updateError) feedback(`/dashboard/events/${eventId}`, updateError.message)
  revalidatePath(`/dashboard/events/${eventId}`)
  redirect(`/dashboard/events/${eventId}?notice=Quote%20request%20created`)
}

export async function replyToQuote(form: FormData) {
  const { supabase, profile } = await requireAccount()
  guardRole(profile.role, 'vendor')
  const requestId=value(form,'request_id'), status=value(form,'status')
  if (!['quoted','declined'].includes(status)) feedback('/dashboard', 'Invalid quote response')
  const amount = status==='quoted' ? positive(value(form,'amount')) : null
  const expiresAt = status==='quoted' ? value(form,'expires_at') : null
  const inclusions=value(form,'inclusions')
  if (status==='quoted' && (!amount || !expiresAt || !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt))) {
    feedback('/dashboard', 'Enter a quote amount and expiration date')
  }
  if (inclusions.length > 1500) feedback('/dashboard', 'Quote description too long')
  const { error } = await supabase.from('quotes').insert({
    request_id: requestId, status, amount,
    expires_at: expiresAt || null, inclusions: status==='quoted' ? inclusions : '',
  })
  if (error) feedback('/dashboard', error.code === '23505' ? 'You have already responded to this request' : error.message)
  revalidatePath('/dashboard')
  redirect('/dashboard?notice=Response%20submitted')
}

export async function buildProposal(form: FormData) {
  const { supabase, profile } = await requireAccount()
  guardRole(profile.role, 'planner')
  const eventId=value(form,'event_id')
  const fee=positive(value(form,'planner_fee'),true)
  const quoteIds=form.getAll('quote_id').map(String)
  if (!eventId || fee===null || !quoteIds.length) feedback(`/dashboard/events/${eventId}`, 'Choose quotes and a valid planner fee')
  const { error } = await supabase.rpc('create_proposal_for_event', {
    p_event_id:eventId, p_planner_fee:fee, p_quote_ids:quoteIds,
  })
  if (error) feedback(`/dashboard/events/${eventId}`, error.message)
  revalidatePath(`/dashboard/events/${eventId}`)
  redirect(`/dashboard/events/${eventId}?notice=Draft%20proposal%20created`)
}

export async function shareProposal(form: FormData) {
  const { supabase, profile } = await requireAccount()
  guardRole(profile.role, 'planner')
  const id=value(form,'proposal_id'), eventId=value(form,'event_id')
  const { error } = await supabase.from('proposals').update({status:'sent'}).eq('id',id).eq('status','draft')
  if (error) feedback(`/dashboard/events/${eventId}`, error.message)
  revalidatePath(`/dashboard/events/${eventId}`)
  redirect(`/dashboard/events/${eventId}?notice=Proposal%20shared%20in%20customer%20portal`)
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function requireAccount() {
  const supabase = await createClient()
  const { data: { claims }, error } = await supabase.auth.getClaims()
  if (error || !claims?.sub) redirect('/login')
  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('id,role,full_name').eq('id', claims.sub).single()
  if (profileError || !profile) redirect('/login?error=Account%20profile%20unavailable')
  return { supabase, userId: claims.sub as string, profile: profile as {
    id: string, full_name: string, role: 'customer' | 'planner' | 'vendor' | 'admin'
  } }
}

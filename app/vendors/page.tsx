import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { money } from '@/lib/helpers'
export const dynamic = 'force-dynamic'
export default async function Vendors() {
 const ready=!!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
 const supabase=ready ? await createClient() : null
 const {data: vendors}=supabase ? await supabase.from('businesses').select('id,name,category,city,description,starting_price').eq('status','approved').order('name') : {data:[]}
 return <section className="section container"><div className="eyebrow">SUPPLIER MARKETPLACE</div><h1 className="page-title">Find your event partners.</h1><p className="lead">Browse approved suppliers serving the Raleigh area. To request quotes, create a customer event.</p>
   {vendors?.length ? <div className="vendor-grid">{vendors.map(v => <article className="vendor-card" key={v.id}><div className="vendor-card-art">🎉</div><div className="vendor-body"><div className="eyebrow">{v.category}</div><h3>{v.name}</h3><p>{v.city}</p><p>{v.description}</p><div className="vendor-bottom"><b>From {money(v.starting_price)}</b><span className="pill">Approved</span></div></div></article>)}</div> : <div className="empty-public"><h2>Supplier onboarding is open.</h2><p>As businesses are reviewed and approved, their listings will appear here.</p></div>}
   <div className="inline-cta"><span>Need several vendors for one event?</span><Link className="button button-dark" href="/login">Create your event →</Link></div>
 </section>
}

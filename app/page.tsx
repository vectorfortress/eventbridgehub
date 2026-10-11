import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { money, CATEGORIES } from '@/lib/helpers'

export const dynamic = 'force-dynamic'
export default async function Home() {
  const configured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  const supabase = configured ? await createClient() : null
  const { data: vendors } = supabase ? await supabase.from('businesses')
    .select('id,name,category,city,description,starting_price').eq('status','approved').limit(6).order('created_at',{ascending:false})
    : { data: [] }
  return <>
    <section className="hero"><div className="container hero-content">
      <div className="eyebrow light"><span className="dot"/> RALEIGH–DURHAM PILOT</div>
      <h1>Bring every part of<br/><em>the celebration</em> together.</h1>
      <p>Find party professionals, coordinate your vendors, and build one clear event plan. Everything in one shared workspace.</p>
      <div className="hero-actions"><Link className="button button-coral" href="/login">Plan an event <span>↗</span></Link><Link className="button button-outline" href="/vendors">Explore vendors</Link></div>
      <div className="hero-note">For weddings • Children's parties • School events • Celebrations</div>
    </div><div className="hero-decoration"><div className="orb orb-one"/><div className="orb orb-two"/><div className="sparkle s1">✦</div><div className="sparkle s2">✳</div></div></section>
    <section className="section container"><div className="section-head"><div><div className="eyebrow">WHAT YOU CAN FIND</div><h2>Everything your event needs.</h2><p>Browse local providers, then coordinate with one event request.</p></div></div>
      <div className="category-grid">{CATEGORIES.map((category, i) => <Link key={category} className={`category-card category-${i}`} href="/vendors">
        <span className="category-icon">{['🎪','📸','🪑','🎈','🎭','📋'][i]}</span><strong>{category}</strong><span className="category-arrow">↗</span>
      </Link>)}</div>
    </section>
    <section className="pale-section"><div className="container section"><div className="section-head"><div><div className="eyebrow">ONE WORKSPACE • THREE PERSPECTIVES</div><h2>Made for the people behind every celebration.</h2></div></div>
      <div className="three-cards">
        <article className="feature-card"><span className="feature-icon">♡</span><h3>For customers</h3><p>Share your date, vision and budget once. Track responses and review a single itemized proposal.</p><Link href="/login">Create event →</Link></article>
        <article className="feature-card"><span className="feature-icon">◈</span><h3>For planners</h3><p>See assigned events, invite approved suppliers, compare quotes and share coordinated proposals.</p><Link href="/login">Planner access →</Link></article>
        <article className="feature-card"><span className="feature-icon">✧</span><h3>For vendors</h3><p>Apply to the directory and respond to real quote requests in a vendor-only workspace.</p><Link href="/login">List your business →</Link></article>
      </div>
    </div></section>
    <section className="section container"><div className="section-head"><div><div className="eyebrow">LOCAL PARTNERS</div><h2>Discover event businesses.</h2></div><Link className="text-link" href="/vendors">View all →</Link></div>
      {vendors?.length ? <div className="vendor-grid">{vendors.map(v => <article className="vendor-card" key={v.id}>
        <div className="vendor-card-art">{v.category.includes('Bounce')?'🎪':v.category.includes('Photo')?'📸':v.category.includes('Furniture')?'🪑':'🎉'}</div>
        <div className="vendor-body"><div className="eyebrow">{v.category}</div><h3>{v.name}</h3><p>{v.city}</p><div className="vendor-bottom"><span>Starting at <b>{money(v.starting_price)}</b></span><span className="pill">Approved listing</span></div></div>
      </article>)}</div> : <div className="empty-public"><h3>Founding vendors wanted</h3><p>We are onboarding our first Raleigh-area event suppliers. Approved listings will appear here.</p><Link className="button button-dark" href="/login">Become a founding vendor ↗</Link></div>}
      {!configured && <p className="notice-warning">Developer setup needed: add your Supabase project environment variables before accepting real accounts.</p>}
    </section>
    <section className="cta-section"><div className="container cta-inner"><div><div className="eyebrow light">LET'S BUILD SOMETHING MEMORABLE</div><h2>Less coordination. More celebration.</h2><p>One place to request suppliers, compare quotes and follow your event.</p></div><Link href="/login" className="button button-coral">Get started ↗</Link></div></section>
  </>
}

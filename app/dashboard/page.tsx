import Link from 'next/link'
import { requireAccount } from '@/lib/session'
import { errorMessage, money, shortDate, CATEGORIES } from '@/lib/helpers'
import { signOut, createEvent, applyAsVendor, assignPlanner, approveBusiness, replyToQuote } from '@/lib/actions'

export const dynamic = 'force-dynamic'
type Query = {error?:string;notice?:string}

export default async function Dashboard({searchParams}:{searchParams:Promise<Query>}) {
  const { supabase, userId, profile } = await requireAccount()
  const params = await searchParams
  const today = new Date().toISOString().slice(0,10)
  const displayName=profile.full_name || 'there'
  return <section className="container dashboard-page">
    <div className="dash-welcome"><div><div className="eyebrow">YOUR EVENTBRIDGE WORKSPACE</div>
      <h1>Good to see you, {displayName.split(' ')[0]}.</h1>
      <p>{profile.role === 'customer' ? 'Keep your event planning in one place.' :
         profile.role === 'planner' ? 'Your client events and supplier quotes at a glance.' :
         profile.role === 'vendor' ? 'Your listing and incoming quote requests.' :
         'Review the supplier network and assign new events.'}</p></div>
      <form action={signOut}><button className="button button-quiet">Sign out ↗</button></form>
    </div>
    <div className="role-chip">{profile.role.toUpperCase()} ACCOUNT</div>
    {params.error && <div className="notice-error" role="alert">{errorMessage(params.error)}</div>}
    {params.notice && <div className="notice-success" role="status">{params.notice}</div>}
    {profile.role === 'customer' && <CustomerDashboard supabase={supabase} userId={userId} today={today}/>}
    {profile.role === 'planner' && <PlannerDashboard supabase={supabase} userId={userId}/>}
    {profile.role === 'vendor' && <VendorDashboard supabase={supabase} userId={userId} today={today}/>}
    {profile.role === 'admin' && <AdminDashboard supabase={supabase}/>}
  </section>
}

type Client = Awaited<ReturnType<typeof requireAccount>>['supabase']

async function CustomerDashboard({supabase,userId,today}:{supabase:Client;userId:string;today:string}) {
  const {data: events,error}=await supabase.from('events').select('id,title,event_date,city,status,created_at')
    .eq('customer_id',userId).order('created_at',{ascending:false})
  return <div className="dashboard-columns"><div className="panel"><div className="eyebrow">START HERE</div><h2>Plan a new event</h2>
    <p className="muted">Tell us the basics. An admin assigns a planner, then your suppliers are invited to quote.</p>
    <form className="form-stack" action={createEvent}>
      <label>Event title<input name="title" required minLength={3} maxLength={120} placeholder="Abigail's birthday celebration"/></label>
      <div className="field-grid"><label>Event type<select name="kind" required><option>Children's birthday</option><option>Wedding</option><option>Family gathering</option><option>School event</option><option>Corporate event</option><option>Other event</option></select></label>
      <label>Date<input type="date" name="event_date" min={today} required/></label></div>
      <div className="field-grid"><label>City<input name="city" required minLength={2} maxLength={100} placeholder="Wake Forest, NC"/></label>
      <label>Guest count<input type="number" name="guests" min="1" max="10000" required/></label></div>
      <label>Estimated vendor budget ($)<input type="number" name="budget" min="0" step="0.01" defaultValue="500" required/></label>
      <label>Services needed<input name="services" maxLength={400} placeholder="Bounce house, photo booth, kids tables"/></label>
      <label>Additional notes<textarea name="notes" rows={4} maxLength={2000} placeholder="Venue, schedule, setup requirements..."/></label>
      <button className="button button-coral">Submit event request ↗</button>
      <p className="fine-print">Submitting a request does not reserve vendors or commit you to any charges.</p>
    </form></div>
    <div className="panel"><div className="eyebrow">YOUR EVENTS</div><h2>Requests and proposals</h2>
      {error && <div className="notice-error">Unable to load your events.</div>}
      {events?.length ? <div className="stack-list">{events.map(e=><Link key={e.id} href={`/dashboard/events/${e.id}`} className="list-row">
        <div><strong>{e.title}</strong><span>{shortDate(e.event_date)} · {e.city}</span></div><span className="status-pill">{e.status.replaceAll('_',' ')}</span>
      </Link>)}</div> : <div className="placeholder"><span>✦</span><h3>Your first event starts here.</h3><p>Complete the form to create your workspace.</p></div>}
    </div></div>
}

async function PlannerDashboard({supabase,userId}:{supabase:Client;userId:string}) {
 const {data:events,error}=await supabase.from('events').select('id,title,kind,event_date,city,guests,status,created_at')
   .eq('planner_id',userId).order('event_date',{ascending:true})
 return <div className="panel"><div className="eyebrow">ASSIGNED EVENTS</div><h2>Your event inbox</h2>
  <p className="muted">Open a client event to invite approved vendors, review private quotes, and create a combined proposal.</p>
  {error && <div className="notice-error">Unable to load assigned events.</div>}
  {events?.length ? <div className="stack-list">{events.map(e=><Link className="list-row" key={e.id} href={`/dashboard/events/${e.id}`}>
    <div><strong>{e.title}</strong><span>{e.kind} · {e.city} · {shortDate(e.event_date)} · {e.guests} guests</span></div><span className="status-pill">{e.status.replaceAll('_',' ')}</span>
  </Link>)}</div> : <div className="placeholder"><span>◈</span><h3>No events assigned yet.</h3><p>The platform administrator assigns incoming customer requests to planners.</p></div>}
 </div>
}

async function VendorDashboard({supabase,userId,today}:{supabase:Client;userId:string;today:string}) {
  const {data:businesses,error}=await supabase.from('businesses').select('id,name,category,city,status,starting_price').eq('owner_id',userId).order('created_at',{ascending:false})
  const businessIds=(businesses||[]).map(b=>b.id)
  const {data:requests}=businessIds.length ? await supabase.from('event_vendor_requests')
    .select('id,business_id,created_at,events(id,title,kind,event_date,city,guests,services,notes),quotes(id,status,amount,inclusions,expires_at)')
    .in('business_id',businessIds).order('created_at',{ascending:false}) : {data:[]}
  return <div className="dashboard-columns"><div className="panel"><div className="eyebrow">YOUR VENDOR BUSINESS</div><h2>Your listing</h2>
    {error && <div className="notice-error">Could not load your vendor profile.</div>}
    {businesses?.length ? <div className="stack-list">{businesses.map(b=><div className="list-row static" key={b.id}><div><strong>{b.name}</strong><span>{b.category} · {b.city} · From {money(b.starting_price)}</span></div><span className={`status-pill ${b.status==='approved'?'good':''}`}>{b.status}</span></div>)}</div> : null}
    <div className="divider-space"/><h3>Add a business for review</h3><p className="muted">Businesses must be approved by an administrator before appearing publicly.</p>
    <form className="form-stack" action={applyAsVendor}>
      <label>Business name<input name="name" required minLength={2} maxLength={100} placeholder="Your Party Rentals LLC"/></label>
      <label>Main category<select name="category" required>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Service city<input name="city" required minLength={2} maxLength={100} placeholder="Raleigh, NC"/></label>
      <label>Starting price ($)<input type="number" name="starting_price" min="0" step="0.01" defaultValue="250" required/></label>
      <label>What you offer<textarea name="description" rows={4} maxLength={1000} placeholder="Services, equipment, delivery radius, setup..."/></label>
      <button className="button button-dark">Submit business for review →</button>
    </form>
  </div><div className="panel"><div className="eyebrow">VENDOR-ONLY QUOTE REQUESTS</div><h2>Incoming inquiries</h2>
    <p className="muted">Only requests routed to your business appear here. A quote does not reserve your equipment.</p>
    {requests?.length ? <div className="stack-list">{requests.map(r=>{
      const event=r.events as unknown as {id:string;title:string;kind:string;event_date:string;city:string;guests:number;services:string;notes:string} | null
      const quotes=(r.quotes||[]) as {id:string;status:string;amount:number;inclusions:string}[]
      const quote=quotes[0]
      return <div className="lead-card" key={r.id}><div className="eyebrow">CUSTOMER INQUIRY</div>
        <h3>{event?.title || 'Event'}</h3><div className="mini-details">{shortDate(event?.event_date||'')} · {event?.city} · {event?.guests} guests</div>
        <p>{event?.services}</p><p className="muted">{event?.notes}</p>
        {quote ? <div className="notice-success">{quote.status==='declined'?'You declined this request.':`Quote submitted: ${money(quote.amount)}`}</div>
         : <form action={replyToQuote} className="form-stack"><input type="hidden" name="request_id" value={r.id}/>
            <label>Quote amount ($)<input name="amount" min="0.01" step="0.01" type="number"/></label>
            <label>Valid through<input type="date" name="expires_at" min={today}/></label>
            <label>What's included?<textarea name="inclusions" maxLength={1500} rows={2}/></label>
            <div className="form-buttons"><button className="button button-coral" name="status" value="quoted">Send quote ↗</button><button className="button button-quiet" name="status" value="declined" formNoValidate>Decline</button></div>
            <p className="fine-print">Quotes cannot be edited in this pilot. Confirm your pricing before sending.</p>
          </form>}
      </div>
    })}</div> : <div className="placeholder"><span>✉</span><h3>Nothing needs a quote yet.</h3><p>Approved businesses receive inquiries from assigned planners.</p></div>}
  </div></div>
}

async function AdminDashboard({supabase}:{supabase:Client}) {
  const [{data:businesses},{data:events},{data:planners}]=await Promise.all([
    supabase.from('businesses').select('id,name,city,category,status,created_at').order('created_at',{ascending:false}),
    supabase.from('events').select('id,title,event_date,city,status,planner_id').order('created_at',{ascending:false}),
    supabase.from('profiles').select('id,full_name').eq('role','planner').order('created_at',{ascending:false}),
  ])
  return <div className="dashboard-columns"><div className="panel"><div className="eyebrow">SUPPLIER QUALITY</div><h2>Approve business listings</h2>
     {businesses?.length ? <div className="stack-list">{businesses.map(b=><div className="admin-row" key={b.id}>
       <div><strong>{b.name}</strong><span>{b.category} · {b.city}</span><span className="status-pill">{b.status}</span></div>
       <form action={approveBusiness} className="form-buttons"><input type="hidden" name="business_id" value={b.id}/><button className="button button-mini" name="decision" value="approved">Approve</button><button className="button button-mini secondary" name="decision" value="suspended">Suspend</button></form>
     </div>)}</div> : <div className="placeholder">No business applications yet.</div>}
   </div><div className="panel"><div className="eyebrow">NEW CUSTOMER EVENTS</div><h2>Assign planners</h2>
     {!planners?.length && <div className="notice-warning">Create and confirm at least one planner account before assigning events.</div>}
     {events?.length ? <div className="stack-list">{events.map(e=><div className="admin-row" key={e.id}>
        <div><strong>{e.title}</strong><span>{shortDate(e.event_date)} · {e.city}</span><span className="status-pill">{e.status}</span></div>
        <form action={assignPlanner} className="form-stack"><input type="hidden" name="event_id" value={e.id}/>
         <label className="sr-only" htmlFor={`planner-${e.id}`}>Planner</label>
         <select id={`planner-${e.id}`} name="planner_id" defaultValue={e.planner_id||''} required>
          <option value="" disabled>Assign planner</option>{planners?.map(p=><option value={p.id} key={p.id}>{p.full_name||p.id.slice(0,8)}</option>)}
         </select><button className="button button-mini" disabled={!planners?.length}>Save assignment</button>
        </form>
     </div>)}</div> : <div className="placeholder">No customer requests yet.</div>}
   </div></div>
}

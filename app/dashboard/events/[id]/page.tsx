import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAccount } from '@/lib/session'
import { CATEGORIES, errorMessage, money, shortDate } from '@/lib/helpers'
import { requestVendorQuote, buildProposal, shareProposal } from '@/lib/actions'

export const dynamic = 'force-dynamic'
export default async function EventWorkspace({ params,searchParams }: {
 params:Promise<{id:string}>;searchParams:Promise<{error?:string;notice?:string}>
}) {
 const [{id},messages] = await Promise.all([params,searchParams])
 const {supabase,profile}=await requireAccount()
 const {data:event,error}=await supabase.from('events')
  .select('id,title,kind,event_date,city,guests,budget,services,notes,status,customer_id,planner_id')
  .eq('id',id).single()
 if(error || !event) notFound()
 const isPlanner=profile.role==='planner' && event.planner_id===profile.id
 const isCustomer=profile.role==='customer' && event.customer_id===profile.id
 const [{data:requests},{data:proposal},{data:businesses}]=await Promise.all([
  isPlanner ? supabase.from('event_vendor_requests')
   .select('id,business_id,created_at,businesses(name,category),quotes(id,status,amount,inclusions,expires_at)')
   .eq('event_id',id).order('created_at',{ascending:true}) : Promise.resolve({data:[]}),
  (isPlanner || isCustomer) ? supabase.from('proposals')
   .select('id,status,planner_fee,sent_at,proposal_items(id,description,amount,quote_id)')
   .eq('event_id',id).maybeSingle() : Promise.resolve({data:null}),
  isPlanner ? supabase.from('businesses').select('id,name,category,city,status')
   .eq('status','approved').order('name') : Promise.resolve({data:[]}),
 ])
 const reqs = (requests||[]) as {id:string;business_id:string;businesses:{name:string;category:string}|null;quotes:{id:string;status:string;amount:number;inclusions:string;expires_at:string}[]}[]
 const quotes = reqs.flatMap(r => (r.quotes||[]).filter(q=>q.status==='quoted').map(q=>({...q, vendor:r.businesses?.name || 'Vendor'})))
 const selected = new Set(reqs.map(r=>r.business_id))
 const proposalItems=(proposal?.proposal_items || []) as {id:string;description:string;amount:number;quote_id:string}[]
 const vendorTotal=proposalItems.reduce((sum,item)=>sum + Number(item.amount),0)
 return <section className="container dashboard-page">
  <div className="back-link"><Link href="/dashboard">← Back to dashboard</Link></div>
  <div className="workspace-heading"><div><div className="eyebrow">EVENT WORKSPACE</div><h1>{event.title}</h1><p>{event.kind} · {shortDate(event.event_date)} · {event.city}</p></div><span className="status-pill">{event.status.replaceAll('_',' ')}</span></div>
  {messages.error && <div className="notice-error" role="alert">{errorMessage(messages.error)}</div>}
  {messages.notice && <div className="notice-success" role="status">{messages.notice}</div>}
  <div className="facts-grid"><div><strong>{event.guests}</strong><span>Guests</span></div><div><strong>{money(event.budget)}</strong><span>Target budget</span></div><div><strong>{shortDate(event.event_date)}</strong><span>Event date</span></div></div>
  <div className="dashboard-columns"><div className="panel"><div className="eyebrow">EVENT BRIEF</div><h2>Plan details</h2><h4>Services requested</h4><p>{event.services || 'No specific services requested'}</p><h4>Special instructions</h4><p>{event.notes || 'No additional instructions'}</p>
   {isCustomer && <div className="notice-soft">Your event has been submitted. Once a planner is assigned, they can request supplier quotes. Nothing is booked or charged yet.</div>}
   {isPlanner && <><div className="divider-space"/><div className="eyebrow">VENDOR SOURCING</div><h2>Request supplier quotes</h2>
    <form action={requestVendorQuote} className="form-stack"><input type="hidden" name="event_id" value={event.id}/>
     <label>Approved vendors<select name="business_id" required defaultValue=""><option value="" disabled>Choose a supplier</option>
      {businesses?.filter(b=>!selected.has(b.id)).map(b=><option key={b.id} value={b.id}>{b.name} · {b.category} · {b.city}</option>)}
     </select></label><button className="button button-dark" disabled={!businesses?.some(b=>!selected.has(b.id))}>Send quote request →</button>
    </form><p className="fine-print">Suppliers receive the request in their dashboards. Automatic email notices are not yet enabled.</p>
    <div className="divider-space"/><h3>Invited suppliers</h3>
    {reqs.length ? <div className="stack-list">{reqs.map(r=>{const q=r.quotes?.[0];return <div className="list-row static" key={r.id}><div><strong>{r.businesses?.name || 'Vendor'}</strong><span>{r.businesses?.category}</span><span>{q?.status==='quoted'?`Quote: ${money(q.amount)} · Expires ${shortDate(q.expires_at)}`:q?.status==='declined'?'Declined':'Awaiting supplier quote'}</span></div><span className="status-pill">{q?.status||'requested'}</span></div>})}</div>
     : <div className="placeholder">Invite an approved vendor to start sourcing.</div>}
    </>}
  </div>
  <div className="panel"><div className="eyebrow">COMBINED PROPOSAL</div><h2>Supplier quotes & pricing</h2>
    {isPlanner && !proposal && <>{quotes.length ? <><p className="muted">Select supplier quotes to include in the customer's itemized proposal.</p>
      <form action={buildProposal} className="form-stack"><input type="hidden" name="event_id" value={event.id}/>
       <div className="stack-list">{quotes.map(q=><label className="check-row" key={q.id}><input type="checkbox" name="quote_id" value={q.id} defaultChecked/>
        <span><strong>{q.vendor} · {money(q.amount)}</strong><small>{q.inclusions} · Valid through {shortDate(q.expires_at)}</small></span></label>)}</div>
       <label>Planner service fee ($)<input name="planner_fee" type="number" min="0" step="0.01" defaultValue="0" required/></label>
       <button className="button button-coral">Create draft proposal ↗</button></form>
     </> : <div className="placeholder"><span>◷</span><h3>Waiting on vendor quotes</h3><p>Once a supplier replies, you can build an itemized proposal.</p></div>}</>}
    {proposal ? <><div className="stack-list">{proposalItems.map(item=><div key={item.id} className="total-line"><span>{item.description}</span><strong>{money(item.amount)}</strong></div>)}</div>
     <div className="total-line"><span>Vendor subtotal</span><strong>{money(vendorTotal)}</strong></div><div className="total-line"><span>Planner service fee</span><strong>{money(proposal.planner_fee)}</strong></div>
     <div className="grand-total"><span>Proposed total</span><strong>{money(vendorTotal+Number(proposal.planner_fee))}</strong></div>
     <span className="status-pill">Proposal {proposal.status}</span>
     {isPlanner && proposal.status==='draft' && <form action={shareProposal} className="form-stack"><input type="hidden" name="event_id" value={event.id}/><input type="hidden" name="proposal_id" value={proposal.id}/><button className="button button-coral">Share proposal to customer portal ↗</button></form>}
     {isCustomer && <div className="notice-soft">Proposal shared for your review. This is not a confirmed reservation. Contact your planner for next steps; proposal acceptance and payment are not in the pilot.</div>}
     {isPlanner && proposal.status==='sent' && <div className="notice-success">Customer can now view this proposal in their event workspace.</div>}
    </> : !isPlanner && <div className="placeholder"><span>◇</span><h3>No proposal to view yet.</h3><p>You'll see an itemized supplier proposal here when your planner shares one.</p></div>}
    <p className="fine-print">Prices are vendor quotations, subject to availability and the supplier's terms. No reservation or payment occurs in this application.</p>
  </div></div>
 </section>
}

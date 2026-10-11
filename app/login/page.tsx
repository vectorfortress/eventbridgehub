import { signIn, signUp } from '@/lib/actions'
import { errorMessage } from '@/lib/helpers'

export const dynamic='force-dynamic'
export default async function Login({searchParams}: {searchParams:Promise<{error?:string,notice?:string}>}) {
 const params=await searchParams
 const configured=!!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
 return <section className="container section auth-wrap"><div className="auth-intro">
   <div className="eyebrow">YOUR EVENT, YOUR WORKSPACE</div><h1>Welcome to<br/><em>EventBridge Hub.</em></h1>
   <p>Connect customers, event planners and rental suppliers with a simple, shared booking conversation.</p>
   <div className="auth-benefits"><div>✓ Real customer event requests</div><div>✓ Private vendor quote workspaces</div><div>✓ Itemized proposals, without payment commitments</div></div>
 </div><div className="auth-stack">
  {!configured && <div className="notice-warning">This app needs Supabase setup before authentication will work. See the README.</div>}
  {params.error && <div className="notice-error" role="alert">{errorMessage(params.error)}</div>}
  {params.notice && <div className="notice-success" role="status">{params.notice}</div>}
  <div className="panel"><div className="eyebrow">WELCOME BACK</div><h2>Sign in</h2>
   <form action={signIn} className="form-stack"><label>Email<input type="email" name="email" placeholder="you@example.com" required/></label><label>Password<input type="password" name="password" required/></label><button className="button button-dark" disabled={!configured}>Sign in →</button></form>
  </div>
  <div className="panel"><div className="eyebrow">NEW TO EVENTBRIDGE</div><h2>Create your account</h2>
   <form action={signUp} className="form-stack"><label>Full name<input name="full_name" minLength={2} maxLength={100} placeholder="Your name" required/></label>
    <label>I'm joining as<select name="role" required><option value="customer">Customer / event host</option><option value="planner">Event planner</option><option value="vendor">Rental company / vendor</option></select></label>
    <label>Email<input type="email" name="email" placeholder="you@example.com" required/></label>
    <label>Password (8+ characters)<input type="password" name="password" minLength={8} required/></label>
    <button className="button button-coral" disabled={!configured}>Create account ↗</button>
    <p className="fine-print">You may need to confirm your email address before signing in. Admin accounts are not created through signup.</p>
   </form>
  </div>
 </div></section>
}

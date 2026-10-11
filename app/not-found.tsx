import Link from 'next/link'
export default function NotFound() {
 return <section className="container section"><h1>We couldn't find that event.</h1>
  <p>The event may not exist, or your account may not have access to it.</p>
  <Link className="button button-dark" href="/dashboard">Back to your dashboard →</Link>
 </section>
}

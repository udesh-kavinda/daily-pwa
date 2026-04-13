import Link from "next/link";

export default function SetupPage() {
  return (
    <main className="min-h-screen px-6 py-16 text-white">
      <div className="mx-auto w-full max-w-3xl space-y-8 rounded-[32px] border border-white/10 bg-white/5 p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Setup</p>
          <h1 className="text-3xl font-semibold">Configure Daily+ Mobile</h1>
          <p className="mt-2 text-sm text-slate-300">
            Add Clerk, Supabase, and Firebase credentials to unlock the real shared backend and mobile services.
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm">
          <p className="font-semibold text-white">Required .env.local entries</p>
          <pre className="text-xs text-slate-300">
{`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"`}
          </pre>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/" className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold">
            Back to Home
          </Link>
          <Link href="/dashboard" className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-900">
            Open Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

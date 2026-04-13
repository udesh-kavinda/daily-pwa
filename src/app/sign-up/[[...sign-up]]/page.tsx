import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-screen px-6 py-16 text-white">
      <div className="mx-auto w-full max-w-md rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-xl shadow-black/30">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-sm font-bold text-slate-900">
            D+
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-slate-300">
            Join Daily+ Mobile and continue into your role-based workspace.
          </p>
        </div>
        <div className="mt-6">
          <SignUp
            fallbackRedirectUrl="/dashboard"
            appearance={{
              elements: {
                card: "shadow-none bg-transparent border-none",
                formButtonPrimary:
                  "bg-emerald-400 text-slate-900 hover:bg-emerald-300",
              },
            }}
          />
        </div>
      </div>
    </main>
  );
}

import { redirect } from 'next/navigation';
import { CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react';

import { LoginForm } from '@/components/auth/login-form';
import { BrandMark } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { getCurrentUser } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect('/');
  }

  return (
    <main className="grid min-h-screen bg-[#f5f8f8] lg:grid-cols-[minmax(380px,0.9fr)_minmax(520px,1.1fr)]">
      <section className="relative hidden overflow-hidden bg-[#17363a] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -right-28 -top-20 size-80 rounded-full border border-white/[0.05]" />
        <div className="absolute -right-10 -top-3 size-52 rounded-full border border-[#60d7c3]/10" />
        <div className="relative flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.02em]">
              Reliable Medical
            </p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">
              Operations
            </p>
          </div>
        </div>

        <div className="relative max-w-lg py-16">
          <Badge
            variant="outline"
            className="h-7 border-[#60d7c3]/20 bg-[#60d7c3]/10 px-2.5 text-[11px] font-semibold text-[#7ee4d0]"
          >
            <ShieldCheck className="size-3" />
            Internal operations workspace
          </Badge>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.12] tracking-[-0.045em] xl:text-5xl">
            Keep authorization work moving with clarity.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-white/55">
            A focused workspace for organizing synthetic prior authorization
            cases, documentation gaps, and follow-up timing.
          </p>
          <div className="mt-9 space-y-4 text-sm text-white/68">
            {[
              'Admin-provisioned access only',
              'Human review before external submission',
              'Synthetic case data in this prototype',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="size-4 text-[#60d7c3]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] leading-5 text-white/35">
          This prototype assists workflow organization and does not make
          medical-necessity or coverage decisions.
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[430px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <div>
              <p className="text-[15px] font-semibold text-slate-800">
                Reliable Medical
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                Operations
              </p>
            </div>
          </div>

          <div className="grid size-11 place-items-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
            <LockKeyhole className="size-5" />
          </div>
          <h2 className="mt-5 text-[28px] font-semibold tracking-[-0.04em] text-slate-900">
            Welcome back
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Sign in with the account provided by your administrator.
          </p>

          <LoginForm />

          <div className="mt-7 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-xs leading-5 text-slate-500">
            There is no public registration. Contact your administrator if you
            need access or a password reset.
          </div>
        </div>
      </section>
    </main>
  );
}

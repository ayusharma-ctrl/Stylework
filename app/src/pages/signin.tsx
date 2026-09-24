import { useState, type FormEvent } from 'react';
import { ArrowRight, Layers3, Check, Orbit } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api, json, queryClient } from '../lib/api';
import { useSession } from '../lib/store';
import { leadsOptions } from '../lib/queries';
import type { Profile, Tokens } from '../lib/types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ErrorState } from '../components/feedback';
export default function Signin() {
  const [email, setEmail] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      api<Profile & { tokens: Tokens }>('/signin', {
        method: 'POST',
        body: json({ email: email.trim().toLowerCase() }),
      }),
    onSuccess: ({ tokens, ...profile }) => {
      queryClient.clear();
      useSession.getState().setTokens(tokens);
      queryClient.setQueryData(['me'], profile);
      void queryClient.prefetchInfiniteQuery(leadsOptions());
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }
  return (
    <main className="signin-grid">
      <section className="signin-story">
        <a href="/" className="brand">
          <span className="brand-mark">
            <Layers3 size={23} />
          </span>
          stylework<span className="brand-dot">.</span>
        </a>
        <div className="relative z-10 my-auto py-16">
          <span className="eyebrow">YOUR NEXT CONVERSATION STARTS HERE</span>
          <h1 className="mt-6 max-w-lg text-5xl font-semibold leading-[1.12] tracking-tight lg:text-6xl">
            Every lead.
            <br />A new possibility.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-500">
            A calmer way to capture interest, keep your team in sync, and turn potential into progress.
          </p>
          <div className="mt-10 flex flex-col gap-4 text-sm text-slate-600">
            {[
              'Every lead, every conversation',
              'A clear history of every change',
              'Your pipeline, always up to date',
            ].map((label) => (
              <span className="flex items-center gap-3" key={label}>
                <span className="rounded-full bg-teal-100 p-1 text-teal-700">
                  <Check size={14} />
                </span>
                {label}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-400">BUILT FOR TEAMS THAT MOVE THINGS FORWARD</p>
        <Orbit
          className="absolute -bottom-32 -right-32 h-[480px] w-[480px] text-blue-100/60"
          strokeWidth={0.4}
        />
      </section>
      <section className="flex items-center justify-center p-7 md:p-14">
        <div className="w-full max-w-sm">
          <span className="mb-8 inline-flex rounded-2xl bg-primary/10 p-3 text-primary">
            <Layers3 size={27} />
          </span>
          <h2 className="text-3xl font-semibold tracking-tight">Welcome to Stylework</h2>
          <p className="mt-3 mb-8 text-muted-foreground">Enter your email to get started.</p>
          <form onSubmit={submit} className="space-y-5">
            <label className="block text-sm font-medium my-8">
              Email address
              <Input
                autoComplete="email"
                type="email"
                required
                maxLength={254}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 h-12"
              />
            </label>
            {mutation.error && <ErrorState error={mutation.error} />}
            <Button type="submit" disabled={mutation.isPending} className="h-12 w-full">
              {mutation.isPending ? 'Signing in…' : 'Continue to Stylework'}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            This demo application uses email-only access. Use a demo email; no password or email verification
            is required.
          </p>
        </div>
      </section>
    </main>
  );
}

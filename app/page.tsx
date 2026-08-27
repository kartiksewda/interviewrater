import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, Brain, Target, ArrowRight, CheckCircle2, Sparkles, Zap, TrendingUp } from 'lucide-react';
import { APP_CONFIG } from '@/lib/config';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border/40 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Mic className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">{APP_CONFIG.name}</span>
          </div>
          <Link href="/interview/setup">
            <Button size="sm" className="gap-1.5">
              Start Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="gradient-hero text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-sm font-medium mb-6 animate-fade-in-up">
            <Sparkles className="h-4 w-4 text-sky-300" />
            AI-powered interview coaching for Indian candidates
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-[1.15] animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            Get brutally honest interview feedback in 3 minutes
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-blue-100 max-w-2xl mx leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            Record yourself answering a real interview question. Get instant, specific feedback scored against a rubric tailored to your target role — SDE-1, Bank PO, or MBA GD-PI.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <Link href="/interview/setup">
              <Button size="lg" className="bg-white text-primary hover:bg-blue-50 gap-2 text-base h-12 px-8">
                Start Free Mock Interview <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <span className="text-blue-100 text-sm">No signup required. First question is free.</span>
          </div>

          {/* Role pills */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            {APP_CONFIG.roles.map((role) => (
              <div key={role.id} className="glass px-4 py-2 rounded-full text-sm font-medium">
                {role.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 sm:py-24 bg-secondary/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">How it works</h2>
            <p className="mt-3 text-muted-foreground">Three steps between you and better interview answers</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Mic,
                step: '1',
                title: 'Answer a real question',
                desc: 'Pick your target role and record a voice answer to a real interview question — just like the actual interview.',
              },
              {
                icon: Brain,
                step: '2',
                title: 'Get instant AI feedback',
                desc: 'Our AI transcribes your answer and scores it on structure, specificity, filler words, confidence, and role-relevant correctness.',
              },
              {
                icon: TrendingUp,
                step: '3',
                title: 'Fix your weak spots',
                desc: 'Get a rewritten model answer using your own examples, plus specific quotes showing exactly what to improve.',
              },
            ].map((item) => (
              <Card key={item.step} className="relative p-6 hover:shadow-lg transition-shadow">
                <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                  {item.step}
                </div>
                <item.icon className="h-10 w-10 text-primary mb-4 mt-2" />
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Sample report */}
      <section className="py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
                Feedback that references <span className="gradient-text">what you actually said</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                No generic advice. Every piece of feedback quotes specific words from your answer — so you know exactly where you lost points and how to fix it.
              </p>
              <ul className="space-y-3">
                {[
                  'STAR-method structure analysis (Present, Weak, or Missing)',
                  'Filler word count and frequency per 100 words',
                  'Confidence vs hedging language breakdown with examples',
                  'Specificity scoring — vague vs concrete examples',
                  'A rewritten model answer using your real details',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mock report card */}
            <Card className="p-6 shadow-xl border-border/60">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sample Report</span>
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">SDE-1</span>
              </div>
              <div className="text-center py-4">
                <div className="text-5xl font-bold gradient-text">67</div>
                <div className="text-sm text-muted-foreground mt-1">Overall Score</div>
              </div>
              <div className="space-y-3 mt-6">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">Structure (STAR)</span>
                    <span className="text-muted-foreground">6/10 · Weak</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '60%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">Specificity</span>
                    <span className="text-muted-foreground">4/10</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: '40%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">Filler Words</span>
                    <span className="text-muted-foreground">5/10 · 14 found</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '50%' }} />
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground italic">
                    &ldquo;You jumped to what you would do instead of describing a real past example — your STAR structure is missing Situation and Result.&rdquo;
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-16 bg-secondary/30 border-y">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-semibold">Built for Indian interview rounds</span>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Tailored rubrics for SDE-1, Bank PO, and MBA GD-PI candidates. Real questions from real interview formats — technical, behavioral, and situational.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to find out how you actually sound?
          </h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Your first question is free. Get your score and headline insight instantly.
          </p>
          <Link href="/interview/setup">
            <Button size="lg" className="gap-2 text-base h-12 px-8">
              <Target className="h-5 w-5" /> Start Free Mock Interview
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-secondary/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm">{APP_CONFIG.name}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            AI-powered interview coaching for Indian job seekers and exam candidates.
          </p>
        </div>
      </footer>
    </div>
  );
}

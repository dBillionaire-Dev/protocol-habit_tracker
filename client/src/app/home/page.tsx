import type { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  Flame,
  TrendingDown,
  BarChart3,
  Ban,
  Target,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Public marketing/explainer page (spec section 2). This is intentionally
// separate from the app/page.tsx root, which is the sign-in/sign-up
// screen — that flow is untouched. This page is a plain server component
// (no client-side data fetching): it never needs the visitor's billing
// status or habit data, only static copy and links into the real app.
export const metadata: Metadata = {
  title: "Protocol — A Serious System for Personal Discipline",
  description:
    "Build habits that compound and eliminate habits that don't belong. Protocol tracks streaks, habit debt, and progress with zero tolerance for excuses.",
};

const PLAN_SUMMARY: {
  name: string;
  price: string;
  highlight?: boolean;
  features: string[];
}[] = [
  {
    name: "Free",
    price: "₦0",
    features: ["3 protocols total", "Debt & streak tracking", "Daily confirmation window"],
  },
  {
    name: "Pro",
    price: "From ₦2,999/month",
    highlight: true,
    features: ["Unlimited protocols", "Everything in Free", "Full history & advanced analytics"],
  },
  {
    name: "Premium Plus",
    price: "From ₦5,999/month",
    features: ["Everything in Pro", "AI-powered insights", "Flexible day confirmation"],
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/home" className="flex items-center gap-2 font-bold text-lg tracking-tighter">
            <Shield className="w-5 h-5" />
            <span>PROTOCOL</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/pricing">
              <Button variant="ghost" size="sm">Pricing</Button>
            </Link>
            <Link href="/">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Discipline isn&apos;t motivation.
            <br />
            It&apos;s a system.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Protocol is a habit-tracking system with zero tolerance for excuses. Build the habits
            that compound. Eliminate the ones that don&apos;t belong. Every missed day owes you a
            debt, and Protocol makes sure you can&apos;t quietly forget it.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link href="/">
              <Button size="lg">Start for free</Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">See pricing</Button>
            </Link>
          </div>
        </section>

        {/* Build vs Break */}
        <section className="container max-w-5xl mx-auto px-4 py-16">
          <div className="text-center mb-10 space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Two kinds of protocols</h2>
            <p className="text-muted-foreground">
              Every habit is either something you build, or something you break.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="w-5 h-5 text-emerald-500" />
                  Build Protocols
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  For habits you want to show up for, every day, a workout, a page count, a
                  meditation session. Complete the day&apos;s task to extend your streak.
                </p>
                <p>
                  Miss a day and it becomes <span className="text-foreground font-medium">debt</span>,
                  a missed day that stays on the books until you repay it, in whole or in part,
                  on top of your normal task.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Ban className="w-5 h-5 text-destructive" />
                  Avoidance Protocols
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  For habits you want gone like doom-scrolling, smoking, whatever it is you&apos;re
                  trying to quit. Every slip is logged as a violation the moment it happens.
                </p>
                <p>
                  A clean day only counts when you explicitly{" "}
                  <span className="text-foreground font-medium">confirm it</span>, no violations
                  logged, no silent passes.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Streaks & Debt */}
        <section className="border-y border-border/40 bg-muted/20">
          <div className="container max-w-5xl mx-auto px-4 py-16">
            <div className="text-center mb-10 space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Streaks and debt, tracked honestly</h2>
              <p className="text-muted-foreground">No fudged numbers. No hidden resets.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center space-y-2">
                <Flame className="w-6 h-6 mx-auto text-emerald-500" />
                <h3 className="font-semibold">Streaks</h3>
                <p className="text-sm text-muted-foreground">
                  Every consecutive completed day counts. Break the chain and the streak resets,
                  no exceptions, no rounding in your favor.
                </p>
              </div>
              <div className="text-center space-y-2">
                <TrendingDown className="w-6 h-6 mx-auto text-destructive" />
                <h3 className="font-semibold">Habit Debt</h3>
                <p className="text-sm text-muted-foreground">
                  Miss a Build day and it&apos;s recorded as a day of debt. Repay it whenever
                  you&apos;re ready, in full or in part, Protocol tracks exactly how much you owe.
                </p>
              </div>
              <div className="text-center space-y-2">
                <BarChart3 className="w-6 h-6 mx-auto text-blue-400" />
                <h3 className="font-semibold">Progress Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  A full history of every completed, missed, and repaid day, with exportable
                  analytics on Pro and Premium Plus.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing summary */}
        <section className="container max-w-5xl mx-auto px-4 py-16">
          <div className="text-center mb-10 space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Plans for every level of commitment</h2>
            <p className="text-muted-foreground">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PLAN_SUMMARY.map((plan) => (
              <Card key={plan.name} className={cn(plan.highlight && "border-primary")}>
                <CardHeader>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <p className="text-2xl font-mono font-bold">{plan.price}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/pricing">
              <Button variant="outline">Compare full plan details</Button>
            </Link>
          </div>
        </section>

        {/* Final CTA */}
        <section className="container max-w-3xl mx-auto px-4 py-16 text-center space-y-5">
          <h2 className="text-2xl font-bold tracking-tight">No more quietly letting yourself off the hook.</h2>
          <br />
          <Link href="/">
            <Button size="lg">Start your first protocol</Button>
          </Link>
        </section>
      </main>

      <footer className="border-t border-border/40">
        <div className="container max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Protocol</span>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

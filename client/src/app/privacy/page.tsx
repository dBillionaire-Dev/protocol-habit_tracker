import type { Metadata } from "next";
import Link from "next/link";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Protocol's Privacy Policy.",
};

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

// Every data-handling claim on this page reflects what the codebase
// actually does as of this writing (Supabase for auth/DB, Paystack for
// billing, Resend for trial-reminder email, guest mode stored only in
// localStorage) — not generic boilerplate. If the stack changes, this
// page needs to change with it.
export default function PrivacyPage() {
  const lastUpdated = "August 20, 2026";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="container max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/home" className="flex items-center gap-2 font-bold text-lg tracking-tighter">
            <Shield className="w-5 h-5" />
            <span>PROTOCOL</span>
          </Link>
          <Link href="/home">
            <Button variant="ghost" size="sm">Back home</Button>
          </Link>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-12 space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        <Section title="1. What We Collect">
          <p>If you create an account, we collect:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your email address and authentication credentials (we never see your raw password).</li>
            <li>The habit protocols you create: names, types, schedules, completion/miss history, and repayment records.</li>
            <li>Subscription and billing status (plan, billing interval, trial history), actual payment details (card numbers, etc.) are handled entirely by Paystack and never touch our servers.</li>
            <li>Basic usage data needed to operate the app (e.g. timestamps of actions you take).</li>
          </ul>
          <p>
            If you use Guest mode, none of the above is sent to us at all, your data is stored
            only in your browser&apos;s local storage and is lost if you clear your browser data or
            switch devices.
          </p>
        </Section>

        <Section title="2. How We Use Your Data">
          <p>We use the data described above to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Operate Protocol's core functionality, tracking your habits, streaks, and debt.</li>
            <li>Process payments and manage your subscription, via Paystack.</li>
            <li>Send transactional email, for example, subscription trial reminders, via our email provider, Resend.</li>
            <li>Respond to support requests you send us.</li>
            <li>Maintain the security and integrity of Protocol.</li>
          </ul>
          <p>We do not sell your personal data to third parties, and we don&apos;t use it for advertising.</p>
        </Section>

        <Section title="3. Who We Share Data With">
          <p>We share data only with the service providers necessary to run Protocol:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="text-foreground">Supabase</span> - authentication and database hosting.</li>
            <li><span className="text-foreground">Paystack</span> - payment processing for subscriptions.</li>
            <li><span className="text-foreground">Resend</span> - delivery of transactional emails (e.g. trial reminders).</li>
            <li><span className="text-foreground">Vercel</span> - application hosting.</li>
          </ul>
          <p>
            Each of these providers only receives the data necessary to perform their function and
            is bound by their own privacy and security practices.
          </p>
        </Section>

        <Section title="4. Data Retention">
          <p>
            We retain your account and habit data for as long as your account is active. If you
            delete your account from the profile menu, your habit data, history, and account record
            are permanently removed from our database. Some records (such as billing history) may
            be retained longer where required for legal, tax, or fraud-prevention purposes.
          </p>
        </Section>

        <Section title="5. Your Rights">
          <p>You can, at any time:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access and export your habit history (Pro and Premium Plus plans include CSV export).</li>
            <li>Correct inaccurate account information.</li>
            <li>Permanently delete your account and all associated data, from the profile menu.</li>
          </ul>
          <p>
            If you're in a jurisdiction with additional data protection rights (such as the EU/UK
            GDPR or similar laws), you may also have rights to data portability or to object to
            certain processing, contact us using the details below and we&apos;ll do our best to
            help.
          </p>
        </Section>

        <Section title="6. Security">
          <p>
            We rely on Supabase&apos;s infrastructure for authentication and database security, and
            Paystack&apos;s PCI-compliant infrastructure for handling payment card data, we never
            store your card details ourselves. No system is perfectly secure, but we take
            reasonable measures to protect your data.
          </p>
        </Section>

        <Section title="7. Children's Privacy">
          <p>
            Protocol is not directed at children under 13, and we do not knowingly collect personal
            data from children under 13. If you believe a child has provided us with personal data,
            contact us and we&apos;ll delete it.
          </p>
        </Section>

        <Section title="8. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. If we make material changes,
            we&apos;ll update the &quot;Last updated&quot; date above.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            Questions about this Privacy Policy or your data? Reach us at{" "}
            {SUPPORT_EMAIL ? (
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-foreground underline underline-offset-2">
                {SUPPORT_EMAIL}
              </a>
            ) : (
              "our support email"
            )}
            .
          </p>
        </Section>
      </main>
    </div>
  );
}

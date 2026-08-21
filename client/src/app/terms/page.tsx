import type { Metadata } from "next";
import Link from "next/link";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Protocol's Terms of Service.",
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

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        <Section title="1. Agreement to Terms">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of Protocol
            (&quot;Protocol&quot;, &quot;we&quot;, &quot;us&quot;), a habit-tracking application. By
            creating an account, using the Guest mode, or otherwise accessing Protocol, you agree
            to be bound by these Terms. If you don&apos;t agree, don&apos;t use Protocol.
          </p>
        </Section>

        <Section title="2. Accounts">
          <p>
            You may create an account with an email and password or via Google sign-in, or use
            Protocol without an account in Guest mode (data stored only in your browser, not
            synced or backed up by us). You&apos;re responsible for the accuracy of the information
            you provide and for keeping your credentials secure.
          </p>
          <p>
            You must be legally capable of entering into a binding contract in your jurisdiction to
            use Protocol.
          </p>
        </Section>

        <Section title="3. Subscriptions, Trials, and Billing">
          <p>
            Protocol offers a Free plan and two paid plans, Pro and Premium Plus, billed monthly or
            annually through our payment processor, Paystack. Prices are shown in Nigerian Naira
            (NGN) on the pricing page.
          </p>
          <p>
            Protocol may offer time-limited free trials of Pro or Premium Plus. Each trial type may
            only be used once per account. Unless you cancel or your trial is a Pro-to-Premium-Plus
            trial that expires (in which case you return to your existing Pro plan), your plan will
            automatically revert to Free once a trial ends.
          </p>
          <p>
            Paid subscriptions renew automatically at the end of each billing period unless
            cancelled beforehand. You can cancel anytime; cancellation takes effect at the end of
            the current billing period, and we don&apos;t provide prorated refunds for partial
            periods except where required by law.
          </p>
        </Section>

        <Section title="4. Acceptable Use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Use Protocol for any unlawful purpose or in violation of any applicable law.</li>
            <li>Attempt to gain unauthorized access to any part of Protocol, other accounts, or our systems.</li>
            <li>Interfere with or disrupt the integrity or performance of Protocol.</li>
            <li>Reverse engineer, decompile, or attempt to extract the source code of Protocol, except as permitted by law.</li>
            <li>Use automated means (bots, scrapers) to access Protocol without our written permission.</li>
          </ul>
        </Section>

        <Section title="5. Your Content and Data">
          <p>
            You retain ownership of the habit, tracking, and other data you input into Protocol.
            You grant us a limited license to store, process, and display that data solely to
            provide the service to you. See our{" "}
            <Link href="/privacy" className="text-foreground underline underline-offset-2">
              Privacy Policy
            </Link>{" "}
            for how we handle your data.
          </p>
        </Section>

        <Section title="6. Referrals">
          <p>
            Protocol&apos;s referral program may grant free access rewards for successful referrals,
            subject to the terms shown in the referrals section of the app. We reserve the right to
            withhold or reverse rewards obtained through fraud, abuse, or violation of these Terms.
          </p>
        </Section>

        <Section title="7. Termination">
          <p>
            You may delete your account at any time from the profile menu; this permanently removes
            your habit data, history, and account record. We may suspend or terminate your access if
            you violate these Terms, engage in fraudulent activity, or misuse Protocol.
          </p>
        </Section>

        <Section title="8. Disclaimers">
          <p>
            Protocol is provided &quot;as is&quot; and &quot;as available&quot; without warranties
            of any kind, express or implied. Protocol is a personal productivity and
            habit-tracking tool — it is not medical, psychological, financial, or professional
            advice, and shouldn&apos;t be treated as a substitute for professional guidance on
            habits, addiction, or mental health.
          </p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, Protocol and its operators will not be liable
            for any indirect, incidental, special, consequential, or punitive damages, or any loss
            of data, arising from your use of, or inability to use, Protocol.
          </p>
        </Section>

        <Section title="10. Changes to These Terms">
          <p>
            We may update these Terms from time to time. If we make material changes, we&apos;ll
            update the &quot;Last updated&quot; date above. Continued use of Protocol after changes
            take effect constitutes acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Questions about these Terms? Reach us at{" "}
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

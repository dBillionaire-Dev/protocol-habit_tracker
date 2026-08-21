"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail, Phone, MessageCircle, Code2, Bug, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LayoutShell } from "@/components/layout-shell";
import { useSendChatMessage } from "@/hooks/use-support-chat";
import type { ChatMessage } from "@/lib/gemini-types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
const DEVELOPER_EMAIL = process.env.NEXT_PUBLIC_DEVELOPER_EMAIL;

const FAQ_ITEMS = [
  { q: "How does PROTOCOL work?", a: "You create protocols, either Build (a positive habit tracked toward a daily target) or Avoid (a habit to avoid entirely). Each day, during the confirmation window, you log your progress. Streaks, penalties, and debt track your consistency over time." },
  { q: "How do Build protocols work?", a: "Set a daily target amount and unit (e.g. 2 hours of coding). Each day you mark it completed or missed. Missing a day increases the next day's required amount, the penalty stacks until you complete it again." },
  { q: "How do Avoid protocols work?", a: "Log an event any time you slip. Any day with zero logged events is a clean day. Confirming a clean day during the window reduces your debt by 1; each violation adds 1." },
  { q: "How are streaks calculated?", a: "For Build, a streak is consecutive completed days, missing a day resets it to zero. For Avoid, a streak grows each time you explicitly confirm a clean day." },
  { q: "How do penalties work?", a: "Build penalties stack based on days since you last completed the protocol. The longer you miss, the more is required the next time. This is separate from debt." },
  { q: "What happens when I miss a protocol?", a: "Build: it's marked missed, and tomorrow's requirement increases. Avoid: a logged violation adds 1 to that protocol's debt." },
  { q: "How do I upgrade?", a: "Open the profile menu (top right) and choose \"Upgrade Plan\", or visit the Pricing page directly." },
  { q: "How do I cancel?", a: "Open the profile menu and choose \"Manage Subscription\". You'll keep access until your current billing period ends." },
  { q: "How do I restore my subscription?", a: "If a payment failed, updating your card with Paystack and completing the next charge automatically restores active status. Contact Email Support if it doesn't resolve." },
  { q: "How do I export my data?", a: "Pro and Premium Plus users can export their full history as CSV from the History page." },
  { q: "How do I delete my account?", a: "Open the profile menu and choose \"Delete Account\". This is permanent and cannot be undone." },
];

const BUG_CATEGORIES = ["Bug", "Crash", "Data issue", "Billing", "UI/Design", "Other"];

export default function SupportPage() {
  return (
    <LayoutShell>
      <div className="space-y-8 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold tracking-tight">Support</h1>

        <FaqCard />
        <EmailSupportCard />
        <PhoneSupportCard />
        <LiveChatCard />
        <DeveloperContactCard />
        <BugReportCard />
      </div>
    </LayoutShell>
  );
}

function FaqCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Help Center / FAQ</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible>
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function EmailSupportCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-4 h-4" />
          Email Support
        </CardTitle>
        <CardDescription>Need help with PROTOCOL?</CardDescription>
      </CardHeader>
      <CardContent>
        {SUPPORT_EMAIL ? (
          <Button asChild variant="outline">
            <a href={`mailto:${SUPPORT_EMAIL}`}>Email Support</a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Email support isn't configured yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PhoneSupportCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Phone Support
        </CardTitle>
      </CardHeader>
      <CardContent>
        {SUPPORT_PHONE ? (
          <Button asChild variant="outline">
            <a href={`tel:${SUPPORT_PHONE}`}>Call Support</a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Phone support coming soon.</p>
        )}
      </CardContent>
    </Card>
  );
}

function LiveChatCard() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const { mutate: sendMessage, isPending, error } = useSendChatMessage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const code = (error as (Error & { code?: string }) | null)?.code;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isPending) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");

    sendMessage(next, {
      onSuccess: (data) => {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      },
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Live Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {code === "AI_NOT_CONFIGURED" ? (
          <p className="text-sm text-muted-foreground">Live chat coming soon.</p>
        ) : (
          <>
            {messages.length > 0 && (
              <div ref={scrollRef} className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "text-sm rounded-lg px-3 py-2 max-w-[85%]",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted",
                    )}
                  >
                    {m.content}
                  </div>
                ))}
                {isPending && (
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm w-fit">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  </div>
                )}
              </div>
            )}
            {code === "AI_ERROR" && (
              <p className="text-xs text-destructive">Something went wrong, try again, or use Email Support above.</p>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Ask a question about PROTOCOL..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={isPending}
              />
              <Button size="icon" onClick={handleSend} disabled={isPending || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DeveloperContactCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Code2 className="w-4 h-4" />
          Developer / Technical Contact
        </CardTitle>
        <CardDescription>
          For technical problems, security concerns, API questions, bug reports, or developer collaboration.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {DEVELOPER_EMAIL ? (
          <Button asChild variant="outline">
            <a href={`mailto:${DEVELOPER_EMAIL}`}>Contact Developer</a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Developer contact isn't configured yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function BugReportCard() {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Bug");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [email, setEmail] = useState("");

  const { mutate: submitTicket, isPending, isSuccess, error } = useMutation({
    mutationFn: async () => {
      const browserInfo = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
      const message = [
        `Description: ${description}`,
        steps.trim() && `Steps to reproduce: ${steps}`,
        expected.trim() && `Expected behavior: ${expected}`,
        actual.trim() && `Actual behavior: ${actual}`,
        `Browser/device: ${browserInfo}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const res = await apiFetch("/api/support/tickets", {
        method: "POST",
        body: JSON.stringify({ email: email || user?.email || "", category, subject, message }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Failed to send report");
      }
      return res.json();
    },
  });

  const canSubmit = subject.trim().length > 0 && description.trim().length > 0 && !isPending;

  if (isSuccess) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bug className="w-4 h-4" />
            Report a Bug
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Thanks -- your report is in. We'll follow up by email if you left one.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bug className="w-4 h-4" />
          Report a Bug
        </CardTitle>
        <CardDescription>
          Sent straight to our team, no email client required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUG_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        <Textarea placeholder="Steps to reproduce" value={steps} onChange={(e) => setSteps(e.target.value)} rows={2} />
        <Textarea placeholder="Expected behavior" value={expected} onChange={(e) => setExpected(e.target.value)} rows={2} />
        <Textarea placeholder="Actual behavior" value={actual} onChange={(e) => setActual(e.target.value)} rows={2} />
        {!user?.email && (
          <Input
            type="email"
            placeholder="Your email (optional, so we can follow up)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
        <Button onClick={() => submitTicket()} disabled={!canSubmit}>
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Report"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Lock, Lightbulb, Target, Loader2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { LayoutShell } from "@/components/layout-shell";
import { useAiInsights, useAiPlan, type PlanSuggestion } from "@/hooks/use-ai";
import { useCreateHabit } from "@/hooks/use-habits";
import { useBillingStatus } from "@/hooks/use-billing";
import { hasFeature } from "@/lib/entitlements";

export default function AiPage() {
  const { data: billing } = useBillingStatus();
  const plan = billing?.plan ?? "free";
  const isEntitled = hasFeature(plan, "ai_insights");

  if (!isEntitled) {
    return (
      <LayoutShell>
        <div className="max-w-md mx-auto text-center py-16 space-y-4">
          <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-bold">AI features are Premium Plus</h1>
          <p className="text-sm text-muted-foreground">
            AI Discipline Insights and AI Protocol Planning are available
            on the Premium Plus plan.
          </p>
          <Button asChild>
            <Link href="/pricing">View Plans</Link>
          </Button>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="space-y-8 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          AI
        </h1>
        <InsightsSection />
        <PlanningSection />
      </div>
    </LayoutShell>
  );
}

function InsightsSection() {
  const [enabled, setEnabled] = useState(true);
  const { data, isLoading, error, refetch, isFetching } = useAiInsights(enabled);
  const code = (error as (Error & { code?: string }) | null)?.code;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          AI Discipline Insights
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setEnabled(true); refetch(); }}
          disabled={isLoading || isFetching}
        >
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Analyzing your data...</p>}

        {code === "AI_NOT_CONFIGURED" && (
          <p className="text-sm text-muted-foreground">
            AI features aren't configured on this deployment yet.
          </p>
        )}
        {code === "AI_ERROR" && (
          <p className="text-sm text-destructive">
            Couldn't generate insights right now, try again in a moment.
          </p>
        )}

        {data?.message && (
          <p className="text-sm text-muted-foreground">{data.message}</p>
        )}

        {data && data.insights.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Insights</p>
            <ul className="space-y-1.5">
              {data.insights.map((s, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data && data.recommendations.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Recommendations</p>
            <ul className="space-y-1.5">
              {data.recommendations.map((s, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <Target className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlanningSection() {
  const [goal, setGoal] = useState("");
  const { mutate: generatePlan, data, isPending, error } = useAiPlan();
  const { mutateAsync: createHabit } = useCreateHabit();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const code = (error as (Error & { code?: string }) | null)?.code;

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleCreateSelected() {
    if (!data) return;
    setCreating(true);
    try {
      for (const index of Array.from(selected)) {
        const s = data.suggestions[index];
        await createHabit({
          name: s.name,
          type: s.type,
          baseTaskValue: s.baseTaskValue ?? undefined,
          unit: s.unit ?? undefined,
        } as any);
      }
      setCreated(true);
      setSelected(new Set());
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Target className="w-4 h-4" />
          AI Protocol Planning
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Describe a goal, and AI will suggest protocols, nothing is created until you review and confirm.
        </p>
        <Textarea
          placeholder="e.g. I want to become more disciplined with programming"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
        />
        <Button
          onClick={() => generatePlan(goal)}
          disabled={isPending || goal.trim().length < 3}
        >
          {isPending ? "Generating..." : "Suggest Protocols"}
        </Button>

        {code === "AI_NOT_CONFIGURED" && (
          <p className="text-sm text-muted-foreground">AI features aren't configured on this deployment yet.</p>
        )}
        {code === "AI_ERROR" && (
          <p className="text-sm text-destructive">Couldn't generate a plan right now. Try again shortly.</p>
        )}

        {data && data.suggestions.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-border">
            {data.suggestions.map((s, i) => (
              <label
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover-elevate"
              >
                <Checkbox
                  checked={selected.has(i)}
                  onCheckedChange={() => toggle(i)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{s.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {s.type}
                    </span>
                  </div>
                  {s.type === "build" && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.baseTaskValue} {s.unit} — {s.frequency}
                    </p>
                  )}
                  {s.type === "avoidance" && (
                    <p className="text-xs text-muted-foreground mt-0.5">{s.frequency}</p>
                  )}
                  {s.frequency && s.frequency.toLowerCase() !== "daily" && (
                    <p className="text-[11px] text-amber-500 mt-0.5">
                      Note: custom scheduling isn't supported yet, this will be created as a standard daily protocol.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 italic">{s.rationale}</p>
                </div>
              </label>
            ))}

            <Button
              className="w-full"
              onClick={handleCreateSelected}
              disabled={selected.size === 0 || creating}
            >
              {creating ? (
                "Creating..."
              ) : created ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Created
                </>
              ) : (
                `Create Selected (${selected.size})`
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

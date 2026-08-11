"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { insertHabitSchema } from "shared/schema";
import { useCreateHabit, ApiError } from "@/hooks/use-habits";
import { useStartCheckout } from "@/hooks/use-billing";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["avoidance", "build"]),
  baseTaskValue: z.coerce.number().optional(),
  unit: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type LimitReason = "plan" | "guest" | null;

export function CreateHabitDialog() {
  const [open, setOpen] = useState(false);
  const [limitReason, setLimitReason] = useState<LimitReason>(null);
  const { mutateAsync: createHabit, isPending } = useCreateHabit();
  const { mutate: startCheckout, isPending: isCheckingOut } = useStartCheckout();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "build",
      baseTaskValue: 10,
      unit: "reps",
    },
  });

  const habitType = form.watch("type");

  async function onSubmit(data: FormValues) {
    try {
      // @ts-ignore
      await createHabit(data);
      setOpen(false);
      setLimitReason(null);
      form.reset();
    } catch (error) {
      if (error instanceof ApiError && error.code === "PLAN_LIMIT_REACHED") {
        setLimitReason("plan");
      } else if (error instanceof ApiError && error.code === "GUEST_LIMIT_REACHED") {
        setLimitReason("guest");
      } else {
        console.error(error);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setLimitReason(null); }}>
      <DialogTrigger asChild>
        <button
          className="w-full border border-dashed border-border rounded-lg p-4 text-center hover-elevate transition-all cursor-pointer flex items-center justify-center gap-2 bg-white text-black dark:bg-white dark:text-black"
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium">Initialize Protocol</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="p-6 pb-4 shrink-0">
          <DialogTitle>
            {limitReason === "plan"
              ? "Free Plan Limit Reached"
              : limitReason === "guest"
                ? "Guest Limit Reached"
                : "New Protocol"}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto min-h-0 px-6 pb-6">
        {limitReason === "plan" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The free plan supports up to 3 active protocols. Upgrade to
              Pro for unlimited protocols, streak analytics, and data
              export.
            </p>
            <Button
              className="w-full"
              onClick={() => startCheckout()}
              disabled={isCheckingOut}
            >
              {isCheckingOut ? "Redirecting..." : "Upgrade to Pro"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setLimitReason(null)}
            >
              Back
            </Button>
          </div>
        ) : limitReason === "guest" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Guest sessions are limited to 1 protocol, so you can try
              PROTOCOL out. Create a free account to track up to 3
              protocols (or go Pro for unlimited). Nothing you've set up
              as a guest carries over automatically, so make a note of it
              first if you want to recreate it.
            </p>
            <Button
              className="w-full"
              onClick={() => { window.location.href = "/"; }}
            >
              Create Free Account
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setLimitReason(null)}
            >
              Back
            </Button>
          </div>
        ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Protocol Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Morning Run, No Sugar" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="avoidance">Avoidance (Debt Tracker)</SelectItem>
                      <SelectItem value="build">Build (Stacking Penalty)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {field.value === "avoidance"
                      ? "Tracks bad habits. Missed days accumulate debt."
                      : "Tracks good habits. Missing a day increases the requirement."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {habitType === "build" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="baseTaskValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Amount</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <Input placeholder="reps, mins..." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <Button type="submit" className="w-full mt-4" disabled={isPending}>
              {isPending ? "Initializing..." : "Create Protocol"}
            </Button>
          </form>
        </Form>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertHabitSchema, HABIT_TYPES } from "@shared/schema";
import { useCreateHabit } from "@/hooks/use-habits";
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
import { Plus } from "lucide-react";
import { z } from "zod";

const formSchema = insertHabitSchema.extend({
  baseTaskValue: z.coerce.number().optional(), // Ensure number coercion
});

type FormValues = z.infer<typeof formSchema>;

export function CreateHabitDialog() {
  const [open, setOpen] = useState(false);
  const { mutateAsync: createHabit, isPending } = useCreateHabit();

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
      await createHabit(data);
      setOpen(false);
      form.reset();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button 
          className="w-full border border-dashed border-border rounded-lg p-6 text-center hover-elevate transition-all cursor-pointer flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
          data-testid="button-new-habit"
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium">New Habit</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Protocol</DialogTitle>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}

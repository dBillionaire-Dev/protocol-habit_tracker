import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { resolveUser } from "@/lib/auth/require-user";
import { hasFeature } from "@/lib/entitlements";
import { updateHabitSchema, FREE_PLAN_HABIT_EDIT_WINDOW_MS } from "shared/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const habit = await storage.getHabit(Number(id));
  if (!habit) {
    return NextResponse.json({ message: "Habit not found" }, { status: 404 });
  }
  if (habit.userId !== user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(habit);
}

// Free-plan users can only edit a habit within 20 minutes of creating it
// (enforced here, server-side — never trust a hidden/disabled button
// alone). Pro and Premium Plus have no such restriction. This check is
// server-authoritative: a request can't bypass it by skipping the UI.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const habit = await storage.getHabit(Number(id));
  if (!habit) {
    return NextResponse.json({ message: "Habit not found" }, { status: 404 });
  }
  if (habit.userId !== user.id) {
    return NextResponse.json(
      { message: "You are not authorized to modify this protocol." },
      { status: 401 },
    );
  }

  const plan = await storage.getEffectivePlan(user.id, user.isSuperUser);
  if (!hasFeature(plan, "unrestricted_habit_editing")) {
    const createdMs = new Date(habit.createdAt).getTime();
    if (Date.now() - createdMs > FREE_PLAN_HABIT_EDIT_WINDOW_MS) {
      return NextResponse.json(
        {
          message:
            "Editing is only available within 20 minutes of creating a protocol on the Free plan. Upgrade to Pro or Premium Plus to edit anytime.",
          code: "EDIT_WINDOW_EXPIRED",
        },
        { status: 403 },
      );
    }
  }

  try {
    const body = updateHabitSchema.parse(await request.json());
    const updated = await storage.updateHabit(Number(id), user.id, body);
    return NextResponse.json(updated);
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json(
        { message: "You are not authorized to modify this protocol." },
        { status: 401 },
      );
    }
    console.error("Error updating habit:", error);
    return NextResponse.json({ message: "Failed to update protocol" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await storage.deleteHabit(Number(id), user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ message: "Habit not found" }, { status: 404 });
  }
}

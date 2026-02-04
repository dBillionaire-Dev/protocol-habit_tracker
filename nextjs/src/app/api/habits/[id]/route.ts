import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

const GUEST_USER_ID = "guest-demo-user";

function getUserId(): string | null {
  return GUEST_USER_ID;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  
  try {
    await storage.deleteHabit(Number(id), userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { message: "Habit not found" },
      { status: 404 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const body = await request.json();

  try {
    // Determine which action based on the request
    if (body.date !== undefined && body.completed !== undefined) {
      // Complete daily task
      const result = await storage.completeDailyTask(Number(id), body.date, body.completed);
      return NextResponse.json(result);
    } else if (body.date !== undefined) {
      // Confirm clean day
      const result = await storage.confirmCleanDay(Number(id), body.date);
      return NextResponse.json({ debt: result.debt, message: "Clean day confirmed" });
    } else if (body.notes !== undefined) {
      // Log event
      const event = await storage.logHabitEvent(Number(id), body.notes);
      return NextResponse.json(event, { status: 201 });
    }
    
    return NextResponse.json(
      { message: "Invalid request" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error processing habit action:", error);
    return NextResponse.json(
      { message: "Failed to process action" },
      { status: 500 }
    );
  }
}

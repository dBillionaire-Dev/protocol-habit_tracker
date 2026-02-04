import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { storage } from "@/lib/storage";

const GUEST_USER_ID = "guest-demo-user";

function getUserId(): string | null {
  // This is simplified - in production, you'd use proper session handling
  return GUEST_USER_ID;
}

export async function GET(request: NextRequest) {
  const userId = getUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const habits = await storage.getHabits(userId);
    return NextResponse.json(habits);
  } catch (error) {
    console.error("Error fetching habits:", error);
    return NextResponse.json(
      { message: "Failed to fetch habits" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = getUserId();
  if (!userId) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const habit = await storage.createHabit(userId, body);
    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    console.error("Error creating habit:", error);
    return NextResponse.json(
      { message: "Failed to create habit" },
      { status: 500 }
    );
  }
}

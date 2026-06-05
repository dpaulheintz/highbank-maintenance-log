import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Email notifications have been removed" }, { status: 410 });
}

import { NextResponse } from "next/server";
import { getCurriculum } from "@/lib/curriculum";

export const dynamic = "force-dynamic";

export async function GET() {
  const curriculum = await getCurriculum();
  return NextResponse.json(curriculum);
}

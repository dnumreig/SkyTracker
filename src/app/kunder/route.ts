import { readFileSync } from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Serves the page «Kunder» (R16): COO's deliveries, one row per customer waiting on one, and the editor that makes them.
// Vanilla HTML/JS like the timeline and the intake, same Entra login, same plan API (the deliveries live in the plan JSON).
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) redirect("/login");
  const html = readFileSync(path.join(process.cwd(), "src/app/kunder/kunder.html"), "utf8");
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

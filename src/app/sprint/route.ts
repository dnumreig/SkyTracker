import { readFileSync } from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Serves the page «Sprint» (R19): the plan against the sprint for produktforum: app health with its trend and forecasts, the
// next sprint's budget and what the timeline expects to start in it, the current sprint. Vanilla HTML/JS like Kunder, same
// Entra login, same plan API; the ADO read it refreshes is cached in the plan (`sprintCheck`) and open to readers (D1).
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) redirect("/login");
  const html = readFileSync(path.join(process.cwd(), "src/app/sprint/sprint.html"), "utf8");
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

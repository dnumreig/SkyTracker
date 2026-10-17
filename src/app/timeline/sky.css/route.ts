import { readFileSync } from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Serves the shared stylesheet of the four plain pages (R17). The pages link it as timeline/sky.css, next to
// epic-tools.js, so one copy of the tokens and controls exists instead of four kept in step by hand.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) redirect("/login");
  const css = readFileSync(path.join(process.cwd(), "src/features/timeline/sky.css"), "utf8");
  return new Response(css, { headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "no-store" } });
}

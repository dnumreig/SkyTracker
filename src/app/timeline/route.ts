import { readFileSync } from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Serves the self-contained timeline tool (vanilla HTML/JS, no React) behind
// the same Entra login as the rest of SkyTracker. The tool detects it is not
// running from file:// and fetches live data from /api/timeline-export.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) redirect("/login");
  const html = readFileSync(
    path.join(process.cwd(), "src/app/timeline/timeline.html"),
    "utf8",
  );
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

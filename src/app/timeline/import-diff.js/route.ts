import { readFileSync } from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Serves the shared smart-import module to the hosted timeline tool. The same
// file is imported by vitest and copied next to the local gantt.html, so the
// browser and the tests always run identical diff logic.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session) redirect("/login");
  const js = readFileSync(
    path.join(process.cwd(), "src/features/timeline/import-diff.js"),
    "utf8",
  );
  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

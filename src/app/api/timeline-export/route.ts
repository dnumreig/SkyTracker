import { auth } from "@/lib/auth";
import { getBoardWithContents } from "@/features/board/queries";
import { buildTimelinePayload } from "@/features/timeline/schedule";

// Same-origin data feed for the timeline tool at /timeline.
// Middleware already gates this route behind Entra login; the auth() check
// here turns an unauthenticated fetch into a clean 401 instead of a redirect.
export async function GET() {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { board, columns, dependencies } = await getBoardWithContents();
  const payload = buildTimelinePayload(board.name, columns, dependencies, new Date());
  return Response.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}

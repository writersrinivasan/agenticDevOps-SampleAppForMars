import { runBooking } from "@/lib/agents";
import { ndjson } from "@/lib/stream";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const input = await req.json().catch(() => ({}));
  return ndjson((emit) => runBooking(input, emit));
}

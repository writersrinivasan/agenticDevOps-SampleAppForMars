import { runPipeline } from "@/lib/devops";
import { ndjson } from "@/lib/stream";

export const dynamic = "force-dynamic";

export async function POST() {
  return ndjson((emit) => runPipeline(emit));
}

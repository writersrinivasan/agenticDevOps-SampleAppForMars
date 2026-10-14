import { retrieve, KB, VOCAB_SIZE, contextBlock } from "@/lib/rag";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ kb: KB, vocab: VOCAB_SIZE });
}

export async function POST(req) {
  const { query = "", k = 3 } = await req.json().catch(() => ({}));
  const r = retrieve(query, k, "rag-explorer");
  const augmented = `SYSTEM: Answer using ONLY the context below.\n\nCONTEXT:\n${contextBlock(r.hits)}\n\nUSER: ${query}`;
  return Response.json({ ...r, augmented });
}

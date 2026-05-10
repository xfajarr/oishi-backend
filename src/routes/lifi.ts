import { Hono } from "hono";
import { z } from "zod";

/** Li.F.I public quote endpoint (recommended for lightweight / server integrations). */
const LIFI_QUOTE = "https://li.quest/v1/quote";

const quoteQuerySchema = z.object({
  fromChain: z.string().min(1),
  toChain: z.string().min(1),
  fromToken: z.string().min(1),
  toToken: z.string().min(1),
  fromAmount: z.string().min(1),
  fromAddress: z.string().optional(),
  toAddress: z.string().optional(),
  order: z.enum(["CHEAPEST", "FASTEST"]).optional(),
});

export const lifiRouter = new Hono();

lifiRouter.get("/quote", async (c) => {
  const parsed = quoteQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Invalid quote query", issues: parsed.error.flatten() }, 400);
  }

  const q = parsed.data;
  const url = new URL(LIFI_QUOTE);
  url.searchParams.set("integrator", process.env.LIFI_INTEGRATOR ?? "oishi");
  url.searchParams.set("fromChain", q.fromChain);
  url.searchParams.set("toChain", q.toChain);
  url.searchParams.set("fromToken", q.fromToken);
  url.searchParams.set("toToken", q.toToken);
  url.searchParams.set("fromAmount", q.fromAmount);
  url.searchParams.set("order", q.order ?? "CHEAPEST");
  if (q.fromAddress?.trim()) url.searchParams.set("fromAddress", q.fromAddress.trim());
  if (q.toAddress?.trim()) url.searchParams.set("toAddress", q.toAddress.trim());

  const headers: Record<string, string> = { Accept: "application/json" };
  const key = process.env.LIFI_API_KEY;
  if (key) headers["x-lifi-api-key"] = key;

  const res = await fetch(url.toString(), { headers });
  const bodyText = await res.text();

  try {
    const json = JSON.parse(bodyText) as unknown;
    return Response.json(json, { status: res.status });
  } catch {
    const status = res.status >= 400 ? res.status : 502;
    return new Response(bodyText || "upstream error", { status });
  }
});

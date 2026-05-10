import { Hono } from "hono";
import { getLlmModel } from "../llm/client";

export const healthRouter = new Hono();

healthRouter.get("/", (c) => {
  return c.json({
    status: "ok",
    timestamp: Date.now(),
    llmModel: getLlmModel(),
    uptime: process.uptime(),
  });
});

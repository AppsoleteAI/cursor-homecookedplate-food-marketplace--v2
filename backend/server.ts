import { serve } from "@hono/node-server";
import app from "./hono";

const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Starting backend server on port ${port}`);
console.log(`📍 API will be available at: http://localhost:${port}`);
console.log(`📍 tRPC endpoint: http://localhost:${port}/api/trpc`);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`✅ Server is running on http://localhost:${info.port}`);
});

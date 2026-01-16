import { stdout } from "node:process";
import app from "./hono";

/**
 * Critical logs must use process.stdout.write to bypass Bun buffering.
 * Use this in your tRPC middleware or critical signup paths.
 * In Bun environments, console.log can be buffered by the OS, so this
 * forces immediate output by writing directly to stdout.
 */
export const flushLog = (message: string) => {
  // Use process.stdout.write directly for critical logs (bypasses Bun buffering)
  process.stdout.write(message + '\n');
};

// #region agent log - HYPOTHESIS A, C: Check env vars and port at server start
fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/server.ts:SERVER_START',message:'Server starting - checking environment',data:{port:Number(process.env.PORT)||3000,hasSupabaseUrl:!!process.env.SUPABASE_URL,hasServiceKey:!!process.env.SUPABASE_SERVICE_ROLE_KEY,hasAnonKey:!!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'server-start',hypothesisId:'A,C'})}).catch(()=>{});
// #endregion

const port = Number(process.env.PORT) || 3000;

// Force terminal logs to appear immediately
process.stdout.write("--- LOG FLUSH ACTIVE (process.stdout.write) ---\n");

flushLog(`🚀 [${new Date().toLocaleTimeString()}] V4 Server Live on Port ${port}`);
console.log(`📍 API will be available at: http://localhost:${port}`);
console.log(`📍 tRPC endpoint: http://localhost:${port}/api/trpc`);

// Use Bun's native serve instead of @hono/node-server for better compatibility
// hostname: "0.0.0.0" is REQUIRED to listen on all interfaces (LAN access for emulators)
const server = Bun.serve({
  port,
  hostname: "0.0.0.0",
  fetch: app.fetch,
});

// #region agent log - HYPOTHESIS C: Server started successfully
fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/server.ts:SERVER_READY',message:'Server started successfully with Bun.serve',data:{port:server.port,hostname:server.hostname},timestamp:Date.now(),sessionId:'debug-session',runId:'server-start',hypothesisId:'C'})}).catch(()=>{});
// #endregion

console.log(`✅ Server is running on http://${server.hostname}:${server.port}`);

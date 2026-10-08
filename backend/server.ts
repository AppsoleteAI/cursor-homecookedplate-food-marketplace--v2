import { app } from "./hono";

declare const Bun: {
  serve(options: {
    port: number;
    hostname: string;
    fetch: typeof app.fetch;
  }): { hostname: string; port: number };
};

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


console.log(`✅ Server is running on http://${server.hostname}:${server.port}`);

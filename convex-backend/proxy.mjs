// Dual-stack TCP forwarder: [::]:LISTEN_PORT -> 127.0.0.1:TARGET_PORT.
//
// Laravel Cloud health-checks and routes over IPv6, but convex-local-backend's
// --interface only accepts an IPv4 address. Forwarding raw TCP keeps HTTP,
// keep-alive and WebSocket sync connections untouched.
import net from "node:net";

const listenPort = Number(process.env.LISTEN_PORT);
const targetPort = Number(process.env.TARGET_PORT);
const targetHost = process.env.TARGET_HOST ?? "127.0.0.1";

const server = net.createServer((client) => {
  const upstream = net.connect(targetPort, targetHost);
  client.setNoDelay(true);
  upstream.setNoDelay(true);
  client.pipe(upstream).pipe(client);
  // Backend not up yet or restarting: drop the client instead of hanging.
  client.on("error", () => upstream.destroy());
  upstream.on("error", () => client.destroy());
});

// ipv6Only: false makes "::" accept IPv4-mapped connections too.
server.listen({ host: "::", port: listenPort, ipv6Only: false }, () => {
  console.log(`proxy: [::]:${listenPort} -> ${targetHost}:${targetPort}`);
});

import { lookup } from "node:dns/promises";
import { get } from "node:https";
import { BlockList } from "node:net";

const ranges = new BlockList();
for (const [base, mask] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  ranges.addSubnet(base, mask, "ipv4");
}

export async function remoteContent(
  url: URL,
  limit: number,
  accept?: string,
  redirects = 0,
): Promise<Buffer> {
  if (
    url.protocol !== "https:" ||
    (url.port && url.port !== "443") ||
    url.username ||
    url.password
  ) {
    throw new Error("External sources require HTTPS");
  }
  const { address } = await lookup(url.hostname, { family: 4 });
  if (ranges.check(address, "ipv4"))
    throw new Error("External source must use a public address");
  const response = await new Promise<Buffer | URL>((resolve, reject) => {
    const request = get(
      {
        hostname: address,
        servername: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        headers: {
          host: url.hostname,
          "user-agent": "BeendFila/1.0 (https://fila.beend.tech)",
          ...(accept ? { accept } : {}),
        },
        signal: AbortSignal.timeout(6000),
        agent: false,
      },
      (stream) => {
        const status = stream.statusCode ?? 500;
        if (
          status >= 300 &&
          status < 400 &&
          stream.headers.location &&
          redirects < 2
        ) {
          stream.resume();
          try {
            resolve(new URL(stream.headers.location, url));
          } catch (error) {
            reject(error);
          }
          return;
        }
        if (status < 200 || status >= 300) {
          stream.resume();
          reject(new Error("External source returned an error"));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > limit) {
            request.destroy(new Error("External response too large"));
            return;
          }
          chunks.push(chunk);
        });
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
      },
    );
    request.on("error", reject);
  });
  return response instanceof URL
    ? remoteContent(response, limit, accept, redirects + 1)
    : response;
}

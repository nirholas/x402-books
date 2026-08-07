# Exposing x402-books as an MCP tool

[MCP](https://modelcontextprotocol.io) lets Claude (and other MCP clients) call
this service directly. The wrapper below holds the wallet, pays the x402
invoice, and hands the artifact straight back to the model.

## Minimal server

```ts
// mcp-x402-books.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSigner, wrapFetchWithPayment } from "x402-fetch";
import { z } from "zod";

const BASE_URL = process.env.BOOKS_URL ?? "http://localhost:4025";

const signer = await createSigner("base-sepolia", process.env.PRIVATE_KEY!);
const payFetch = wrapFetchWithPayment(fetch, signer);

const server = new McpServer({ name: "x402-books", version: "0.1.0" });

server.tool(
  "search_books",
  "Search books on OpenLibrary, annotated with full-text availability",
  {
    q: z.string().describe("Title or free-text query, 1-200 characters."),
    author: z.string().optional().describe("Narrow to an author name."),
    limit: z.number().optional().describe("Maximum editions to return, 1…20. Default 10."),
  },
  async (args) => {
    const url = new URL(`${BASE_URL}/search`);
    url.searchParams.set("q", args.q);
    if (args.author) url.searchParams.set("author", args.author);
    if (args.limit) url.searchParams.set("limit", String(args.limit));
    const res = await payFetch(url);
    if (!res.ok) throw new Error(`GET /search → ${res.status}`);
    return { content: [{ type: "text", text: JSON.stringify(await res.json(), null, 2) }] };
  },
);

server.tool(
  "read_book",
  "Buy the complete public-domain book as chaptered markdown",
  {
    gutenbergId: z.number().describe("Project Gutenberg ebook number — the `gutenberg.gutenbergId` from `/search`, or the number in a `gutenberg.org/ebooks/N` URL. `84` is Frankenstein."),
  },
  async (args) => {
    const url = `${BASE_URL}/read/${args.gutenbergId}`;
    const res = await payFetch(url);
    if (!res.ok) throw new Error(`GET /read/:gutenbergId → ${res.status}`);
    return { content: [{ type: "text", text: JSON.stringify(await res.json(), null, 2) }] };
  },
);

await server.connect(new StdioServerTransport());
```

## Wire it into Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "x402-books": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-x402-books.ts"],
      "env": {
        "PRIVATE_KEY": "0xYourFundedTestKey",
        "BOOKS_URL": "http://localhost:4025"
      }
    }
  }
}
```

## Spending caps

Each GET /search call costs $0.001. Wrap `payFetch` with a
budget so a runaway loop cannot drain the wallet:

```ts
let spentMicros = 0;
const CAP_MICROS = 1_000_000; // $1.00

const cappedFetch: typeof fetch = async (input, init) => {
  if (spentMicros >= CAP_MICROS) throw new Error("x402 spend cap reached");
  const res = await payFetch(input, init);
  const receipt = res.headers.get("X-PAYMENT-RESPONSE");
  if (receipt) {
    const { amount } = JSON.parse(Buffer.from(receipt, "base64").toString());
    spentMicros += Number(amount ?? 0);
  }
  return res;
};
```

## Notes

- The tool descriptions above come from [`skill.md`](../skill.md) — keep them in
  sync so the model knows exactly what it is buying.
- Paying on Solana instead? Swap `x402-fetch` for a Solana x402 client; the 402
  challenge already advertises the `solana` rail, so nothing on this
  server changes.
- Discovery for autonomous agents: [`/.well-known/x402`](../public/.well-known/x402).

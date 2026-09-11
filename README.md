# @elopstudio/ai-wave-mcp

MCP server for [AI Wave](https://aiwave.elopstudio.com) — a normalized feed of AI model
releases, price changes, API changes and deprecations, assembled from vendor release notes,
Hugging Face, the OpenRouter catalog and GitHub.

## Why

Picking a model? Call the OpenRouter catalog directly — it is free and public.

This is for the other question: **did anything I depend on change?** New releases, price
moves, and models being withdrawn, in one feed, deduplicated per model, each marked
official or pending review.

## Setup

Get a key at https://aiwave.elopstudio.com/member, then:

```json
{
  "mcpServers": {
    "ai-wave": {
      "command": "npx",
      "args": ["-y", "@elopstudio/ai-wave-mcp"],
      "env": { "AIWAVE_API_KEY": "aiw_live_..." }
    }
  }
}
```

If your client supports remote MCP, prefer that — no install, always current:

```json
{
  "mcpServers": {
    "ai-wave": {
      "type": "http",
      "url": "https://aiwave.elopstudio.com/api/mcp",
      "headers": { "Authorization": "Bearer aiw_live_..." }
    }
  }
}
```

## Tools

| Tool | What it answers |
| --- | --- |
| `list_model_changes` | What changed since I last checked? Poll with `since`, feed back `latest`. |
| `get_model` | Price, context and catalog status for one model (OpenRouter or Hugging Face id). |
| `search_models` | Which models fit this budget and context, ordered by current attention? |

## Limits

Free tier: 1,000 calls/day. Remaining calls come back in `x-ratelimit-remaining`.

This package is a thin stdio wrapper around the remote endpoint — tool definitions live on
the server, so you get new tools without updating it.

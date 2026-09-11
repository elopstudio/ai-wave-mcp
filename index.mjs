#!/usr/bin/env node
/**
 * AI Wave MCP 서버 (로컬 실행용).
 *
 * 원격 엔드포인트(`/api/mcp`)를 stdio 로 감싸기만 한다. 도구 정의와 조회는
 * 서버에 있으므로 여기서 다시 쓰지 않는다 — 두 벌을 유지하면 반드시 어긋난다.
 * 사용자가 이 패키지를 업데이트하지 않아도 도구가 최신인 이유다.
 *
 * 사내망처럼 원격을 직접 못 붙이는 환경을 위해 있다. 그렇지 않다면 원격을
 * 그대로 쓰는 편이 낫다.
 */
const ENDPOINT = process.env.AIWAVE_MCP_URL ?? "https://aiwave.elopstudio.com/api/mcp";
const KEY = process.env.AIWAVE_API_KEY;

if (!KEY) {
  process.stderr.write(
    "AIWAVE_API_KEY 가 없습니다. https://aiwave.elopstudio.com/member 에서 발급하세요.\n",
  );
  process.exit(1);
}

/** JSON-RPC 한 건을 원격으로 넘기고 응답을 그대로 돌려준다. */
async function forward(message) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(message),
  });

  // 알림(id 없음)은 본문이 없다.
  if (response.status === 204) return null;

  const text = await response.text();
  if (!response.ok && !text.trim().startsWith("{")) {
    return {
      jsonrpc: "2.0",
      id: message.id ?? null,
      error: { code: -32000, message: `${response.status} ${text.slice(0, 200)}` },
    };
  }
  try {
    return JSON.parse(text);
  } catch {
    return {
      jsonrpc: "2.0",
      id: message.id ?? null,
      error: { code: -32700, message: "원격 응답을 해석하지 못했습니다." },
    };
  }
}

function write(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

/**
 * stdio 는 줄 단위 JSON-RPC 다. 한 번에 여러 줄이 오거나 한 줄이 쪼개져 올 수
 * 있으므로 버퍼에 모았다가 줄바꿈에서만 자른다.
 */
let buffer = "";
/**
 * 아직 답을 못 준 요청들.
 *
 * stdin 이 닫히는 순간 종료하면 원격에 보낸 요청이 잘린다. 파이프로 여러 줄을
 * 한 번에 넣으면 바로 그렇게 되는데, 실제로 응답이 하나도 안 나왔다.
 */
const inFlight = new Set();

process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buffer += chunk;
  let index = buffer.indexOf("\n");
  while (index !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    index = buffer.indexOf("\n");
    if (!line) continue;

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }

    const pending = forward(message)
      .then((reply) => {
        if (reply !== null) write(reply);
      })
      .catch((error) => {
        write({
          jsonrpc: "2.0",
          id: message.id ?? null,
          error: { code: -32000, message: error instanceof Error ? error.message : String(error) },
        });
      })
      .finally(() => inFlight.delete(pending));
    inFlight.add(pending);
  }
});

process.stdin.on("end", async () => {
  // 보낸 요청의 답을 다 쓰고 나간다.
  while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
  process.exit(0);
});

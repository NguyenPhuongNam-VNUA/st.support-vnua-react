import 'server-only';

export class AiAgentError extends Error {
  constructor(message: string, public readonly statusCode = 502) {
    super(message);
    this.name = 'AiAgentError';
  }
}

export async function callAiAgent(path: string, init: RequestInit): Promise<Response> {
  const baseUrl = process.env.PYTHON_AGENT_BASE_URL;
  const serviceToken = process.env.AI_AGENT_SERVICE_TOKEN;
  if (!baseUrl || !serviceToken) {
    throw new AiAgentError('Python AI Agent chưa được cấu hình', 503);
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceToken}`,
      ...init.headers,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  });

  return response;
}

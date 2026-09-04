export interface AiStreamEvent {
  event: 'request.accepted' | 'pipeline.status' | 'answer.delta' | 'answer.completed' | 'answer.error';
  data: Record<string, any>;
}

type StreamHandler = (event: AiStreamEvent) => void;

async function streamAi(data: unknown, onEvent: StreamHandler, signal?: AbortSignal) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(data),
    signal,
  });
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `AI gateway returned ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || '';
    for (const frame of frames) {
      let eventName = 'message';
      const dataLines: string[] = [];
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      }
      if (!dataLines.length) continue;
      onEvent({ event: eventName as AiStreamEvent['event'], data: JSON.parse(dataLines.join('\n')) });
    }
    if (done) break;
  }
}

const aiApi = {
  streamAi,
};

export default aiApi;

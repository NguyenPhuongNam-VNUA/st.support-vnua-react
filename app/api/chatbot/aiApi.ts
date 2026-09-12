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
  let terminalReceived = false;
  const emitFrame = (frame: string) => {
    if (!frame.trim()) return;
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of frame.split(/\r?\n/)) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    if (eventName === 'answer.completed' || eventName === 'answer.error') {
      terminalReceived = true;
    }
    onEvent({ event: eventName as AiStreamEvent['event'], data: JSON.parse(dataLines.join('\n')) });
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || '';
      frames.forEach(emitFrame);
      if (done) {
        emitFrame(buffer);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!terminalReceived && !signal?.aborted) {
    throw new Error('Kết nối bị gián đoạn trước khi câu trả lời hoàn tất');
  }
}

const aiApi = {
  streamAi,
};

export default aiApi;

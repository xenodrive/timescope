import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import '../src/core/types';

type PendingResponse = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};

type Position = {
  line: number;
  offset: number;
};

type CompletionCase = {
  marker: string;
  include: string[];
  exclude: string[];
};

const require = createRequire(import.meta.url);
const completionFilePath = path.join(process.cwd(), 'tests', 'fixtures', 'completion.ts');

const completionCases: CompletionCase[] = [
  {
    marker: 'COMPLETION_TEST_1',
    include: ['value', '_zero', '_top', '_bottom', '@time', '@_minTime', '@_maxTime', 'value@time'],
    exclude: [],
  },
  {
    marker: 'COMPLETION_TEST_2',
    include: ['foobar', '@maxtime', '_zero', '_top', '_bottom', '@_minTime', '@_maxTime', '@maxtime', 'foobar@maxtime'],
    exclude: ['value', '@time', 'value@time'],
  },
  {
    marker: 'COMPLETION_TEST_3',
    include: ['price', '@timestamp', 'price@timestamp'],
    exclude: ['amount', '@date', 'value', '@time'],
  },
  {
    marker: 'COMPLETION_TEST_4',
    include: ['amount', '@date', 'amount@date'],
    exclude: ['price', '@timestamp', 'value', '@time'],
  },
  {
    marker: 'COMPLETION_TEST_5',
    include: ['value', '_zero', '_top', '_bottom', '@time', '@_minTime', '@_maxTime', 'value@time'],
    exclude: [],
  },
];

function indexToPosition(text: string, index: number): Position {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < index; i += 1) {
    if (text[i] === '\n') {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { line, offset: index - lineStart + 1 };
}

function findMarkerPosition(text: string, marker: string): Position {
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Marker not found: ${marker}`);
  }
  const usingIndex = text.lastIndexOf("using: ''", markerIndex);
  if (usingIndex === -1) {
    throw new Error(`using placeholder not found for marker: ${marker}`);
  }
  const cursorIndex = usingIndex + "using: '".length;
  return indexToPosition(text, cursorIndex);
}

describe('typescript language server completions', () => {
  let tsserver: ReturnType<typeof spawn>;
  let buffer = '';
  let seq = 0;
  const pending = new Map<number, PendingResponse>();

  function writeRequest(payload: Record<string, unknown>) {
    if (!tsserver.stdin) {
      throw new Error('tsserver stdin unavailable');
    }
    const json = JSON.stringify(payload);
    tsserver.stdin.write(`${json}\r\n`);
  }

  function sendRequest(command: string, args: Record<string, unknown>) {
    const requestSeq = (seq += 1);
    const payload = { seq: requestSeq, type: 'request', command, arguments: args };

    return new Promise<any>((resolve, reject) => {
      pending.set(requestSeq, { resolve, reject });
      writeRequest(payload);
    });
  }

  function sendNotification(command: string, args: Record<string, unknown>) {
    const requestSeq = (seq += 1);
    const payload = { seq: requestSeq, type: 'request', command, arguments: args };
    writeRequest(payload);
  }

  function handleMessage(message: any) {
    if (message.type !== 'response') {
      return;
    }
    const entry = pending.get(message.request_seq);
    if (!entry) {
      return;
    }
    pending.delete(message.request_seq);
    if (message.success) {
      entry.resolve(message);
    } else {
      entry.reject(new Error(message.message || 'tsserver error'));
    }
  }

  function processBuffer() {
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return;
      }
      const header = buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) {
        return;
      }
      const body = buffer.slice(bodyStart, bodyStart + length);
      buffer = buffer.slice(bodyStart + length);
      const message = JSON.parse(body);
      handleMessage(message);
    }
  }

  beforeAll(async () => {
    const tsserverPath = require.resolve('typescript/lib/tsserver.js');
    tsserver = spawn(process.execPath, [tsserverPath, '--stdio'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (!tsserver.stdout || !tsserver.stderr) {
      throw new Error('tsserver stdio unavailable');
    }
    tsserver.stdout.setEncoding('utf8');
    tsserver.stdout.on('data', (chunk) => {
      buffer += chunk;
      processBuffer();
    });
    tsserver.stderr.setEncoding('utf8');
    tsserver.stderr.on('data', () => {});

    sendNotification('configure', {
      preferences: {
        includeCompletionsForModuleExports: true,
        includeCompletionsForImportStatements: true,
      },
    });
    const fileContent = readFileSync(completionFilePath, 'utf8');
    sendNotification('open', {
      file: completionFilePath,
      fileContent,
      scriptKindName: 'TS',
    });
  });

  afterAll(async () => {
    for (const entry of pending.values()) {
      entry.reject(new Error('tsserver stopped'));
    }
    pending.clear();
    if (tsserver) {
      tsserver.kill();
    }
  });

  it('provides expected completions for using', async () => {
    const text = readFileSync(completionFilePath, 'utf8');
    for (const testCase of completionCases) {
      const position = findMarkerPosition(text, testCase.marker);
      const response = await sendRequest('completionInfo', {
        file: completionFilePath,
        line: position.line,
        offset: position.offset,
        includeExternalModuleExports: false,
        includeInsertTextCompletions: false,
      });
      const entries = (response.body?.entries ?? []).map((entry: { name: string }) => entry.name);
      for (const value of testCase.include) {
        expect(entries, testCase.marker).toContain(value);
      }
      for (const value of testCase.exclude) {
        expect(entries, testCase.marker).not.toContain(value);
      }
    }
  }, 20000);
});

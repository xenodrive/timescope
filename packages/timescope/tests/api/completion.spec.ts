import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { API, type Project, type Snapshot } from 'typescript/unstable/sync';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type CompletionCase = {
  marker: string;
  include: string[];
  exclude: string[];
};

const completionFilePath = fileURLToPath(new URL('../fixtures/completion.ts', import.meta.url));

const completionCases: CompletionCase[] = [
  {
    marker: 'COMPLETION_TEST_1',
    include: ['price', '@time', 'price@time'],
    exclude: ['amount'],
  },
  {
    marker: 'COMPLETION_TEST_2',
    include: ['amount', '@time', 'amount@time'],
    exclude: ['price'],
  },
  {
    marker: 'COMPLETION_TEST_3',
    include: ['value', '@time', 'value@time'],
    exclude: ['price', 'amount'],
  },
];

function findMarkerPosition(text: string, marker: string) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Marker not found: ${marker}`);
  }
  const usingIndex = text.lastIndexOf("using: ''", markerIndex);
  if (usingIndex === -1) {
    throw new Error(`using placeholder not found for marker: ${marker}`);
  }
  return usingIndex + "using: '".length;
}

describe('typescript completions', () => {
  let api: API;
  let snapshot: Snapshot;
  let project: Project;

  beforeAll(() => {
    api = new API({ cwd: process.cwd() });
    snapshot = api.updateSnapshot({ openFiles: [completionFilePath] });
    const defaultProject = snapshot.getDefaultProjectForFile(completionFilePath);
    if (!defaultProject) throw new Error('TypeScript project unavailable');
    project = defaultProject;
  });

  afterAll(() => {
    snapshot.dispose();
    api.close();
  });

  it.each(completionCases)('provides source-specific using completions: $marker', (testCase) => {
    const text = readFileSync(completionFilePath, 'utf8');
    const position = findMarkerPosition(text, testCase.marker);
    const completion = project.checker.getCompletionsAtPosition(completionFilePath, position);
    const entries = completion?.entries.map((entry) => entry.name) ?? [];
    for (const value of testCase.include) {
      expect(entries, testCase.marker).toContain(value);
    }
    for (const value of testCase.exclude) {
      expect(entries, testCase.marker).not.toContain(value);
    }
  });
});

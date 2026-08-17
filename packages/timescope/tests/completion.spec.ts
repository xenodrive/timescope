import { readFileSync } from 'node:fs';
import path from 'node:path';
import { API, type Project, type Snapshot } from 'typescript/unstable/sync';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import '../src/core/types';

type CompletionCase = {
  marker: string;
  include: string[];
  exclude: string[];
};

const completionFilePath = path.join(process.cwd(), 'tests', 'fixtures', 'completion.ts');

const completionCases: CompletionCase[] = [
  {
    marker: 'COMPLETION_TEST_1',
    include: ['value', '#zero', '#top', '#bottom', '@time', 'value@time'],
    exclude: ['value#avg', 'value#min'],
  },
  {
    marker: 'COMPLETION_TEST_2',
    include: ['foobar', '@maxtime', '#zero', '#top', '#bottom', 'foobar@maxtime'],
    exclude: ['foobar#avg', 'foobar#min', 'value', '@time', 'value@time'],
  },
  {
    marker: 'COMPLETION_TEST_3',
    include: ['price', '@timestamp', 'price@timestamp'],
    exclude: ['price#avg', 'price#min', 'amount', '@date', 'value', '@time'],
  },
  {
    marker: 'COMPLETION_TEST_4',
    include: ['amount', '@date', 'amount@date'],
    exclude: ['amount#avg', 'amount#min', 'price', '@timestamp', 'value', '@time'],
  },
  {
    marker: 'COMPLETION_TEST_5',
    include: ['value', 'value#avg', 'value#min', '#zero', '#top', '#bottom', '@time', 'value@time'],
    exclude: [],
  },
  {
    marker: 'COMPLETION_TEST_6',
    include: ['value', 'value#min', 'value#p95', '@time', 'value#min@time'],
    exclude: ['metric#raw', '@timestamp'],
  },
  {
    marker: 'COMPLETION_TEST_7',
    include: ['metric#raw', 'metric#raw#min', '@timestamp', 'metric#raw#min@timestamp'],
    exclude: ['value', '@time'],
  },
  {
    marker: 'COMPLETION_TEST_8',
    include: ['load', '@recorded', 'load@recorded'],
    exclude: ['value', '@time', 'load#min'],
  },
  {
    marker: 'COMPLETION_TEST_9',
    include: ['reading', '@sample', 'reading@sample'],
    exclude: ['reading#avg', 'value', '@time'],
  },
  {
    marker: 'COMPLETION_TEST_10',
    include: ['signal', '@stamp', 'signal@stamp'],
    exclude: ['signal#avg', 'value', '@time'],
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

  it('provides expected completions for using', () => {
    const text = readFileSync(completionFilePath, 'utf8');
    for (const testCase of completionCases) {
      const position = findMarkerPosition(text, testCase.marker);
      const completion = project.checker.getCompletionsAtPosition(completionFilePath, position);
      const entries = completion?.entries.map((entry) => entry.name) ?? [];
      for (const value of testCase.include) {
        expect(entries, testCase.marker).toContain(value);
      }
      for (const value of testCase.exclude) {
        expect(entries, testCase.marker).not.toContain(value);
      }
    }
  });
});

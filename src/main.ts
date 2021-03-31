import { getInput, info, setFailed, setOutput, warning } from '@actions/core';
import { context } from '@actions/github';
import { load } from 'js-yaml';
import * as picomatch from 'picomatch';

import { exec } from './exec';

type Matcher = (test: string) => boolean;

interface Refs {
  base: string;
  head: string;
}

const getBaseAndHeadRefs = ({ base, head }: Partial<Refs>): Refs => {
  if (!base && !head) {
    switch (context.eventName) {
      case 'pull_request':
        base = context.payload.pull_request?.base?.sha as string;
        head = context.payload.pull_request?.head?.sha as string;
        break;
      case 'push':
        base = context.payload.before as string;
        head = context.payload.after as string;
        break;
      default:
        warning(`Unsupported event: ${context.eventName}`);
        break;
    }
  }

  if (!base || !head) {
    throw new Error(`Base or head refs are missing`);
  }

  info(`Event name: ${context.eventName}`);
  info(`Base ref: ${base}`);
  info(`Head ref: ${head}`);

  return {
    base,
    head
  };
};

const parseGitDiffOutput = (output: string): string[] => {
  const tokens = output.split('\u0000').filter(s => s.length > 0);
  const files: string[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    files.push(tokens[i + 1]);
  }
  return files;
};

const getChangedFiles = async (base: string, head: string): Promise<string[]> => {
  await exec('git', ['checkout', base]);
  await exec('git', ['checkout', head]);

  const stdout = (
    await exec('git', ['diff', '--no-renames', '--name-status', '-z', `${base}..${head}`])
  ).stdout;

  return parseGitDiffOutput(stdout);
};

const getPathMatchers = (yaml: string): Record<string, Matcher> => {
  let doc = load(yaml);

  if (typeof doc !== 'object') {
    throw new TypeError('Invalid path YAML format: root element is not an object');
  }

  doc = { ...doc };

  const matchers: Record<string, Matcher> = {};

  for (const [id, pattern] of Object.entries(doc)) {
    matchers[id] = picomatch(pattern) as Matcher;
  }

  return matchers;
};

const findMatch = (files: string[], matcher: Matcher): boolean => {
  return files.some(file => matcher(file));
};

const matchFiles = (
  files: string[],
  matchers: Record<string, Matcher>
): Record<string, boolean> => {
  const record: Record<string, boolean> = {};
  for (const [id, matcher] of Object.entries(matchers)) {
    const isMatch = findMatch(files, matcher);
    record[id] = isMatch;
  }
  return record;
};

const main = async () => {
  const { base, head } = getBaseAndHeadRefs({
    base: getInput('baseRef'),
    head: getInput('headRef')
  });

  const changedFiles = await getChangedFiles(base, head);
  const pathMatchers = getPathMatchers(getInput('paths'));

  const result = matchFiles(changedFiles, pathMatchers);

  console.log('');
  console.log('Matches:');

  for (const [pathId, isMatch] of Object.entries(result)) {
    console.log(`  ${pathId}: ${isMatch}`);
    setOutput(pathId, isMatch);
  }
};

main().catch(error => setFailed(error));

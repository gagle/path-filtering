import { getInput, info, setFailed, setOutput } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { load } from 'js-yaml';
import * as picomatch from 'picomatch';

type OctoKit = ReturnType<typeof getOctokit>;
type Matcher = (test: string) => boolean;

interface Refs {
  base: string;
  head: string;
}

const getBaseAndHeadRefs = ({ base, head }: Partial<Refs>): Refs => {
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
      if (!base || !head) {
        throw new Error(`Missing 'base' or 'head' refs for event type '${context.eventName}'`);
      }
  }

  if (!base || !head) {
    throw new Error(`Base or head refs are missing`);
  }

  info(`Base ref: ${base}`);
  info(`Head ref: ${head}`);

  return {
    base,
    head
  };
};

const getChangedFiles = async (octokit: OctoKit, base: string, head: string): Promise<string[]> => {
  const response = await octokit.repos.compareCommits({
    base,
    head,
    owner: context.repo.owner,
    repo: context.repo.repo
  });

  const files = response.data.files;

  return files.map(file => file.filename);
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
  const token = process.env.GITHUB_TOKEN;

  const octokit = getOctokit(token as string);

  const { base, head } = getBaseAndHeadRefs({
    base: getInput('baseRef'),
    head: getInput('headRef')
  });

  const changedFiles = await getChangedFiles(octokit, base, head);
  const pathMatchers = getPathMatchers(getInput('paths'));

  const result = matchFiles(changedFiles, pathMatchers);

  console.log('Matches:');

  for (const [pathId, isMatch] of Object.entries(result)) {
    console.log(`${pathId}: ${isMatch}`);
    setOutput(pathId, isMatch);
  }
};

main().catch(error => setFailed(error));

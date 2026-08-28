import { loadExamTree, saveExamTree } from './exam-tree';

/** Subtree under HOD's client key (top-level tree key) */
export async function loadHodSubtree(client: string): Promise<Record<string, any>> {
  const tree = await loadExamTree();
  if (!client || !tree[client]) return {};
  return structuredClone(tree[client]);
}

export async function saveHodSubtree(
  client: string,
  subtree: Record<string, any>
): Promise<void> {
  const tree = await loadExamTree();
  tree[client] = subtree;
  await saveExamTree(tree);
}

export function listOrgs(subtree: Record<string, any>): string[] {
  return Object.keys(subtree || {});
}

export function listBatches(
  subtree: Record<string, any>,
  org: string
): string[] {
  return Object.keys(subtree?.[org] || {});
}

export function listTerms(
  subtree: Record<string, any>,
  org: string,
  batch: string
): string[] {
  return Object.keys(subtree?.[org]?.[batch] || {});
}

export function listSections(
  subtree: Record<string, any>,
  org: string,
  batch: string,
  term: string
): string[] {
  return Object.keys(subtree?.[org]?.[batch]?.[term] || {});
}
import { asc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { pipelineNodes } from "@/lib/db/schema";
import { DEFAULT_CUSTOM_PROMPT, defaultPipeline } from "./defaults";
import {
  isNodeType,
  validateParams,
  validatePrompt,
  type NodeParams,
  type NodeType,
  type PipelineNode,
  type ValidationResult,
} from "./types";

function insertDefaults(db: Db): void {
  const now = Date.now();
  db.insert(pipelineNodes)
    .values(defaultPipeline().map((n) => ({ ...n, updatedAt: now })))
    .run();
}

/** Seeds the default pipeline if no nodes exist yet. */
export function ensurePipeline(db: Db): void {
  const existing = db.select({ id: pipelineNodes.id }).from(pipelineNodes).limit(1).all();
  if (existing.length === 0) insertDefaults(db);
}

/** Restores all default nodes and removes custom nodes. */
export function resetPipeline(db: Db): void {
  db.transaction((tx) => {
    tx.delete(pipelineNodes).run();
    insertDefaults(tx as unknown as Db);
  });
}

/** Restores a single default node to its default prompt and params. */
export function resetNode(db: Db, id: string): ValidationResult<PipelineNode> {
  const def = defaultPipeline().find((n) => n.id === id);
  if (!def) return { ok: false, errors: ["Only default nodes can be reset"] };
  db.update(pipelineNodes)
    .set({ prompt: def.prompt, params: def.params, enabled: true, updatedAt: Date.now() })
    .where(eq(pipelineNodes.id, id))
    .run();
  return { ok: true, value: getNode(db, id)! };
}

function toNode(row: typeof pipelineNodes.$inferSelect): PipelineNode | null {
  if (!isNodeType(row.type)) return null;
  const params = validateParams(row.type, row.params);
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    prompt: row.prompt,
    // Invalid stored params fall back to defaults so the worker never crashes on bad data.
    params: params.ok ? params.value : (validateParams(row.type, {}) as { ok: true; value: NodeParams<NodeType> }).value,
    parentId: row.parentId,
    sort: row.sort,
    isCustom: row.isCustom,
  };
}

export function listNodes(db: Db): PipelineNode[] {
  ensurePipeline(db);
  return db
    .select()
    .from(pipelineNodes)
    .orderBy(asc(pipelineNodes.sort))
    .all()
    .map(toNode)
    .filter((n): n is PipelineNode => n !== null);
}

export function getNode(db: Db, id: string): PipelineNode | null {
  ensurePipeline(db);
  const row = db.select().from(pipelineNodes).where(eq(pipelineNodes.id, id)).get();
  return row ? toNode(row) : null;
}

/** Typed accessor for the single node of a given built-in type. */
export function nodeOfType<T extends NodeType>(nodes: PipelineNode[], type: T): PipelineNode<T> | undefined {
  return nodes.find((n) => n.type === type) as PipelineNode<T> | undefined;
}

export interface NodePatch {
  name?: string;
  description?: string;
  enabled?: boolean;
  prompt?: string | null;
  params?: Record<string, unknown>;
}

export function updateNode(db: Db, id: string, patch: NodePatch): ValidationResult<PipelineNode> {
  const current = getNode(db, id);
  if (!current) return { ok: false, errors: ["Node not found"] };
  const errors: string[] = [];
  const params = validateParams(current.type, { ...current.params, ...(patch.params ?? {}) });
  if (!params.ok) errors.push(...params.errors);
  const prompt = patch.prompt !== undefined ? patch.prompt : current.prompt;
  errors.push(...validatePrompt(current.type, prompt));
  const name = patch.name?.trim() ?? current.name;
  if (!name) errors.push("name: required");
  if (errors.length > 0 || !params.ok) return { ok: false, errors };
  if (current.type === "custom_prompt") {
    const key = (params.value as NodeParams<"custom_prompt">).fieldKey;
    const clash = listNodes(db).find(
      (n) => n.id !== id && n.type === "custom_prompt" && (n.params as NodeParams<"custom_prompt">).fieldKey === key,
    );
    if (clash) return { ok: false, errors: [`params.fieldKey: "${key}" is already used by ${clash.name}`] };
  }
  db.update(pipelineNodes)
    .set({
      name,
      description: patch.description ?? current.description,
      enabled: patch.enabled ?? current.enabled,
      prompt,
      params: params.value as Record<string, unknown>,
      updatedAt: Date.now(),
    })
    .where(eq(pipelineNodes.id, id))
    .run();
  return { ok: true, value: getNode(db, id)! };
}

export interface CustomNodeInput {
  label: string;
  fieldKey: string;
  prompt?: string;
  parentId?: string;
  requireReviews?: boolean;
  preferredModel?: string;
}

/** Custom rules run last for each game (they can use the summaries and the let's-play verdict), so they hang off the last per-game step. */
const CUSTOM_PARENT_ORDER = ["letsplay", "users", "reviews", "sync"];

export function addCustomNode(db: Db, input: CustomNodeInput): ValidationResult<PipelineNode> {
  const nodes = listNodes(db);
  const params = validateParams("custom_prompt", {
    label: input.label,
    fieldKey: input.fieldKey,
    requireReviews: input.requireReviews ?? false,
    preferredModel: input.preferredModel ?? "",
  });
  const prompt = input.prompt ?? `${DEFAULT_CUSTOM_PROMPT}${input.label}?`;
  const errors = [...(params.ok ? [] : params.errors), ...validatePrompt("custom_prompt", prompt)];
  if (!params.ok || errors.length) return { ok: false, errors };
  if (nodes.some((n) => n.type === "custom_prompt" && (n.params as NodeParams<"custom_prompt">).fieldKey === params.value.fieldKey)) {
    return { ok: false, errors: [`params.fieldKey: "${params.value.fieldKey}" is already used`] };
  }
  const parentId =
    input.parentId && nodes.some((n) => n.id === input.parentId)
      ? input.parentId
      : (CUSTOM_PARENT_ORDER.find((id) => nodes.some((n) => n.id === id)) ?? "sync");
  const id = `custom_${params.value.fieldKey}`;
  db.insert(pipelineNodes)
    .values({
      id,
      type: "custom_prompt",
      name: input.label,
      description: `Custom field "${input.label}" generated for every processed game.`,
      enabled: true,
      prompt,
      params: params.value,
      parentId,
      sort: Math.max(0, ...nodes.map((n) => n.sort)) + 1,
      isCustom: true,
      updatedAt: Date.now(),
    })
    .run();
  return { ok: true, value: getNode(db, id)! };
}

export function deleteCustomNode(db: Db, id: string): boolean {
  const node = getNode(db, id);
  if (!node?.isCustom) return false;
  db.delete(pipelineNodes).where(eq(pipelineNodes.id, id)).run();
  return true;
}

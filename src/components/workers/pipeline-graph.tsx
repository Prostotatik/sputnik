"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import clsx from "clsx";
import { Clock3 } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import type { PipelineNode } from "@/core/pipeline/types";
import type { NodeStatus } from "@/lib/db/schema";
import { duration } from "@/lib/client/format";
import { NODE_META, STATUS_META, YoutubeGlyph } from "./node-meta";

export interface NodeExec {
  status: NodeStatus;
  startedAt: number | null;
  finishedAt: number | null;
  done: number;
  total: number;
}

type FlowData = { node: PipelineNode; exec: NodeExec | null; now: number; selected: boolean; runLabel: string | null };

const W = 190;
const ROOT_W = 170;
const COL = 310;
const ROW = 72;

/** Tree layout: columns by depth, leaves stacked, parents centred on their children. */
export function layout(nodes: PipelineNode[]): Map<string, { x: number; y: number }> {
  const children = new Map<string | null, PipelineNode[]>();
  for (const n of nodes) {
    const parent = n.parentId && nodes.some((p) => p.id === n.parentId) ? n.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), n]);
  }
  const pos = new Map<string, { x: number; y: number }>();
  let cursor = 0;
  const place = (n: PipelineNode, depth: number): number => {
    const kids = children.get(n.id) ?? [];
    let y: number;
    if (!kids.length) {
      y = cursor;
      cursor += ROW;
    } else {
      const ys = kids.map((k) => place(k, depth + 1));
      y = (Math.min(...ys) + Math.max(...ys)) / 2;
    }
    pos.set(n.id, { x: depth * COL, y });
    return y;
  };
  for (const root of children.get(null) ?? []) place(root, 0);
  // Give direct children of the root a bit more breathing room.
  return pos;
}

function elapsed(exec: NodeExec | null, now: number): number | null {
  if (!exec?.startedAt) return null;
  return (exec.finishedAt ?? (exec.status === "running" ? now : exec.startedAt)) - exec.startedAt;
}

const FlowNode = memo(function FlowNode({ data }: NodeProps<Node<FlowData>>) {
  const { node, exec, now, selected, runLabel } = data;
  const meta = NODE_META[node.type] ?? NODE_META.custom_prompt;
  const status: NodeStatus | "idle" = node.enabled ? (exec?.status ?? "idle") : "skipped";
  const st = STATUS_META[status];
  const Icon = meta.icon;
  const isRoot = node.type === "sync";
  const ms = elapsed(exec, now);
  const progress = exec && exec.total > 1 ? `${exec.done}/${exec.total}` : null;
  return (
    <div
      className={clsx(
        "relative rounded-xl border bg-[#101014]/95 px-3 py-2.5 backdrop-blur transition-shadow",
        selected ? "border-accent-2 shadow-[0_0_0_1px_var(--color-accent-2),0_0_28px_-6px_rgb(109_112_255/0.7)]" : "border-line-2",
        isRoot && "border-violet/60 py-4 shadow-[0_0_30px_-8px_rgb(168_85_247/0.6)]",
        !node.enabled && "opacity-55",
      )}
      style={{ width: isRoot ? ROOT_W : W }}
    >
      {!isRoot && <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-cyan" />}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-violet" />
      <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full" style={{ background: st.color, boxShadow: status === "running" ? `0 0 8px ${st.color}` : undefined }} />
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: meta.tile }}>
          {node.type === "youtube_search" ? <YoutubeGlyph className="h-4 w-6" /> : <Icon className="h-[18px] w-[18px]" style={{ color: meta.color }} />}
        </span>
        <div className="min-w-0 pr-2">
          <p className="truncate text-[12px] font-medium text-fg">{node.name}</p>
          {isRoot && runLabel && <p className="text-[11px] text-muted">{runLabel}</p>}
          <p className="mt-0.5 flex items-center gap-1 text-[10px]" style={{ color: st.color }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
            {node.enabled ? st.label : "Disabled"}
            {progress && <span className="text-muted">• {progress}</span>}
            {ms !== null && !isRoot && <span className="text-muted">• {duration(ms)}</span>}
          </p>
          {isRoot && ms !== null && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-muted">
              <Clock3 className="h-3 w-3" /> {duration(ms)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});

const nodeTypes = { pipeline: FlowNode };

export function PipelineGraph({
  nodes,
  exec,
  selectedId,
  onSelect,
  now,
  runLabel,
}: {
  nodes: PipelineNode[];
  exec: Map<string, NodeExec>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
  runLabel: string | null;
}) {
  const pos = useMemo(() => layout(nodes), [nodes]);
  // Controlled nodes must carry their measured size, otherwise React Flow hides them after every live update.
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({});
  const onNodesChange = useCallback((changes: NodeChange<Node<FlowData>>[]) => {
    const dims = changes.filter((c) => c.type === "dimensions" && c.dimensions);
    if (!dims.length) return;
    setMeasured((prev) => {
      const next = { ...prev };
      for (const c of dims) if (c.type === "dimensions" && c.dimensions) next[c.id] = c.dimensions;
      return next;
    });
  }, []);
  const flowNodes: Node<FlowData>[] = nodes.map((n) => ({
    id: n.id,
    type: "pipeline",
    measured: measured[n.id],
    position: pos.get(n.id) ?? { x: 0, y: 0 },
    data: { node: n, exec: exec.get(n.id) ?? null, now, selected: n.id === selectedId, runLabel },
    draggable: false,
    connectable: false,
  }));
  const edges: Edge[] = nodes
    .filter((n) => n.parentId && nodes.some((p) => p.id === n.parentId))
    .map((n) => {
      const st = exec.get(n.id)?.status;
      const live = st === "running" || st === "success";
      const color = !n.enabled ? "#3f3f46" : st === "failed" ? "#ef4444" : live ? (NODE_META[n.type]?.color ?? "#818cf8") : "#71717a";
      return {
        id: `${n.parentId}-${n.id}`,
        source: n.parentId!,
        target: n.id,
        type: "default",
        animated: st === "running",
        style: { stroke: color, strokeWidth: 1.4, strokeDasharray: live ? undefined : "4 4", opacity: n.enabled ? 0.9 : 0.4 },
      };
    });

  return (
    <div className="h-[520px] w-full [--xy-background-color:transparent] [--xy-edge-label-background-color:transparent]">
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.4}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => onSelect(n.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        style={{ background: "transparent" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#1c1c22" />
        <Controls showInteractive={false} position="bottom-left" className="!rounded-xl !border !border-line-2 !bg-panel !shadow-none [&>button]:!border-line [&>button]:!bg-panel [&>button]:!fill-fg" />
      </ReactFlow>
    </div>
  );
}

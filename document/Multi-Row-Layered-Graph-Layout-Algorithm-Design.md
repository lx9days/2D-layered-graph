# Multi-Row Layered Graph Layout：算法设计与工程实现规范

> **重要：本文件是当前研究算法的设计规范（Algorithm Design Specification）。**
>
> **除非用户明确要求修改算法设计，否则不得自行修改、替换、删除或重新解释本文件中定义的算法流程、优化目标、约束条件和核心设计。**
>
> Coder Agent 可以为了工程实现进行代码重构、性能优化、类型调整、函数拆分、缓存和测试补充，但不得在没有明确指令的情况下改变算法语义。
>
> 如果实际代码与本文件发生冲突，应首先指出冲突，并询问是否修改算法设计或代码实现，而不是自行选择新的算法方案。
>
> 特别禁止在没有明确指令时：
>
> - 改变 logical layer；
> - 将 geometric row 当成新的 graph layer；
> - 删除 topology-aware blocking；
> - 将 multi-row optimization 替换为简单 wrapping；
> - 自行增加或删除核心 objective；
> - 为了获得更好的实验指标而改变 metric 定义；
> - 修改 baseline 使其适应当前算法；
> - 将 heuristic implementation 重新解释为不同的算法贡献。
>
> 当前阶段目标是实现一个**研究原型（research prototype）**，优先保证算法定义清晰、实验可控和各阶段可消融，而不是追求复杂度最高的优化器。

---

# 1. 研究目标

传统 layered graph layout 通常假设一个 logical layer 对应一条几何水平行：

\[
v\in L_i \Rightarrow y(v)=y_i
\]

当某些 layer 包含大量节点时，这种 1D layer representation 会造成极大的水平宽度。

本算法允许同一个 logical layer 内部包含多个 geometric rows：

\[
v\in L_i
\Rightarrow
y(v)=y_i+\Delta(r_v)
\]

其中：

\[
r_v\in\{1,\ldots,R_i\}
\]

表示节点在 logical layer 内部所属的 geometric row。

**Logical layer 与 geometric row 必须严格区分。**

例如：

```text
Logical Layer 0
────────────────────────
        ○   ○   ○


Logical Layer 1
╔══════════════════════╗
║  ○   ○   ○   ○      ║  geometric row 0
║    ○   ○   ○         ║  geometric row 1
║  ○   ○   ○   ○      ║  geometric row 2
╚══════════════════════╝


Logical Layer 2
────────────────────────
        ○   ○   ○
```

这里 Layer 1 仍然只有一个 logical layer，而不是被重新分成三个 graph layers。

算法的核心研究问题是：

> **在保持 logical layering 不变的情况下，如何利用 layer 内部的二维空间降低极宽 layer 的宽度，同时控制 edge crossing、edge detour 和 flow-direction violation 等可读性代价？**

---

# 2. 简单算法流程

## 2.1 核心思想

算法采用 **coarse-to-fine optimization**。

首先保持输入 graph 的 logical layer assignment 不变，然后利用节点拓扑相似性建立一个较好的 layer 内部初始顺序，并将 topology-similar nodes 划分成若干局部 block。

Block 不只是一个用于绘制矩形网格的容器，而是后续 **局部二维优化的搜索区域**。

对于每个 block，算法不再按照固定顺序机械地将节点折成多行，而是主动决定：

1. 一个 block 使用多少 geometric rows；
2. 每个节点属于哪一行；
3. 节点在该行中的水平顺序；
4. 是否可以通过移动、交换和重新排序进一步改善布局。

最终目标是在降低 layer width 的同时，尽量减少 multi-row representation 引入的 crossing、edge detour 和 flow-direction violation。

---

## 2.2 总体流程

```text
Input Layered Graph
        │
        ▼
1. Preserve Logical Layers
        │
        ▼
2. Topology Similarity
        │
        ▼
3. Initial 1D Seriation
        │
        ▼
4. Topology-Aware Block Partition
        │
        ▼
5. Block Ordering
        │
        ▼
6. Initial Multi-Row Assignment
        │
        ▼
7. Within-Row Ordering
        │
        ▼
8. Local 2D Optimization
   ├─ Row Move
   ├─ Node Swap
   └─ Adjacent Reorder
        │
        ▼
9. Coordinate Assignment
        │
        ▼
10. Unified Metric Evaluation
        │
        ▼
Output Compact Layered Layout
```

前半部分负责回答：

> **哪些节点应该在局部空间中保持接近？**

后半部分负责回答：

> **这些节点应该如何利用二维空间排列？**

因此 topology similarity 主要负责形成稳定的局部结构，而 crossing、width、detour 和 flow direction 等几何指标主要负责决定二维 placement。

---

# 3. 核心优化目标

对于最终 layout \(P\)，定义：

\[
C(P)
=
\lambda_w\hat W(P)
+
\lambda_c\hat C(P)
+
\lambda_d\hat D(P)
+
\lambda_b\hat B(P)
\]

其中：

### Width

\[
W(P)
\]

表示整体布局或最宽 logical layer 的水平宽度。

这是算法需要降低的主要 compactness metric。

### Crossing

\[
C(P)
\]

表示 edge crossing。

必须保证 compact layout 和 Sugiyama baseline 使用相同的 crossing 定义。

特别注意：

**长边不能因为 compact layout 没有 dummy nodes 就被 crossing metric 忽略。**

### Edge Detour

\[
D(P)
\]

用于惩罚 multi-row placement 导致的额外 edge travel。

V1 可以直接使用 edge length：

\[
D(P)=\sum_{e\in E} length(e)
\]

后续版本再考虑 normalized detour。

### Backtracking / Flow Violation

\[
B(P)
\]

用于惩罚 multi-row representation 导致的明显逆向 vertical movement 或破坏 layered graph 主流向的 edge routing。

---

# 4. 具体算法步骤

以下部分用于 Coder Agent 的实际工程实现。

---

## Step 0：建立独立的新算法入口

不要直接覆盖现有 `layoutBlockCompact()`。

首先建立新的 layout implementation，例如：

```ts
layoutMultiRowCompact(...)
```

现有算法必须暂时保留，作为：

```text
Current BlockCompact
vs.
New MultiRowCompact
```

的实验 baseline。

两者应能够在同一个 evaluation pipeline 中运行。

---

## Step 1：读取并保留 Logical Layers

输入仍然使用现有：

```ts
interface LayeredGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layers: string[][];
}
```

不得修改：

```ts
node.layer
```

的语义。

新增 geometric row 信息，例如：

```ts
interface MultiRowNode extends GraphNode {
  geometricRow: number;
  geometricColumn: number;
}
```

必须满足：

```text
logicalLayer !== geometricRow
```

`geometricRow` 只描述节点在当前 logical layer 内部的位置。

---

## Step 2：构建邻接关系与 Topology Similarity

V1 复用当前算法已有的：

```ts
buildAdjacency(...)
buildWeightedAdjacency(...)
nodeTopologySimilarity(...)
buildSimilarityMatrix(...)
```

保持当前 topology similarity 定义。

暂时不要重新设计 similarity metric。

这一阶段的输出为每个 logical layer 内部的：

```ts
SimilarityMatrix
```

其主要作用是为 seriation 和 block partition 提供依据。

---

## Step 3：Initial 1D Seriation

复用当前：

```ts
seriateLayer(...)
```

为每个 logical layer 得到：

```ts
[v1, v2, v3, ..., vn]
```

这个顺序被视为二维 optimization 的 **1D backbone / initialization**。

V1 不要求在这一阶段优化最终 crossing。

目的主要是：

```text
Topology
    ↓
Stable local neighborhood
    ↓
2D optimization
```

避免直接在所有二维 permutation 上搜索。

---

## Step 4：Topology-Aware Block Partition

V1 继续复用当前 DP partition 思路。

对于：

```text
v1 v2 v3 v4 v5 v6 v7 v8
```

得到：

```text
[v1 v2 v3] | [v4 v5] | [v6 v7 v8]
     B1          B2          B3
```

Block 的新语义为：

> **Local 2D optimization domain**

而不仅仅是最终绘制出来的 rectangle。

V1 保持 block membership 固定。

即：

```text
允许：
node 在 block 内换 row
node 在 block 内换 column

暂时不允许：
node 从 Block A 移动到 Block B
split block
merge block
```

Block split / merge 留作后续版本。

---

## Step 5：Block Ordering

继续使用当前 block-level barycenter / inversion refinement 获得 logical layer 内的 block 顺序：

```text
B1 → B2 → B3 → ...
```

这一阶段只决定：

```text
block order
```

不决定最终 block 内节点的二维位置。

V1 保持 block order 在后续 local optimization 中固定。

---

# 5. Initial Multi-Row Assignment

这是新算法第一个核心阶段。

对于 block：

```text
B = [v1, v2, ..., vm]
```

首先根据当前 width budget 或 row constraint 确定候选 row 数：

```ts
R = determineInitialRowCount(block, constraints)
```

如果当前实现暂时没有 width budget，可以继续使用：

```ts
maxRows
```

作为工程过渡参数。

但代码结构必须允许未来将：

```text
rowsPerLayer
```

替换成：

```text
maxWidth / viewportWidth
```

等空间约束。

---

## 5.1 Initial Assignment

根据 1D backbone 初始化：

```text
v1 v2 v3 v4 v5 v6 v7 v8
```

例如三行：

```text
Row 0: v1 v2 v3
Row 1: v4 v5 v6
Row 2: v7 v8
```

这只是 initialization。

**不能将该结果直接作为最终 multi-row layout。**

后续必须经过二维优化。

---

# 6. Within-Row Ordering

完成 row assignment 后，对每一行执行 barycentric ordering。

对节点 \(v\)，根据上一 logical layer 和下一 logical layer 的邻居位置计算：

\[
b(v)
=
\frac{1}{|N(v)|}
\sum_{u\in N(v)}x(u)
\]

按照：

\[
b(v)
\]

对当前 row 内节点排序。

可以执行：

```text
top-down sweep
bottom-up sweep
```

若没有有效邻居，则尽量保持 1D backbone 中的相对顺序。

这一阶段输出：

```ts
interface RowAssignment {
  rows: string[][];
}
```

例如：

```ts
{
  rows: [
    ["A", "C", "B"],
    ["D", "F", "E"],
    ["G", "H"]
  ]
}
```

---

# 7. Local 2D Optimization

这是新算法的核心。

对每个 block 的当前二维 arrangement：

```text
Row 0: A B C
Row 1: D E F
Row 2: G H
```

迭代尝试局部操作。

V1 实现三类 move。

---

## 7.1 Row Move

将一个节点移动到相邻 geometric row：

```text
Before:

Row 0: A B C
Row 1: D E F

Move C ↓

After:

Row 0: A B
Row 1: D C E F
```

只允许：

```text
r → r - 1
r → r + 1
```

避免搜索空间过大。

移动后重新执行受影响 row 的 within-row ordering。

---

## 7.2 Node Swap

交换相邻 row 中的两个候选节点：

```text
Before:

Row 0: A B C
Row 1: D E F

swap(B, E)

After:

Row 0: A E C
Row 1: D B F
```

V1 优先限制为：

```text
same block
+
adjacent rows
```

后续版本再考虑任意 row swap。

---

## 7.3 Adjacent Reorder

对同一 row 中相邻节点进行交换：

```text
A B C D
```

尝试：

```text
A C B D
```

用于进一步降低局部 crossing / edge length。

---

# 8. Move Evaluation

对每一个 candidate move，计算：

\[
\Delta C
=
C(P_{new})-C(P_{current})
\]

如果：

\[
\Delta C<-\epsilon
\]

说明 layout 改善。

V1 使用 greedy best-improvement：

```text
while improvement exists:

    candidates = []

    generate row moves
    generate swaps
    generate adjacent reorders

    evaluate Δcost for every candidate

    bestMove = candidate with minimum Δcost

    if bestMove improves objective:
        apply(bestMove)
    else:
        stop
```

增加：

```ts
maxIterations
```

防止异常情况下无限循环。

建议同时记录：

```ts
interface OptimizationTrace {
  iteration: number;
  moveType: "row-move" | "swap" | "reorder";
  deltaCost: number;

  widthBefore: number;
  widthAfter: number;

  crossingsBefore: number;
  crossingsAfter: number;

  edgeLengthBefore: number;
  edgeLengthAfter: number;

  backtrackingBefore: number;
  backtrackingAfter: number;
}
```

这对后续 debug 和论文实验非常重要。

---

# 9. Objective Evaluation

实现统一函数：

```ts
evaluateLayoutCost(layout, options)
```

返回：

```ts
interface LayoutCost {
  total: number;

  width: number;
  crossings: number;
  edgeDetour: number;
  backtracking: number;
}
```

以及：

```ts
interface ObjectiveWeights {
  width: number;
  crossings: number;
  edgeDetour: number;
  backtracking: number;
}
```

不要把权重 hard-code 到多个函数中。

所有 objective weights 应集中定义。

---

# 10. Crossing Metric

这是实现过程中必须优先修正的问题。

当前算法与 Sugiyama baseline 的 crossing calculation 口径不一致。

新实现必须建立：

```ts
countUnifiedCrossings(...)
```

要求：

1. Compact layout 的长边必须参与；
2. Sugiyama baseline 的原始边也必须获得等价的 crossing interpretation；
3. 不允许一边使用 dummy-edge segments，另一边直接忽略 long edges；
4. metric implementation 必须独立于具体 layout algorithm。

如果无法立即得到严格统一定义：

**不要自行选择一种定义。**

应将问题记录为：

```text
TODO / RESEARCH DECISION REQUIRED
```

并向用户说明。

---

# 11. Coordinate Assignment

完成所有 block 的 row assignment 和 ordering 后再生成最终坐标。

对于节点：

```ts
node.logicalLayer
node.geometricRow
node.geometricColumn
```

计算：

```ts
node.x
node.y
```

基本形式：

\[
x(v)
=
block.x
+
padding_x
+
column(v)\cdot nodeGap_x
\]

\[
y(v)
=
layer.y
+
blockOffset_y
+
row(v)\cdot nodeGap_y
\]

不同 logical layers 之间必须保持明显大于 block 内 geometric rows 的 vertical spacing：

```text
intra-layer row gap
        <<
inter-layer gap
```

以视觉上明确表达：

> 多个 geometric rows 属于同一个 logical layer。

---

# 12. Block Position Refinement

完成 block 内二维 optimization 后，可以继续复用现有 block coordinate refinement：

```text
neighbor center attraction
+
minimum block spacing
+
layer boundary constraint
```

但 block positioning 不允许改变：

```text
block membership
block order
node row assignment
node order
```

它只负责最终 block geometry。

---

# 13. 输出

新算法至少返回：

```ts
{
  mode: "multi-row-compact",

  nodes,
  edges,
  layers,

  boxes,
  blockBoxes,

  metrics: {
    width,
    height,
    crossings,
    totalEdgeLength,
    backtracking,
  },

  optimizationTrace
}
```

每个节点最好额外保留：

```ts
{
  logicalLayer,
  blockId,
  geometricRow,
  geometricColumn,
  x,
  y
}
```

方便 debug 和 visualization。

---

# 14. 必须支持的 Ablation

实现时必须保留开关，使以下版本能够独立运行：

```text
A. Naive Multi-Row
   fixed ordering + simple wrapping

B. Topology Block
   topology seriation
   + DP block partition
   + simple wrapping

C. Row Assignment
   B
   + optimized row assignment

D. Full Optimization
   C
   + row move
   + node swap
   + adjacent reorder
```

例如：

```ts
interface MultiRowOptions {
  enableTopologyBlocking: boolean;
  enableRowOptimization: boolean;
  enableRowMove: boolean;
  enableNodeSwap: boolean;
  enableAdjacentReorder: boolean;
}
```

不要为了代码简洁把这些阶段融合到无法关闭。

这是 research code，不只是 production code。

**算法阶段的可分离性优先于少写几个函数。**

---

# 15. 暂时不要实现的内容

V1 暂时不要加入：

```text
Simulated Annealing
Genetic Algorithm
MIP / ILP
Graph Neural Network
Learned objective weights
Block split
Block merge
Cross-block node movement
Automatic re-layering
```

这些可以作为后续增强。

第一阶段首先验证：

> **Optimizing geometric row assignment 是否显著优于 simple wrapping？**

如果答案为否，应首先检查研究假设，而不是继续堆叠复杂 optimizer。

---

# 16. 推荐代码结构

不要继续把所有逻辑加入一个巨大的 `blockCompact.ts`。

建议：

```text
layout/
│
├── multiRowCompact.ts
│
├── multiRow/
│   │
│   ├── types.ts
│   │
│   ├── topology.ts
│   ├── seriation.ts
│   ├── partition.ts
│   ├── blockOrdering.ts
│   │
│   ├── rowAssignment.ts
│   ├── rowOrdering.ts
│   │
│   ├── localOptimization.ts
│   ├── candidateMoves.ts
│   │
│   ├── objective.ts
│   ├── crossings.ts
│   ├── edgeMetrics.ts
│   │
│   ├── coordinateAssignment.ts
│   └── debugTrace.ts
│
└── ...
```

现有代码中可以复用的函数不要无意义复制。

如果现有函数与新算法共用，应考虑抽成 shared utility，但不得因此改变旧算法行为。

---

# 17. 实现优先级

Coder Agent 应按以下顺序开发：

```text
Phase 1
Logical layer / geometric row 数据结构
        ↓
Phase 2
复用 topology + seriation + partition
        ↓
Phase 3
建立简单 multi-row assignment
        ↓
Phase 4
建立统一 objective evaluator
        ↓
Phase 5
实现 Row Move
        ↓
Phase 6
实现 Swap
        ↓
Phase 7
实现 Adjacent Reorder
        ↓
Phase 8
Coordinate assignment
        ↓
Phase 9
Unified metrics
        ↓
Phase 10
Ablation + debug visualization
```

每完成一个 Phase，应保证当前版本可以运行和可视化，不要一次性重写整个 layout pipeline。

---

# 18. 当前算法的研究边界

当前算法研究的是：

> **Fixed logical layering 下的 topology-aware multi-row geometric optimization。**

不是：

> unrestricted graph drawing。

也不是：

> automatic layer assignment。

更不是：

> 将一个 logical layer 拆成多个新的 logical layers。

因此始终保持：

\[
\boxed{
Logical\ Layer
\neq
Geometric\ Row
}
\]

这是当前算法最重要的 invariant。

---

# 19. Coder Agent 执行规则

在开始修改代码前：

1. 阅读本文件；
2. 阅读当前 `blockCompact` 实现；
3. 找出哪些模块可以直接复用；
4. 给出计划修改/新增的文件；
5. 保持现有 `layoutBlockCompact` 可运行；
6. 新算法建立独立入口；
7. 分阶段实现；
8. 每阶段进行测试；
9. 报告算法设计与实际代码之间发现的不一致。

如果实现过程中发现本设计存在歧义：

> **停止对该算法决策的自行扩展，明确提出问题。**

可以自行决定的是：

- 函数命名；
- 文件拆分；
- TypeScript 类型组织；
- 缓存；
- 性能工程；
- 单元测试结构；
- debug logging；
- 不改变语义的代码重构。

不可自行决定的是：

- 新 objective；
- 删除 objective；
- 修改 logical layer；
- 改变 block 定义；
- 改变优化变量；
- 修改 metric 含义；
- 改变 baseline；
- 使用新的 optimization algorithm 替代本文定义的方法；
- 根据实验结果反向修改 metric。

**除非用户明确下达修改算法设计的指令，否则本文件中的算法定义视为当前项目的固定研究规范。**

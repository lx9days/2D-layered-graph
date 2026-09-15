# 面向固定语义层的跨层感知多行布局（Crossing-Aware Multi-Row Layout for Fixed Semantic Layers）

## 1. 研究背景与问题定义

Layered Graph Drawing（分层图布局）是可视化有向图的重要方法，其中最经典的是 Sugiyama 框架。

传统方法将节点分配到若干层：

\[
\lambda:V\rightarrow\{L_1,L_2,...,L_k\}
\]

然后在每层内部优化节点顺序以减少边交叉。

其隐含假设是：

> 一个 logical layer 对应一个 geometric row。

即：

```
Layer i:

●  ●  ●  ●  ●  ●  ●
```

这一假设在普通 DAG 中有效，但在具有高 fan-out 的应用场景中会导致严重的宽度爆炸。

例如金融交易网络：

```
目标账户

   ↓

1-hop accounts: 50 nodes

   ↓

2-hop accounts: 500 nodes
```

如果这些 layer 本身具有语义：

- 交易距离；
- 因果阶段；
- provenance 层级；
- 依赖深度；

那么不能简单通过重新分配 layer 来压缩布局。

因此核心问题为：

> 在保持 semantic layer 不变的情况下，如何让高基数 layer 占据二维空间，并保持良好的可读性？

---

# 2. 核心研究思想

传统 layered graph layout 优化：

\[
\pi_i:V_i\rightarrow\{1,...,|V_i|\}
\]

即：

> 一个 layer 内节点的一维排列。

本文提出将其扩展为：

\[
\boxed{
\text{二维层内布局问题}
}
\]

即同时优化：

- 节点所在 geometric row；
- 节点在 row 内的位置。

但是不采用完全自由二维布局。

目标表示为：

```
Logical Layer

+----------------------+
| Block A | Block B    |
| ● ● ●   | ● ●        |
| ● ●     | ● ● ●      |
+----------------------+
```

整体结构：

```
Layer
  ↓
Ordered Blocks
  ↓
2D Node Arrangement
```

即：

\[
\boxed{
\text{global 1D organization}
+
\text{local 2D flexibility}
}
\]

---

# 3. Related Work

## 3.1 Sugiyama Layered Graph Drawing

### 核心思想

经典流程：

```
Cycle Removal
      ↓
Layer Assignment
      ↓
Crossing Reduction
      ↓
Coordinate Assignment
```

Crossing reduction 主要解决：

\[
\pi_i
\]

即 layer 内节点排列问题。

---

### 局限

传统方法仍然假设：

\[
logical\ layer = geometric\ row
\]

因此：

\[
|L_i|\gg 1
\]

时会产生巨大宽度。

---

### 与本文区别

已有方法：

> 在一维 layer 中优化 permutation。

本文：

> 将 layer 内优化扩展为二维 row + ordering assignment。

---

# 4. Compact Layered Graph Drawing

## 代表工作

- Minimum-width graph layering
- Compact Layered Drawings of General Directed Graphs

---

## 核心思想

通过改变节点 layer assignment：

\[
\lambda(v)
\]

降低：

\[
Width
\]

例如：

原布局：

```
A B C D E F G H
```

重新分配：

```
A B C

D E F

G H
```

---

## 局限

这些方法允许改变 logical layer。

但是很多应用中：

```
Layer 1 = direct transaction

Layer 2 = indirect transaction
```

layer 本身具有语义。

---

## 与本文区别

已有方法：

\[
change\ logical\ layer
\]

本文：

\[
preserve\ logical\ layer
\]

只改变：

\[
geometric\ organization
\]

---

# 5. Wrapping Layered Graphs

## 核心思想

将完整 layered drawing 分割成多个区域：

```
Before:

L1
L2
L3
L4
L5
L6


After:

L1 L4

L2 L5

L3 L6
```

---

## 局限

它解决：

> 整体 layout 太高/太宽。

但是不能解决：

```
Layer 2:

● ● ● ● ● ● ● ● ● ●
```

这种单个 layer 内部爆炸。

---

## 与本文区别

Wrapping:

\[
wrap\ layer\ sequence
\]

本文：

\[
restructure\ individual\ high-cardinality\ layer
\]

---

# 6. Area-Adaptive Tree Drawing

## 核心思想

传统 tree layout：

```
Level 2:

● ● ● ● ● ●
```

Area-adaptive 方法允许：

```
Level 2:

● ● ●

● ● ●
```

即：

\[
logical\ level \neq single\ row
\]

---

## 局限

主要针对 rooted tree：

- 每个节点通常只有一个父节点；
- 不适用于一般 directed graph；
- 无法处理复杂 many-to-many crossing。

---

## 与本文区别

已有：

\[
tree\ level
\rightarrow
adaptive\ geometry
\]

本文：

\[
general\ layered\ graph
\rightarrow
crossing-aware\ multi-row\ layout
\]

---

# 7. Strip Planarity / Level Planarity

## 核心思想

允许节点属于有序区域：

\[
\gamma(v)=i
\]

一个逻辑类别对应一个 strip，而不是固定 y 坐标。

---

## 意义

证明：

\[
logical\ grouping
\neq
fixed\ geometric\ line
\]

---

## 局限

主要研究：

- 是否存在 crossing-free drawing；
- planarity constraint。

不是针对：

- dense graph；
- compactness；
- crossing-width tradeoff。

---

## 与本文区别

Strip Planarity：

> 是否存在合法布局？

本文：

> 如何优化实际可视布局？

---

# 8. Compound Graph / Clustered Graph Drawing

## 核心思想

支持已有 group：

```
+-----------+
| Group A   |
| ● ● ●     |
+-----------+
```

---

## 局限

Group 通常是输入结构：

\[
given\ grouping
\]

例如：

- community；
- hierarchy；
- cluster。

---

## 与本文区别

本文 block：

\[
layout-derived\ structure
\]

通过：

- topology similarity；
- connectivity；
- crossing objective

自动产生。

---

# 9. Community-Aware Graph Layout

## 核心思想

流程：

```
Graph

 ↓

Community Detection

 ↓

Community Layout
```

---

## 局限

Community 是数据语义：

例如：

```
friend group
```

而本文关注：

```
1-hop
2-hop
3-hop
```

这样的 layered semantic structure。

---

# 10. 现有方法总结

| 方法 | 修改Layer | 保留语义Layer | 多行表示 | Crossing-aware二维优化 |
|---|---|---|---|---|
| Sugiyama | 否 | 是 | 否 | 否 |
| Compact Layering | 是 | 否 | 否 | 否 |
| Wrapping | 否 | 是 | 否 | 否 |
| Area-Adaptive Tree | 否 | 是 | 是 | Tree专用 |
| Strip Planarity | 否 | 是 | 是 | Planarity |
| Compound Graph | 否 | 部分 | 是 | Group-based |
| Community Layout | 通常否 | 否 | 是 | Community-based |
| 本文方法 | 否 | 是 | 是 | 是 |

---

# 11. 核心创新点

## Contribution 1：固定语义层下的 Multi-Row Layout Problem

提出新的布局问题：

\[
Fixed Semantic Layer Multi-Row Layout
\]

特点：

- layer assignment immutable；
- layer 可以占据二维区域；
- 节点获得 row 和 order。

即：

从：

\[
1D\ permutation
\]

扩展到：

\[
2D\ assignment
\]

---

## Contribution 2：Topology-Aware Structured Layout

不是直接进行自由二维排列。

提出：

```
Layer
 ↓
Blocks
 ↓
Nodes
```

block 根据：

- incoming similarity；
- outgoing similarity；
- degree pattern；

自动产生。

Block 作为二维优化的结构化搜索空间。

---

## Contribution 3：Crossing-Aware Multi-Row Optimization

关键变量：

\[
row(v)
\]

和：

\[
order(v)
\]

共同优化。

目标：

\[
\alpha Crossing
+
\beta EdgeLength
+
\gamma Width
\]

保持：

\[
\lambda(v)
\]

不变。

---

# 12. Research Gap

已有方法主要通过：

1. 修改 layer assignment；
2. wrapping layer sequence；
3. 使用预定义 group；
4. tree level folding；

解决宽布局问题。

但是缺少：

\[
\boxed{
general\ directed\ graph
+
fixed\ semantic\ layers
+
high-cardinality\ layer
+
crossing-aware\ multi-row\ organization
}
\]

因此本文探索：

\[
\boxed{
Preserve logical layers,
relax geometric layers.
}
\]

即：

从：

```
one-dimensional intra-layer ordering
```

变为：

```
crossing-aware two-dimensional intra-layer organization
```

---

# 13. 一句话定位

> 本文提出一种面向固定语义层的跨层感知多行布局方法，在不改变逻辑层结构的情况下，引入二维层内组织能力，以降低高基数层造成的布局宽度爆炸，并保持边连接可读性。

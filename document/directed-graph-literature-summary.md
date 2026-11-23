# 有向图聚类与 Embedding 文献小结

整理日期：2026-11-23。本文汇总此前调研的代表性工作，并非穷尽式综述或最新方法排名。论文机制与项目延伸建议分开表述；部分工作仅核对摘要及方法概述，尚未逐篇复现。

## Embedding 在这里是什么意思？

这里主要指节点嵌入：将节点 v 映射成一个向量 z(v)，使表示保留选定的图结构信息，例如邻近关系、多跳关系或输入输出角色。向量维度不必为 2 或 3，也不一定直接对应屏幕坐标。不同算法保留的关系不同，因此不能笼统认为“有边的节点一定更近”。

有向图中，同一节点可以有 source（发送者）与 target（接收者）两套表示。例如用 source(u) 与 target(v) 的内积近似 u 到 v 的有向邻近程度，这可以表达 u→v 与 v→u 的差别。比较两个节点的 source 向量，则更接近比较它们的输出模式；这和预测两者之间是否有边是不同问题。

Embedding 输出表示；聚类输出节点组。可以先 embedding，再在表示空间中聚类，但表示学习质量不自动等于分块质量。图学习中的 embedding 也不同于图绘制理论中描述顶点、边在平面或曲面上如何嵌入的概念。

## 文献概览

| 工作 | 原始任务与主要机制 | 对当前层内分块的启发与边界 |
| --- | --- | --- |
| Malliaros & Vazirgiannis, *Clustering and Community Detection in Directed Networks: A Survey*, Physics Reports, 2013 | 区分密度型与模式型聚类；综述保留方向的变换、随机游走、统计推断及块模型 | 同块节点可以不直接相连，连接角色也可定义相似性。是概念地图，不是单一新算法。[论文](https://arxiv.org/abs/1308.0971) |
| Rosvall & Bergstrom, *Multilevel Compression of Random Walks on Networks Reveals Hierarchical Organization in Large Integrated Systems*, PLoS ONE, 2011 | 层次 map equation，通过随机游走轨迹编码发现嵌套流模块 | 提供流驻留型、多尺度分组；模块可能跨语义层，不能直接等同布局块。[论文](https://pmc.ncbi.nlm.nih.gov/articles/PMC3072965/) |
| Peixoto, *Hierarchical Block Structures and High-resolution Model Selection in Large Networks*, Physical Review X, 2014 | Nested SBM，通过嵌套生成模型和模型选择推断多尺度结构，支持有向图及非稠密社区型模式 | 可探索按整体结构解释能力分块，但会改变当前节点对相似度驱动的流程。[论文](https://arxiv.org/abs/1310.4377) |
| Rohe, Qin & Yu, *Co-clustering directed graphs to discover asymmetries and directional communities*, PNAS, 2016 | DI-SIM，用正则化谱方法分别识别发送者和接收者群体 | 启发输入/输出角色与群体连接分布；原方法允许双重群体身份，我们布局块要求单一层内归属。[论文](https://doi.org/10.1073/pnas.1525793113) |
| Ou et al., *Asymmetric Transitivity Preserving Graph Embedding*, KDD, 2016 | HOPE，通过低秩表示近似高阶非对称邻近关系，学习 source/target 表示 | 启发多跳上下游特征；原论文主要验证重构、链接预测等，并不直接提出我们的分块规则。[作者论文](https://zw-zhang.github.io/files/2016_KDD_HOPE.pdf) |
| *Magnetic eigenmaps for community detection in directed networks*, 2017 | 利用 magnetic Laplacian 的谱表示处理有向网络社区 | 启发方向与循环结构的表示；需要检查数据是否含相应结构信号。[论文入口](https://pubmed.ncbi.nlm.nih.gov/28298008/) |
| Cucuringu et al., *Hermitian matrices for clustering directed graphs: insights and applications*, AISTATS, 2020 | 复数 Hermitian 矩阵谱聚类，处理由方向信息定义的群体结构 | 提供超越密度的方向分组；若方向主要由既定语义层决定，层内增益仍待验证。[论文](https://proceedings.mlr.press/v108/cucuringu20a.html) |
| *Directed network Laplacians and random graph models*, 2021 | 联系有向 Laplacian 与随机图模型，讨论 magnetic 的周期流结构和 trophic 的线性层级结构 | 帮助区分循环阶段与上下游等级；两者都不是嵌套聚类树的同义词。[论文](https://pmc.ncbi.nlm.nih.gov/articles/PMC8511780/) |
| Peixoto, *Ordered community detection in directed networks*, Physical Review E, 2022 | Ordered SBM 联合推断群体与潜在顺序，并与无序模型比较 | 可提供组间顺序，但我们已经固定语义层，应检验是否只是重复已有层级信息。[论文](https://arxiv.org/abs/2203.16460) |
| He, Reinert & Cucuringu, *DIGRAC: Digraph Clustering Based on Flow Imbalance*, LoG, 2022 | 用有向流不平衡损失进行无标签聚类，可结合节点特征 | 可探索块间方向模式；不是原生层次聚类，且单向跨层数据可能使方向不平衡缺少层内区分力。[论文](https://proceedings.mlr.press/v198/he22b.html) |
| *Model-independent embedding of directed networks into Euclidean and hyperbolic spaces*, Communications Physics, 2023 | TREXPEN/TREXPIC 等方法研究有向图的欧氏及双曲表示 | 提供替代几何表示；其重构、映射和路由结果不能直接证明层内分块效果。[论文](https://www.nature.com/articles/s42005-023-01143-x) |

## 对项目的结论

必须区分三件事：嵌套聚类层次、方向上的上下游层级，以及本项目已固定的语义层。全图社区可以跨层，而当前布局块只能包含同一语义层的节点。

此前优先落地的两个方向是：

1. **多跳上下游分布**：从直接邻居重合扩展到间接端点分布相似，受到 HOPE 高阶非对称关系思路启发。
2. **群体连接分布**：从连接到相同节点扩展到连接到相同参考群体，受到 DI-SIM 和块模型的角色/群体连接思路启发。

Demo 的实现使用显式特征与平均连接聚类；没有训练 HOPE embedding、执行 DI-SIM 谱分解或拟合 SBM。两种模式不是来源算法的复现，也不应被表述成已经证明的新研究贡献。具体参数、空分布规则、对照差异与限制见[实验分块模式说明](experimental-blocking-methods.md)。

后续比较应同时看结构解释性和布局质量，并匹配块数/大小、保持布局优化预算一致。仅替换 embedding 或降低阈值得到更紧凑的图，不能单独证明分块标准更好。

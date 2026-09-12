# ellephants

> 原野象群

ellephants 是一个由社群共同维护的公开学习指南，现阶段收录数学与物理领域的课程脉络、学习方法和优质资源。

## 内容范围

- 数学：分析与微分方程、代数与数论、几何与拓扑、概率统计与随机过程、应用数学与建模。
- 物理：普通物理与物理思想、力学、热学与统计物理、电磁学与电动力学、光学、量子与近代物理、凝聚态物理、数学物理方法和实验物理。

内容按主要领域归档，并通过标签、先修知识和站内链接建立关联。

## 参与共建

知识内容通过仓库的“提交知识内容”Issue 表单投稿。审核通过后，系统会自动生成页面、检查格式并发布。

网站功能、目录结构和视觉交互方面的问题或建议，通过[问题反馈表单](https://github.com/lil4notfound/ellephants/issues/new?template=feedback.yml)提交。反馈会标记为 `feedback` 并等待维护者处理，不会触发内容发布。

站点结构、主题和自动化流程的修改使用分支与 Pull Request。详细要求见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 项目结构

```text
ellephants/
├── config/                 # 投稿领域配置
├── docs/                  # 网站页面与静态资源
│   ├── mathematics/       # 数学内容
│   ├── physics/           # 物理内容
│   ├── guide/             # 写作与投稿说明
│   └── .vitepress/        # VitePress 配置与主题
├── scripts/               # 导航、校验和内容生成工具
└── .github/               # 投稿表单与自动化工作流
```

## 许可协议

- 网站程序、配置和自动化代码采用 [MIT License](./LICENSE)。
- 原创知识内容与方法论采用 [CC BY-SA 4.0](./LICENSE-CONTENT.md)。
- 第三方资料、引文和外部链接不在项目许可范围内，使用时以其原始权利声明为准。

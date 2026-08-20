# Pinbox

书签管理工具（Raindrop.io 复刻 MVP），遵循 **MAX 软件研发协议** 开发。

> 任何代码修改都必须属于一个 GitHub Issue，并走 Issue → Project → 开发 → 测试 → Commit/PR → Done。
> 协议四层：Skill 引导 → Repo Config 定义 → GitHub 记录 → CI 验证 → GitHub Rules 强制。

## 技术栈

- 运行时：Node.js 22 (ESM)
- 语言：TypeScript
- Web 框架：Express
- 存储：better-sqlite3（本地文件数据库）
- 测试：Vitest
- 协议：`.github/agent-workflow.yml` + 分支保护（enforce_admins）+ CI（ci / pr-guard）

## 开发约定（MAX 软件研发协议）

- 分支：`feat/N-short-slug`（N = Issue 号；git 分支名不允许 `#`）
- 进行中提交：`refs #N`
- 完成提交：`fixes #N`（自动关闭 Issue）
- PR 描述必须引用 Issue（如 `fixes #1`），否则 `pr-guard` CI 标红、分支保护禁止合并
- 禁止直推 `main`；PR 必须 `ci` + `pr-guard` 全绿才能合并

## 本地运行

```bash
npm install
npm run dev        # 启动服务 http://localhost:3000
npm test           # 跑单元测试
```

## 里程碑（Issue）

- #1 研发协议落地与项目脚手架
- #2 书签核心：增删查 + 集合 + 标签 + 搜索
- #3 Web UI：列表 + 添加表单 + 搜索框

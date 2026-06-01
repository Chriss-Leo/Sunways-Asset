<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 项目概述

新能源资产管理平台（Sunways Asset）— 将新能源资产（光伏电站等）建档、审核、上链、运营管理、收益分配全流程 Web3 化。

- **区块链**: 以太坊兼容链（本地开发用 Anvil，chainId=31337）
- **智能合约**: Solidity (Foundry)，4 个核心合约：PowerStationNFT (ERC721)、RevenueVault (原生代币金库)、CarbonCreditToken (ERC20)、GreenCertificate (ERC1155)
- **前端**: Next.js 16 (Pages Router) + React 19 + TypeScript strict
- **后端**: Go 1.25 + Gin + GORM + PostgreSQL
- **Web3 连接**: wagmi v2 + viem v2 + RainbowKit v2
- **样式**: Tailwind CSS 4
- **存储**: Filebase (S3 兼容 IPFS)
- **国际化**: 自研 i18n（中/英），所有面向用户的字符串必须用 `useT()` ，禁止硬编码

# 常用命令

```bash
# 前端
npm run dev          # 启动 Next.js 开发服务器 (localhost:3000)
npm run build        # 生产构建
npm run lint         # ESLint 检查

# 智能合约
cd contracts
forge build          # 编译合约
forge test           # 运行测试
forge script script/DeploySunways.s.sol --rpc-url localhost --broadcast
forge script script/SeedLocal.s.sol --rpc-url localhost --broadcast

# 后端 (需要 PostgreSQL + Anvil 运行中)
cd backend
go run ./cmd/api      # API 服务器 (默认 :8080)
go run ./cmd/indexer  # 链上事件索引器
```

# 目录结构约定

```
src/
  pages/           # Next.js Pages Router（当前唯一路由方案）
  components/      # React 组件，按功能域分包
    wallet/        # 钱包连接、SIWE 登录
    dashboard/     # 仪表盘（Portfolio、Admin、Operations）
    platform/      # 平台工作区（组织、资产草稿、文件）
    contracts/     # 合约数据面板
  hooks/           # 自定义 React hooks
  services/        # API 调用层
  config/          # wagmi 配置、链配置
  contracts/       # 合约 ABI JSON 文件
  i18n/            # 国际化（locales/en.ts、zh.ts）
  data/            # Mock 数据
  utils/           # 工具函数

contracts/         # Foundry 智能合约项目
  src/             # Solidity 合约
  script/          # 部署和种子脚本
  test/            # Foundry 测试

backend/           # Go 后端
  cmd/api/         # HTTP API 入口
  cmd/indexer/     # 链上事件索引器入口
  internal/        # 业务逻辑（按域分包）

config/            # 链配置、合约地址、Anvil 状态快照
docs/              # 人类阅读的详细技术文档
```

# 编码约定

- **前端数据策略**: 三层降级 — 后端 API → 链上合约读取 → Mock 数据
- **API 调用**: 所有后端请求用 TanStack Query，仪表盘类数据轮询间隔 5-10 秒
- **管理操作**: 管理员写操作必须走后端代理（后端用 ADMIN_PRIVATE_KEY 签名交易），不能让用户钱包直接发交易
- **Solidity**: 错误统一用 `revert CustomError()` 不要用 `require("string")`；权限用 OpenZeppelin AccessControl 不要用 Ownable
- **后端**: `.env` 放 `backend/.env`，不要提交到 Git；GORM AutoMigrate 在启动时自动建表
- **国际化**: 所有 UI 文字用 `useT()` 的嵌套 key，如 `useT("wallet.title")`，不要硬编码中英文
- **事件去重**: 链上事件用 `(tx_hash, log_index)` 唯一键去重
- **路径别名**: `@/*` → `./src/*`

# 当前开发进度

@docs/DEVELOPMENT_STEPS.md

里程碑完成情况：
- **M1 本地链资产闭环**: ✅ 100%
- **M2 收益闭环**: 合约和索引器完成，前端领取按钮和测试覆盖待补
- **M3 后端服务层**: ✅ 100%
- **M4 测试网**: 未开始
- **M5 生产环境**: 未开始

# 关键参考

- @docs/BACKEND_DATABASE.md — 数据库表结构（16 张表）
- @docs/LOCAL_SEED.md — 本地种子数据说明
- config/chains.local.json — 本地链合约地址
- PROJECT_REQUIREMENTS.md — 三阶段产品需求清单

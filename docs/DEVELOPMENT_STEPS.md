# Sunways Asset 开发步骤说明文档

更新时间：2026-06-01

本文档面向当前 `sunways-asset` 项目的逐步开发。当前仓库已经包含 Next.js 前端、Go 后端和 `contracts/` Foundry 合约工程；依赖包含 `next@16.2.6`、React 19、wagmi、viem、RainbowKit、Tailwind CSS 4。下面按”本地链优先闭环、后端索引业务化、前端产品化、再上测试网/主网”的顺序推进。

当前进度：P0 基础环境 ~ P7 后端 API 查询已全部完成。P8 设备数据预言机已部分完成（运维状态、利用率追踪已实现，mock 数据自动生成待完成）。P9 收益结算的合约层已完成（RevenueVault），后端已索引收益事件并计算用户汇总，但自动化结算任务尚未实现。P10 P2P 交易尚未开始。

此外，平台工作台（组织管理、资产草稿生命周期、IPFS/Filebase 集成）和管理控制台（Admin 代理服务、链上操作 UI）也已实现。

> 说明：能源资产、RWA、收益权、碳资产、证券属性等可能涉及合规要求。本文是工程开发路线，不构成法律、金融或投资建议。

## 1. 总体目标

把真实或模拟的能源资产抽象成链上可验证资产，并通过 Go 后端和 Next.js 前端完成资产发行、持仓展示、收益分配、数据看板和运营管理。

推荐的核心闭环：

1. Foundry + Anvil 建本地链。
2. Solidity 合约定义资产、份额、收益、权限和事件。
3. Go 后端监听链上事件，写入 PostgreSQL，并提供业务 API。
4. Next.js 前端连接钱包，读取链上状态和后端聚合数据。
5. 用测试、审计、权限、监控、部署流水线把系统推向测试网和生产环境。

## 2. 技术选型基线

### 链与合约

- Foundry：本地链、合约编译、测试、脚本部署、fork 测试。
- Anvil：本地 Ethereum 节点，适合前后端联调。
- Solidity `^0.8.24` 或更新稳定版本：使用内置溢出检查、custom errors、事件驱动架构。
- OpenZeppelin Contracts 5.x：ERC 标准、权限、安全基础库。
- OpenZeppelin AccessManager：适合比传统 `Ownable` 更细的运营权限。
- ERC-3643：如果资产份额带有 KYC、白名单、转让限制，可作为 RWA 权限化 Token 方向。
- ERC-1155：如果资产更像多种能源证书、额度、凭证，可用于多资产类型。
- ERC-721：如果每个电站、储能站、设备是唯一资产，可用于资产登记 NFT。

### 前端

- Next.js 16 + React 19。
- 当前代码在 `src/pages`，属于 Pages Router；Next 本地文档提示 App Router 承载最新 React/Next 能力。建议短期保留能跑的 Pages Router，中期迁移到 `src/app`。
- viem：类型安全的链上读写底层库。
- wagmi：React hooks 钱包与合约交互层。
- RainbowKit：钱包连接 UI。
- TanStack Query：链下 API、链上查询缓存、状态刷新。
- Tailwind CSS 4：UI 样式系统。

### Go 后端

- Go 1.22+ 或当前稳定版。
- PostgreSQL：业务状态、链上事件投影、用户资料、资产元数据。
- Redis：任务锁、缓存、异步队列缓冲。
- `go-ethereum` 或轻量 RPC client：监听事件、发交易、读合约。
- `sqlc` 或 Ent：数据库访问保持类型安全。
- `golang-migrate`：数据库迁移。
- `zap`/`zerolog` + OpenTelemetry：日志和链路追踪。
- SIWE（Sign-In with Ethereum）：钱包登录，避免传统密码优先。

### 索引与数据

- Go 自建事件索引器：本地开发和业务定制最直接。
- The Graph：当事件查询复杂、前端需要高性能历史查询时引入。
- Chainlink Data Feeds / Functions / Automation / CCIP：分别用于价格/外部数据、链下 API 取数、自动化任务、跨链消息与资产流转。

## 3. 推荐目录结构

当前仓库可逐步整理为下面结构：

```text
sunways-asset/
  contracts/              # Foundry 合约工程
    src/
    script/
    test/
    foundry.toml
  backend/                # Go 后端
    cmd/api/
    cmd/indexer/
    internal/
      wallet/             # 钱包登录、签名、SIWE、账户会话
      nft/                # 能源 NFT / 能源资产凭证业务
      oracle/             # 设备数据采集、校验、上链
      settlement/         # 收益统计、分账、领取、对账
      trading/            # P2P 能源交易、订单、撮合、成交
      blockchain/         # 链底层封装，只暴露稳定接口给业务域
        client/           # eth client / rpc provider / chain config
        abi/              # ABI 加载器（从 contracts/abis/ 读取）
        contract/         # 合约 Go binding / 合约服务封装
        tx/               # 发交易、nonce、gas、receipt、重试
        listener/         # 链事件监听、区块扫描、reorg 处理
        event/            # event model、事件解析、领域事件映射
      repository/         # DB 读写
      config/             # 环境变量、链配置、合约地址
      auth/               # HTTP 鉴权、中间件、JWT/session
      worker/             # 后台任务、队列、定时任务
    migrations/
    go.mod
  src/                    # Next.js 前端
    app/                  # 中期迁移目标
    pages/                # 当前可运行结构
    components/
    contracts/            # 合约配置（sunways.ts 从 contracts/abis/ 导入 ABI）
    hooks/
    services/
    utils/
  config/                 # 链 ID、合约地址、环境配置
  docs/
```

如果暂时不拆 monorepo，也可以先保留独立的 Foundry 和 Go 仓库，但必须固定 ABI、合约地址和事件版本的同步方式。

## 4. 第一阶段：本地链和合约最小闭环

目标：在 Anvil 上完成“部署资产合约 -> 前端连接钱包 -> 后端读取事件”的闭环。

### 4.1 初始化 Foundry

在 `contracts/` 下创建 Foundry 工程：

```bash
mkdir -p contracts
cd contracts
forge init --force
forge install OpenZeppelin/openzeppelin-contracts
```

启动本地链：

```bash
anvil --chain-id 31337
```

建议固定本地链配置：

- chain id：`31337`
- RPC：`http://127.0.0.1:8545`
- 部署账户：只用于本地，不提交私钥。
- 合约地址：部署后写入 `config/chains.local.json`。

### 4.2 设计第一版合约边界

第一版合约不要一次做太大。建议拆成：

- `AssetRegistry`：登记能源资产，例如电站、设备、装机容量、地理区域、资产状态。
- `AssetToken`：表达资产份额或权益凭证。
- `RevenueVault`：接收收益、记录可领取额度、处理 claim。
- `PermissionManager`：管理发行方、运营方、审核方、暂停方。

第一版事件必须稳定，因为后端索引依赖事件：

```solidity
event AssetRegistered(uint256 indexed assetId, address indexed operator, string metadataURI);
event AssetStatusChanged(uint256 indexed assetId, uint8 status);
event RevenueDeposited(uint256 indexed assetId, address indexed token, uint256 amount);
event RevenueClaimed(uint256 indexed assetId, address indexed account, uint256 amount);
```

### 4.3 合约开发原则

- 所有状态变化都发事件。
- 业务错误用 custom errors，降低 gas 并提升可读性。
- 权限不要只靠单一 owner，使用角色或 AccessManager。
- 资产元数据先用 URI 指向链下 JSON，后续再接 IPFS/Arweave。
- 收益分配先支持单一 ERC20 或本地测试 Token，后续扩展多币种。
- 转让限制先用白名单或合规模块抽象，不要写死在业务合约里。

### 4.4 合约测试顺序

1. 单元测试：注册资产、更新状态、分红充值、领取收益。
2. 权限测试：非授权账户不能发行、暂停、分配收益。
3. Fuzz 测试：金额、份额、边界状态。
4. Invariant 测试：总收益、已领取、可领取之间永远守恒。
5. Fork 测试：接入真实测试网 Token 或预言机时使用。

推荐命令：

```bash
forge test -vvv
forge coverage
forge snapshot
```

## 5. 第二阶段：Go 后端

目标：后端不是替代链，而是把链上事实索引成可查询、可运营、可审计的业务系统。

### 5.1 后端模块

建议拆成两个进程：

- `api`：HTTP/gRPC API，服务前端和管理台。
- `indexer`：监听合约事件，写入数据库。

建议采用“业务域 + 链基础设施层”的结构。你当前规划的结构是合理的：

```text
internal/
  wallet/          # 钱包登录/签名
  nft/             # 能源NFT业务
  oracle/          # 设备数据上链
  settlement/      # 收益结算
  trading/         # P2P能源交易
  blockchain/      # 链底层封装

internal/blockchain/
  client/          # eth client
  abi/             # ABI json
  contract/        # 合约封装
  tx/              # 发交易
  listener/        # 链事件监听
  event/           # event model
```

建议补充的横向模块：

- `internal/config`：环境变量、链配置、合约地址、确认数、RPC fallback。
- `internal/repository`：数据库读写，不放进具体业务域，避免多处重复 SQL。
- `internal/auth`：HTTP 鉴权、SIWE session、JWT/session 中间件。
- `internal/worker`：后台任务、队列、定时结算、失败重试。
- `internal/http` 或 `internal/api`：handler、request/response DTO、路由。

模块边界建议：

- `wallet` 只负责钱包登录、nonce、签名校验、会话，不负责资产和交易业务。
- `nft` 负责能源资产 NFT 的发行、元数据、状态，不直接拼 RPC 调用；需要链操作时调用 `blockchain/contract` 或业务接口。
- `oracle` 负责设备数据接入、校验、签名证明、上链任务，不直接修改结算结果。
- `settlement` 负责收益计算、分账、领取、对账，可以读取 oracle 数据和链上事件投影。
- `trading` 负责订单、撮合、成交、取消、交易状态，不直接处理钱包登录和底层 nonce。
- `blockchain` 是基础设施层，只封装 RPC、ABI、合约、交易、监听、事件解析，不写能源业务规则。
- 业务域之间不要互相深度 import。需要跨域协作时，通过 service interface 或领域事件衔接。

`blockchain` 子目录职责建议：

- `client`：创建 RPC client、管理 chain id、确认数、fallback RPC、健康检查。
- `abi`：ABI 加载器，从 `contracts/abis/` 读取提取后的 ABI JSON（已实现：`contractabi.Load()`）。
- `contract`：封装合约读写方法，例如 `AssetRegistryService`、`RevenueVaultService`。
- `tx`：统一处理 nonce、gas 估算、EIP-1559 fee、receipt 等待、失败重试、交易幂等键。
- `listener`：按区块扫描事件、处理确认数、断点续扫、reorg 回滚。
- `event`：定义链上事件模型，并映射成业务事件，例如 `AssetRegistered`、`RevenueDeposited`。

这样拆分后，业务模块可以保持清爽，链升级、RPC 切换、ABI 变更也集中在 `blockchain` 层处理。

### 5.2 数据库表

第一版表可以包含：

- `assets`：资产 ID、链上 ID、名称、类型、容量、地区、状态、metadata URI。
- `asset_events`：事件名、区块号、交易哈希、log index、payload。
- `positions`：用户地址、资产 ID、份额、更新时间。
- `revenues`：资产 ID、币种、总收益、已领取、可领取快照。
- `users`：钱包地址、KYC 状态、角色、创建时间。
- `indexer_state`：最后处理区块、确认区块、重放状态。

事件唯一键建议使用：

```text
chain_id + contract_address + tx_hash + log_index
```

### 5.3 索引器规则

- 不直接信任 pending block，至少等 `N` 个确认数。
- 支持从任意区块重放。
- 支持处理 reorg：保存 block hash，发现不一致时回滚到安全高度。
- 事件处理保持幂等。
- 合约升级或事件变更时使用版本号。

### 5.4 API 第一版（已实现，共 30+ 端点）

已实现的端点按模块分组：

```text
# 健康检查
GET  /health

# 钱包认证
POST /auth/nonce
POST /auth/verify
GET  /auth/me
POST /auth/logout

# 资产查询
GET  /stations
GET  /stations/:id
GET  /stations/operation-statuses
GET  /dashboard/summary

# 收益
GET  /revenue/deposits
GET  /revenue/claims

# 碳积分
GET  /carbon/issuances
GET  /carbon/retirements

# 绿证
GET  /certificates/issuances

# 账户
GET  /accounts/summaries

# 索引器
GET  /indexer/status

# 平台工作台
GET    /platform/organizations
POST   /platform/organizations
GET    /platform/organization-members
POST   /platform/organization-members
GET    /platform/assets
POST   /platform/assets
GET    /platform/assets/:id
PATCH  /platform/assets/:id/status
GET    /platform/files
POST   /platform/files
POST   /platform/files/upload
POST   /platform/assets/:id/metadata
GET    /platform/assets/:id/issuance-check
GET    /platform/audit-logs

# 管理操作（后端代理签名）
POST  /admin/stations
POST  /admin/revenue-deposits
POST  /admin/carbon-credits
POST  /admin/green-certificates
PATCH /admin/stations/:id/review
PATCH /admin/stations/:id/operation-status
```

涉及发交易的操作：前端钱包签名优先；后端 Admin 代理仅在配置了 `ADMIN_PRIVATE_KEY` 时可用，用于运营管理场景。

## 6. 第三阶段：Next.js 前端

目标：先把钱包、资产列表、资产详情、收益领取跑通，再迁移到更现代的 App Router。

### 6.1 当前仓库状态

当前页面在：

- `src/pages/_app.tsx`
- `src/pages/index.tsx`
- `src/pages/globals.css`

依赖已经具备 Web3 前端基础：

- `viem`
- `wagmi`
- `@rainbow-me/rainbowkit`
- `@tanstack/react-query`

### 6.2 短期任务

1. 在 `config/` 增加本地链配置。
2. 在 `src/contracts/` 配置 ABI 导入（从 `contracts/abis/` 读取）和合约地址映射。
3. 在 `_app.tsx` 配置 Wagmi、RainbowKit、QueryClient Provider。
4. 首页替换默认模板，改成资产仪表盘。
5. 增加资产详情页、钱包持仓页、收益领取页。

### 6.3 中期迁移 App Router

Next 本地文档说明 Pages Router 仍被支持，但 App Router 承载最新特性。建议在基础功能跑通后迁移：

```text
src/app/
  layout.tsx
  page.tsx
  assets/page.tsx
  assets/[assetId]/page.tsx
  account/page.tsx
```

迁移策略：

- 链上交互组件标记为 client component。
- 资产列表等可缓存数据优先 server component 拉后端 API。
- 钱包状态、签名、交易按钮放在 client component。
- ABI 调用统一封装在 hooks，不散落到页面里。

### 6.4 前端页面优先级

1. 本地链连接状态：chain id、RPC、当前账户。
2. 资产列表：资产名称、类型、状态、容量、收益概览。
3. 资产详情：链上 ID、metadata、事件流、份额分布。
4. 我的持仓：资产份额、可领取收益。
5. 运营面板：注册资产、暂停资产、发放收益。

## 7. 第四阶段：资产数据和预言机

能源资产通常需要链下数据：

- 发电量。
- 设备状态。
- 电价。
- 收益入账。
- 碳减排或绿证数据。

开发顺序：

1. 本地 mock 数据：Go 后端定时写入模拟发电量。
2. 链下数据库留存原始数据和签名证明。
3. 必要时用 Chainlink Functions 把外部 API 结果带上链。
4. 自动分红、状态检查等周期任务用 Chainlink Automation 或后端任务先实现。
5. 跨链资产或跨链收益再评估 CCIP，不要第一版就跨链。

## 8. 第五阶段：合规和权限

RWA 能源资产要尽早设计合规边界：

- 钱包登录：SIWE。
- 身份状态：未认证、审核中、通过、拒绝、冻结。
- 转让限制：只允许合规地址接收。
- 发行权限：发行方和审核方分离。
- 运营权限：资产状态、收益入账、紧急暂停分离。
- 资金权限：生产环境使用多签，不使用单个 EOA。
- 审计日志：所有后台操作写入不可篡改日志。

如果资产份额可能被认定为证券或收益权，优先研究 ERC-3643 这类 permissioned token 标准，并在产品层明确限制转让和参与资格。

## 9. 第六阶段：测试策略

### 合约

- `forge test`：每次提交必须通过。
- fuzz 和 invariant：覆盖金额、份额、权限、暂停状态。
- gas snapshot：避免迭代中 gas 异常膨胀。
- Slither：静态分析。
- Mythril 或 Echidna：高风险模块补充。

### Go

- 单元测试：service、repository、event parser。
- 集成测试：启动 Anvil + 部署合约 + 跑 indexer。
- API 测试：认证、资产查询、收益查询。
- 压测：资产列表、事件查询、索引回放。

### 前端

- 类型检查：`tsc --noEmit`。
- Lint：`npm run lint`。
- 组件测试：钱包未连接、链错误、交易 pending、交易失败。
- E2E：Playwright 连接本地钱包模拟或 mock provider。

## 10. 第七阶段：部署路线

### 本地

```bash
anvil --chain-id 31337
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
go run ./cmd/indexer
go run ./cmd/api
npm run dev
```

### 测试网

1. 选择 Sepolia 或目标 L2 测试网。
2. 使用环境变量管理私钥和 RPC，不提交 `.env`。
3. 部署合约并验证源码。
4. 后端切换测试网 RPC，设置确认数。
5. 前端增加测试网配置。
6. 跑完整 E2E。

### 生产

- 合约部署使用多签。
- 后端私钥放 KMS/HSM 或专用签名服务。
- RPC 使用多供应商 fallback。
- 数据库开启 PITR 备份。
- 关键事件接入告警。
- 合约暂停和升级流程必须写成 runbook。

## 11. CI/CD

建议 GitHub Actions 或同类流水线分层：

```text
contracts:
  forge fmt --check
  forge test
  forge snapshot

backend:
  gofmt
  go test ./...
  golangci-lint run

frontend:
  npm ci
  npm run lint
  npm run build

security:
  slither .
  npm audit / osv-scanner
  go govulncheck ./...
```

合约部署不要自动直发生产。测试网可自动，生产必须人工审批和多签确认。

## 12. 里程碑清单

### M1：本地链资产闭环

- [x] `contracts/` Foundry 工程完成。
- [x] Anvil 本地链固定 chain id（`config/chains.local.json`）。
- [x] `PowerStationNFT` 可注册电站资产。
- [x] 部署脚本可部署第一组合约（4 个合约：PowerStationNFT、RevenueVault、CarbonCreditToken、GreenCertificate）。
- [x] 前端可连接本地链。
- [x] 首页显示链 ID、账户、资产列表（WalletStatus + PortfolioOverview）。

### M2：收益闭环

- [x] `RevenueVault` 支持充值和领取。
- [ ] Foundry 测试覆盖收益守恒。
- [x] Go indexer 可监听收益事件（RevenueDeposited、RevenueClaimed）。
- [x] 前端显示可领取收益（PortfolioOverview 后端数据 + 链上 fallback）。
- [ ] 用户可通过钱包发起 claim（Admin 面板已支持 deposit，前端用户 claim 待实现）。

### M3：后端业务化

- [x] PostgreSQL schema 完成（16 张表 via GORM AutoMigrate）。
- [x] indexer 支持重放和确认数（MarkIndexerSuccess/Failure、confirmations 配置）。
- [x] API 提供资产、事件、持仓、收益查询（30+ 端点）。
- [x] SIWE 登录完成（wallet + auth 模块）。
- [x] 管理角色和审计日志完成（PlatformAuditLog + admin 路由）。

### M4：测试网

- [ ] 测试网部署合约。
- [ ] 合约源码验证。
- [ ] 后端连接测试网。
- [ ] 前端支持测试网切换。
- [ ] 完成端到端测试。

### M5：生产准备

- [ ] 多签权限。
- [ ] 安全审计或内部审计清单。
- [ ] 监控告警。
- [ ] 备份和恢复演练。
- [ ] 合规流程确认。
- [ ] 发布 runbook。

## 13. 详细开发步骤：从钱包到能源交易

这一节按真实开发顺序拆。每一步都应该能单独验收；不要一开始就同时做 NFT、oracle、settlement、trading，否则问题会混在一起，很难定位。

推荐总顺序：

```text
P0 基础环境
  -> P1 钱包连接
  -> P2 钱包登录 / 签名认证
  -> P3 本地链和合约部署配置
  -> P4 能源 NFT / 资产登记
  -> P5 前端读取链上资产
  -> P6 后端监听链上事件
  -> P7 后端 API 资产查询
  -> P8 设备数据 oracle
  -> P9 收益 settlement
  -> P10 P2P trading
```

### P0：基础环境先跑通

目标：确认前端、后端、链三个入口都能启动。

要做的功能：

- 前端：`npm run dev` 能启动当前 Next.js 项目。
- 合约：创建 `contracts/` Foundry 工程。
- 后端：创建 `backend/` Go 工程骨架。
- 配置：统一本地链 `chainId = 31337`、RPC `http://127.0.0.1:8545`。

建议文件：

```text
config/chains.local.json
contracts/foundry.toml
backend/go.mod
backend/.env.example
```

验收标准：

- 前端能打开首页。
- `anvil --chain-id 31337` 能启动。
- `forge test` 能跑通。
- `go test ./...` 能跑通。

完成后下一步：做钱包连接。因为你的前端所有 Web3 操作都依赖账户和网络状态，钱包必须先稳定。

### P1：钱包连接

目标：前端先能连接钱包、识别账户、识别网络、切换到本地链。这是 Web3 产品第一块地基。

前端功能规划：

- 连接钱包按钮。
- 断开钱包。
- 显示当前账户地址。
- 显示短地址，例如 `0x1234...abcd`。
- 显示当前链 ID 和链名称。
- 检测是否为本地链 `31337`。
- 链不正确时提示切换网络。
- 支持添加/切换 Anvil 本地链。
- 钱包未安装时显示明确状态。
- 页面刷新后保持钱包连接状态。

建议技术实现：

- `@rainbow-me/rainbowkit`：钱包连接 UI。
- `wagmi`：账户、网络、连接器、切链 hooks。
- `viem`：定义本地链、RPC transport。
- `@tanstack/react-query`：wagmi 查询缓存依赖。

建议文件：

```text
src/config/chains.ts
src/config/wagmi.ts
src/components/wallet/WalletConnectButton.tsx
src/components/wallet/WalletStatus.tsx
src/hooks/useRequiredChain.ts
```

第一版页面只需要显示：

```text
连接钱包按钮
当前账户
当前网络
本地链状态
```

暂时不要做：

- 钱包签名登录。
- 合约写入。
- 资产列表。
- 后端用户系统。

验收标准：

- MetaMask 或 Rabby 能连接。
- 页面能显示当前地址。
- 页面能显示 `chainId`。
- 链不等于 `31337` 时能提示切换。
- 切到本地链后状态变为正常。
- 刷新页面后连接状态不丢。

完成后下一步：做钱包登录/签名。连接钱包只能证明“浏览器连上了某个地址”，还不能证明后端会话属于这个地址。

### P2：钱包登录 / 签名认证

目标：让 Go 后端能确认用户控制某个钱包地址，形成可用于 API 的登录态。

后端功能规划：

- `POST /auth/nonce`：根据钱包地址生成 nonce。
- `POST /auth/verify`：校验钱包签名。
- nonce 只能使用一次。
- nonce 设置过期时间，例如 5 分钟。
- 登录成功后签发 session 或 JWT。
- 保存用户钱包地址、首次登录时间、最后登录时间。

前端功能规划：

- 钱包连接后显示“签名登录”按钮。
- 请求 nonce。
- 用钱包签名登录消息。
- 提交签名给后端验证。
- 登录成功后保存 token/session。
- 登录失败时显示原因。

建议后端模块：

```text
internal/wallet       # nonce、签名校验、钱包账户
internal/auth         # session/JWT、中间件
internal/repository   # users、wallet_nonces
```

建议 API：

```text
POST /auth/nonce
POST /auth/verify
GET  /auth/me
POST /auth/logout
```

第一版数据库表：

```text
users
wallet_nonces
sessions
```

验收标准：

- 未连接钱包时不能登录。
- 签名正确时登录成功。
- 同一个 nonce 不能重复使用。
- nonce 过期后不能使用。
- `GET /auth/me` 能返回当前用户地址。

完成后下一步：做本地链合约配置。用户身份闭环完成后，再进入链上资产功能。

### P3：本地链和合约部署配置

目标：统一前端、后端、合约三边使用同一套链配置和合约地址。

要做的功能：

- 启动 Anvil 本地链。
- Foundry 部署脚本部署合约。
- 部署结果输出到 JSON。
- 前端读取合约地址和 ABI。
- 后端读取合约地址和 ABI。

建议文件：

```text
contracts/script/DeployLocal.s.sol
config/chains.local.json
config/contracts.local.json
contracts/abis/PowerStationNFT.json  # 前后端 ABI 单一来源
```

部署结果建议格式：

```json
{
  "chainId": 31337,
  "rpcUrl": "http://127.0.0.1:8545",
  "contracts": {
    "AssetRegistry": "0x..."
  },
  "deployedBlock": 1
}
```

验收标准：

- 重新部署后能更新合约地址。
- 前端显示当前 `AssetRegistry` 地址。
- 后端启动时能读取同一个地址。
- 地址缺失时前后端都有清晰错误提示。

完成后下一步：做能源 NFT / 资产登记合约。

### P4：能源 NFT / 资产登记

目标：先定义“能源资产”最小模型，并把资产登记到链上。

第一版资产字段：

```text
assetId
name
assetType       # solar、wind、storage
capacity
location
operator
metadataURI
status          # pending、active、paused、retired
createdAt
```

合约功能规划：

- `registerAsset(...)`：注册能源资产。
- `getAsset(uint256 assetId)`：读取资产详情。
- `setAssetStatus(uint256 assetId, uint8 status)`：修改状态。
- `totalAssets()`：资产总数。
- 可选：如果你明确要 NFT 化，再加 ERC-721 `ownerOf`、`tokenURI`。

事件规划：

```solidity
event AssetRegistered(uint256 indexed assetId, address indexed operator, string metadataURI);
event AssetStatusChanged(uint256 indexed assetId, uint8 status);
```

建议合约：

```text
contracts/src/AssetRegistry.sol
```

验收标准：

- owner 可以注册资产。
- 非 owner 不能注册资产。
- 注册后能读取资产详情。
- 修改状态会发事件。
- `forge test -vvv` 全部通过。

完成后下一步：前端读取链上资产。先读，不急着让普通用户写。

### P5：前端读取链上资产

目标：用户连接钱包后，能看到本地链上的能源资产。

前端功能规划：

- 读取 `totalAssets()`。
- 按 `assetId` 批量读取资产详情。
- 展示资产卡片或表格。
- 展示资产状态。
- 展示运营方地址。
- 展示链上读取 loading/error 状态。
- 合约地址为空时显示配置错误。

建议文件：

```text
src/hooks/useAssetRegistry.ts
src/hooks/useAssets.ts
src/components/assets/AssetList.tsx
src/components/assets/AssetStatusBadge.tsx
```

第一版数据来源：

```text
链上合约读取为主
后端 API 暂时不接
```

验收标准：

- 部署合约后，前端能显示资产总数。
- 注册资产后刷新页面能看到资产。
- 钱包未连接时页面不崩。
- 链错误时不发错误链的合约请求。

完成后下一步：Go 后端监听资产事件。前端能看链上数据后，再让后端做索引。

### P6：Go 后端监听链上事件

目标：后端开始把链上事件同步到数据库。

第一版模块：

```text
internal/blockchain/client
internal/blockchain/abi
internal/blockchain/listener
internal/blockchain/event
internal/nft
internal/repository
```

功能规划：

- 连接 Anvil RPC。
- 读取 `AssetRegistry` 合约地址。
- 从部署区块开始扫描日志。
- 解析 `AssetRegistered`。
- 解析 `AssetStatusChanged`。
- 写入 `asset_events`。
- 更新 `assets` 投影表。
- 保存 `indexer_state`。

第一版数据库表：

```text
assets
asset_events
indexer_state
```

验收标准：

- 注册资产后，后端日志能看到事件。
- 数据库 `assets` 有对应资产。
- 同一个 `tx_hash + log_index` 不重复入库。
- indexer 重启后能继续扫描。
- 清空业务表后可以从起始区块重放。

完成后下一步：Go API 返回资产列表。后端有数据后，前端再从 API 读聚合结果。

### P7：Go API 资产查询

目标：后端成为业务查询层，前端不用所有数据都扫链。

API 规划：

```text
GET /health
GET /chains
GET /assets
GET /assets/:id
GET /assets/:id/events
```

前端调整：

- 资产列表优先读 Go API。
- 详情页展示链上事件时间线。
- 关键字段可以保留链上读取作为校验。

验收标准：

- 前端资产列表来自 Go API。
- API 数据和链上 assetId 对得上。
- 后端停掉时，前端显示 API 不可用。
- 合约读取错误和 API 错误分开提示。

完成后下一步：设备数据 oracle。资产已经存在并可查询后，再把真实或模拟设备数据挂到资产上。

### P8：设备数据 Oracle

目标：把设备发电量、储能状态、运行状态等数据接入系统，并决定哪些数据需要上链。

第一版不要直接接真实硬件，先做 mock：

- Go 定时生成设备数据。
- 数据写入数据库。
- 对数据做签名或 hash。
- 必要字段通过合约事件上链。

后端模块：

```text
internal/oracle
internal/worker
internal/blockchain/tx
```

数据字段建议：

```text
assetId
deviceId
timestamp
powerOutput
energyProduced
deviceStatus
dataHash
signature
```

验收标准：

- 每个资产能看到设备数据时间序列。
- 后端能生成 mock 发电量。
- 数据 hash 能和原始数据对应。
- 上链交易失败时有重试和错误记录。

完成后下一步：收益结算。收益不能凭空算，应该基于资产和设备数据。

### P9：收益结算

目标：根据资产、设备数据、价格或收益入账，计算每个持有人的可领取收益。

功能规划：

- 记录资产收益入账。
- 计算资产总收益。
- 根据份额计算用户可领取金额。
- 防止重复领取。
- 链上发出 `RevenueDeposited`、`RevenueClaimed` 事件。
- 后端做对账和可视化。

合约建议：

```text
RevenueVault.sol
```

后端模块：

```text
internal/settlement
internal/blockchain/contract
internal/blockchain/listener
```

验收标准：

- 给某个资产充值收益后，用户可领取金额变化。
- 用户 claim 后，可领取金额减少。
- 总入账 = 已领取 + 未领取。
- 重复 claim 不会多领。

完成后下一步：P2P 交易。收益模型稳定后，再允许用户交易资产份额。

### P10：P2P 能源交易

目标：支持用户之间交易能源资产份额、能源额度或能源凭证。

第一版建议先做订单簿，不急着做复杂撮合：

- 创建卖单。
- 取消卖单。
- 查询订单。
- 买家接受订单。
- 成交后更新持仓。
- 记录交易事件。

后端模块：

```text
internal/trading
internal/settlement
internal/wallet
internal/blockchain/tx
```

需要提前想清楚：

- 交易的是 NFT、份额 token，还是链下订单对应链上结算。
- 是否允许未 KYC 用户交易。
- 成交资金用 ETH、稳定币，还是平台积分。
- 手续费如何收。
- 订单过期和取消如何处理。

验收标准：

- 用户能创建卖单。
- 另一个用户能买入。
- 成交后持仓变化正确。
- 取消订单后不能成交。
- 交易事件可追溯。

### 阶段完成后的产品路线

完成 P0 到 P7，你得到的是“能源资产登记和展示系统”。  
完成 P8，你得到的是“带设备数据证明的能源资产系统”。  
完成 P9，你得到的是“可收益结算的能源资产系统”。  
完成 P10，你才进入“可交易的能源资产市场”。

这个顺序很重要：交易必须排在资产、身份、数据、收益之后。否则你会先做出交易壳子，但没有可信资产、可信数据和可审计收益。

## 13-bis. 已实现的平台工作流（超出原计划的增量功能）

以下功能在 P3-P7 实施过程中自然地演进出来，用于支撑资产从"线下草稿"到"链上发行"的完整生命周期。

### 组织管理

在资产注册之前，先建立组织身份：

- `POST /platform/organizations`：创建组织（名称、类型、注册号、联系方式、钱包地址）。
- `GET /platform/organizations`：列出所有组织。
- `POST /platform/organization-members`：添加组织成员（角色：admin / member）。
- `GET /platform/organization-members`：按组织查询成员。

数据模型：[backend/internal/repository/models.go](backend/internal/repository/models.go) 中的 `Organization` / `OrganizationMember`。

### 资产草稿生命周期

在链上 mint 之前，资产以草稿形式在平台内流转：

```
draft → submitted → approved → (metadata 生成 + IPFS 上传) → 链上 mint（成为 Station NFT）
```

API：
- `POST /platform/assets`：创建资产草稿（名称、类型、地区、容量、预期收益、钱包地址等）。
- `GET /platform/assets?status=xxx`：按状态筛选草稿列表。
- `GET /platform/assets/:id`：查看单个草稿。
- `PATCH /platform/assets/:id/status`：状态变更（提交审核 / 批准 / 驳回），记录审核意见。
- `POST /platform/assets/:id/metadata`：根据草稿字段 + 关联文件生成 ERC-721 metadata JSON，并上传到 IPFS。
- `GET /platform/assets/:id/issuance-check`：发行前检查清单（状态是否为 approved、metadata URI 是否已设置、钱包地址是否合法、是否有上传文件、是否已经 mint 过）。

数据模型：`AssetDraft`（[backend/internal/repository/models.go:66-90](backend/internal/repository/models.go#L66-L90)）。

### 文件管理 + IPFS

- `POST /platform/files/upload`：通过 Filebase S3 兼容 API 上传文件到 IPFS，返回 CID、IPFS URI、Gateway URL。
- `POST /platform/files`：记录文件元数据（关联到资产草稿和组织）。
- `GET /platform/files?assetDraftId=xxx`：按资产草稿查询文件列表。

实现：[backend/internal/filebase/service.go](backend/internal/filebase/service.go)，通过 AWS SDK 对接 Filebase 的 S3 兼容接口。配置项：
- `FILEBASE_ACCESS_KEY` / `FILEBASE_SECRET_KEY` / `FILEBASE_BUCKET` / `FILEBASE_GATEWAY_URL`

### 元数据生成

[backend/internal/metadata/service.go](backend/internal/metadata/service.go) 根据资产草稿生成符合 ERC-721 Metadata JSON 标准的 metadata，包含：
- 名称、描述、图片
- 属性列表（资产类型、国家、地区、容量、预期年发电量、预期收益、经纬度）
- 关联文档列表（从 AssetFile 中提取的 IPFS 链接）
- 可直接上传到 IPFS 作为 `tokenURI`

### 管理后台链上操作

[backend/internal/admin/service.go](backend/internal/admin/service.go) 支持后端用配置的私钥签名并发送交易：

- `POST /admin/stations`：调用 PowerStationNFT.registerStation() 链上注册。
- `POST /admin/revenue-deposits`：调用 RevenueVault.depositNative() 入账收益。
- `POST /admin/carbon-credits`：调用 CarbonCreditToken.mintCarbonCredits() 发行碳积分。
- `POST /admin/green-certificates`：调用 GreenCertificate.issueCertificate() 发行绿证。
- `PATCH /admin/stations/:id/review`：更新数据库中的审核状态（不涉及链上交易）。
- `PATCH /admin/stations/:id/operation-status`：更新运维状态和利用率（不涉及链上交易）。

前端对应组件：[src/components/dashboard/AdminConsole.tsx](src/components/dashboard/AdminConsole.tsx)。

### 运维状态追踪

`StationOperationStatus` 表（[backend/internal/repository/models.go:141-150](backend/internal/repository/models.go#L141-L150)）记录每个电站的运行状态：
- 状态（normal / warning / fault / maintenance）
- 利用率百分比
- 备注
- 更新人和更新时间

### 审计日志

所有平台操作写入 `PlatformAuditLog` 表（[backend/internal/repository/models.go:109-119](backend/internal/repository/models.go#L109-L119)），记录：
- 组织 ID、操作人地址
- 操作类型、资源类型、资源 ID
- 操作结果和摘要
- 可通过 `GET /platform/audit-logs` 查询。

### 三层数据源策略

前端的数据展示采用三层 fallback 策略：
1. **Backend**：优先从 Go API 读取索引后的聚合数据。
2. **On-chain**：API 不可用时直接从合约读取链上数据。
3. **Mock**：链也不可用时使用本地 mock 数据保证 UI 不白屏。

实现见 [src/components/dashboard/PortfolioOverview.tsx](src/components/dashboard/PortfolioOverview.tsx) 的 `metrics` 数组逻辑。

## 14. 当前最应该做的下一步

你的下一步应该做 **P8 设备数据 Oracle**。P0~P7 已经全部完成——钱包连接、签名登录、合约部署、前端链上读取、后端事件索引、API 查询、平台工作台和管理控制台都已就绪。

具体执行顺序：

1. 在 Go 后端 `internal/oracle` 中实现定时任务，按资产生成模拟设备数据（发电量、储能状态、运行状态）。
2. 设备数据写入数据库，对数据做 hash 或签名证明。
3. 必要时将关键字段通过合约事件上链（如日均发电量、设备状态变更）。
4. 前端在资产详情页展示设备数据时间序列。
5. 之后进入 P9 收益结算——将设备数据作为收益计算的输入，自动计算用户可领取金额。

当前已完成的 P8 前置条件：
- `station_operation_statuses` 表已建，支持利用率和运行状态更新。
- `internal/admin/service.go` 已具备后端签名发交易能力，可直接用于数据上链。
- `internal/worker` 目录预留，可放置定时任务。

## 15. 参考资料

- Next.js 本地文档：`node_modules/next/dist/docs/index.md`、`node_modules/next/dist/docs/02-pages/index.md`
- Foundry Book：https://book.getfoundry.sh/
- viem：https://viem.sh/
- wagmi：https://wagmi.sh/
- RainbowKit：https://www.rainbowkit.com/docs/introduction
- OpenZeppelin Contracts：https://docs.openzeppelin.com/contracts/
- Chainlink Docs：https://docs.chain.link/
- The Graph Docs：https://thegraph.com/docs/
- ERC-3643：https://erc3643.org/
- EIP-4337：https://eips.ethereum.org/EIPS/eip-4337

# 个人备忘录， 不需要关注。


创建项目
npx create-next-app@latest sunways-asset

安装web3依赖
npm install wagmi viem @rainbow-me/rainbowkit @tanstack/react-query

wagmi:
React 的 Web3 Hooks 框架. 它相当于：React版 Web3 SpringBoot
功能	wagmi
连接钱包	√
获取钱包地址	√
获取余额	√
签名消息	√
调用合约	√
监听链状态	√
自动重连钱包	√

viem:
新一代 Ethereum SDK. 和区块链通信。 以前：ethers.js, web3.js,
功能：
调用RPC
读取链数据
编码ABI
解码返回值
调用合约
发交易

对比	ethers.js	viem
TypeScript	一般	极强
性能	一般	更快
tree shaking	差	好
类型推导	一般	非常强
wagmi兼容	新版核心	官方


RainbowKit：
钱包连接 UI 组件库，帮你直接生成：Connect Wallet 按钮。
如果没有 RainbowKit你得自己做：
钱包弹窗
MetaMask检测
WalletConnect
多钱包适配
UI
网络切换
钱包列表

React Query：
前端缓存服务端数据
因为链数据：
请求慢
RPC不稳定
需要缓存
需要自动刷新

### 第一次没有先创建
anvil --chain-id 31337 --dump-state config/anvil-state.json

anvil --chain-id 31337 --load-state config/anvil-state.json --dump-state config/anvil-state.json


1. 停 API 和 INDEXER
2. 启动 Anvil
3. 重新部署合约
4. 更新 config/chains.local.json 里的新合约地址
5. 清 PG 旧数据
TRUNCATE TABLE
  asset.indexer_states,
  asset.indexed_blocks,
  asset.chain_events,
  asset.stations,
  asset.station_operation_statuses,
  asset.revenue_deposits,
  asset.revenue_claims,
  asset.carbon_credit_issuances,
  asset.carbon_credit_retirements,
  asset.green_certificate_issuances,
  asset.user_asset_summaries
RESTART IDENTITY;
6. 启动 API
7. 启动 INDEXER
8. 前端刷新




### 重新部署

# 1. 部署合约
cd contracts
forge script script/DeploySunways.s.sol:DeploySunways \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

# 2. 更新 config/chains.local.json 里的合约地址（用上面输出的新地址）

# 3. 跑 seed
POWER_STATION_NFT=0x8464135c8F25Da09e49BC8782676a84730C318bC \
REVENUE_VAULT=0x71C95911E9a5D330f4D621842EC243EE1343292e \
CARBON_CREDIT_TOKEN=0x948B3c65b89DF0B4894ABE91E6D02FE579834F8F \
GREEN_CERTIFICATE=0x712516e61C8B383dF4A63CFe83d7701Bce54B03e \
forge script script/SeedLocal.s.sol:SeedLocal \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --private-key 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

# 4. 停 Anvil（这会触发 --dump-state 写入 config/anvil-state.json）
kill $(pgrep anvil)

# 5. 重新用持久化模式启动
cd .. \
anvil --chain-id 31337 --load-state config/anvil-state.json --dump-state config/anvil-state.json
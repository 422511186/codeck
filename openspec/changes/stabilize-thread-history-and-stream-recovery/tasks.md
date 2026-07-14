## 1. 历史消息时间

- [x] 1.1 添加失败测试，复现分页 item 缺少 createdAt 时所有历史消息使用请求时间并显示“刚刚”
- [x] 1.2 实现 item/turn 稳定时间解析、UUIDv7 turnId fallback 和 Unix 秒到毫秒规范化
- [x] 1.3 覆盖 snapshot、pagination、非 UUID turnId 及同 turn 多条消息的时间回归测试

## 2. 分页视口锚点

- [x] 2.1 添加失败测试，断言页面层 prepend 后不得直接修改滚动位置
- [x] 2.2 删除页面层 scrollHeight 差值补偿，由 Timeline 独占短列表和虚拟列表锚点恢复
- [x] 2.3 覆盖动态 Markdown/activity 高度变化，并断言加载前顶部消息 identity 与 viewport offset 保持不变

## 3. 上游断流恢复

- [x] 3.1 锁定一次发送只调用一次 startTurn、相同 clientUserMessageId 去重和 error notification 不自动重发
- [x] 3.2 验证失败用户消息保留文本、图片与 skill 引用，并可通过显式“重试”重新发送
- [x] 3.3 记录 `apihzy.wbw.pub` 上游流式故障边界，不在 Web 中增加不安全的自动 turn 重放

## 4. 验证与部署

- [x] 4.1 运行相关 Vitest、`npm run verify`、OpenSpec 校验和 `npm run release:verify`
- [x] 4.2 使用生产长会话和手机视口验证历史时间、连续分页、顶部消息像素位置及断流失败状态
- [x] 4.3 提交全部代码，基于 `codex-web:local` 构建镜像并替换 `codex-web-19899`
- [x] 4.4 验证健康接口、metadata 零 timeline、连续四页 cursor 分页和容器日志

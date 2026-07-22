## 1. 统一 warning 迁移

- [x] 1.1 为历史分页、live item 和相反模型恢复方向补充失败回归测试，确认已知 warning 不进入 timeline 且最新方向覆盖旧 notice
- [x] 1.2 在所有 store timeline ingress 统一提取已知 warning，并为模型恢复、metadata 与长线程 notice 使用稳定语义 identity
- [x] 1.3 运行 timeline adapter、thread notices 与 store events 定向测试，确认真实错误仍保留为 timeline error

## 2. 稳定分页滚动锚点

- [x] 2.1 为长 timeline prepend 补充失败回归测试，证明虚拟列表接管后页面层不再重复恢复 DOM anchor
- [x] 2.2 让 Timeline 显式声明滚动锚点所有权，并让页面层只在非虚拟列表场景捕获和恢复 DOM anchor
- [x] 2.3 为虚拟窗口 prepend 补充失败回归测试，并在浏览器绘制前同步修正 `windowRange`
- [x] 2.4 覆盖 prepend 后延迟高度变化与分页边界 activity group，确认可见消息 identity 和像素偏移保持稳定

## 3. 保持跨页 timeline 顺序

- [x] 3.1 为分页 identity 重叠、page-local ordinal 重复和同 turn/activity group 跨页补充失败回归测试
- [x] 3.2 修正分页合并中被回归测试证明不稳定的排序或去重逻辑，保持当前窗口正文与相对顺序不变

## 4. 验证

- [x] 4.1 运行相关 Vitest 定向测试并修复回归
- [x] 4.2 运行 `npm run verify` 与 `npm run build`
- [x] 4.3 运行 `openspec validate --all --strict` 并确认 change 全部任务完成

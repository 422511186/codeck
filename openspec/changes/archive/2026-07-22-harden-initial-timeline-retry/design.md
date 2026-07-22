# 设计

## 现状与根因

首屏 effect 失败后仅调用 `setError`，错误视图只渲染错误文本和 `router.back()`。加载 effect 没有可触发的重试 token，因此同一页面不能重新执行 metadata 与 bounded page 请求。

## 决策

1. 新增递增的 `initialLoadAttempt` 状态作为 effect 依赖；每次重试建立新的 request token 和 guard。
2. effect 启动时清除旧错误并进入 loading；完成后仍由取消标记和 request token 丢弃旧回调，避免重试期间迟到响应覆盖新结果。
3. 错误视图保留当前错误文本和返回按钮，增加 `重试` 按钮；重试失败继续更新错误文本，不伪装为空会话。
4. 不为已存在 cached detail 的局部 repair 错误增加第二套 retry 状态；现有 repair scheduler 继续处理该路径。

## 状态流

```text
initial request -> loading -> detail/timeline
                       |
                       +-- error -> error + retry/back
                                      |
                                      +-- retry -> new request token
```

## 验证

- 首次 page 失败后点击重试，第二次成功必须显示 empty/timeline 页面。
- 连续失败必须保留第二次错误，不能恢复旧错误或旧 detail。

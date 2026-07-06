## 1. 测试

- [x] 1.1 在 `tests/unit/web-login-page.test.tsx` 中新增/调整用例断言登录成功后调用文档级 replace 导航。
- [x] 1.2 新增/调整用例断言已认证访问登录页自动跳转时调用文档级 replace 导航。
- [x] 1.3 先运行登录页单测，确认新增刷新断言在实现前失败。

## 2. 实现

- [x] 2.1 增加 `src/web/navigation/location.ts` 文档导航封装，并在 `src/app/login/page.tsx` 复用安全返回路径。
- [x] 2.2 在提交 Token 登录成功和已认证自动跳转两个路径中，使用文档级 replace 导航跳转目标页。

## 3. 验证

- [x] 3.1 运行 `npm run test -- tests/unit/web-login-page.test.tsx`，确认回归用例通过。
- [x] 3.2 运行 `npm run typecheck`，确认类型检查通过。

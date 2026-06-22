export function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span className={connected ? "badge badge-online" : "badge"}>
      {connected ? "已连接" : "未连接"}
    </span>
  );
}

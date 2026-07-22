import type { ReactNode } from "react";

export default function SettingsLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      data-settings-scroll-viewport="true"
      style={{
        width: "100%",
        height: "100dvh",
        minHeight: 0,
        boxSizing: "border-box",
        overflowY: "auto",
        overscrollBehaviorY: "contain",
        paddingBottom: "var(--safe-bottom)",
        WebkitOverflowScrolling: "touch"
      }}
    >
      {children}
    </div>
  );
}

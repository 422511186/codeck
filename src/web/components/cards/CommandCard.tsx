"use client";

import type { CommandEntry } from "../../state/timeline";
import { BaseCard } from "./BaseCard";
import { LongTextPreview } from "./LongTextPreview";

export function CommandCard({ entry }: { entry: CommandEntry }): JSX.Element {
  return (
    <BaseCard
      icon="$"
      title={<code style={{ fontFamily: "var(--font-mono)" }}>{entry.command}</code>}
      status={entry.status}
    >
      <LongTextPreview text={entry.output ?? ""} emptyText="（无输出）" copyLabel="复制完整输出" />
    </BaseCard>
  );
}

export type TimelineDomScrollAnchor = {
  blockId: string;
  entryId: string;
  viewportOffset: number;
};

function timelineRows(scroller: HTMLElement): HTMLElement[] {
  return [...scroller.querySelectorAll<HTMLElement>("[data-timeline-row='true']")];
}

export function captureTimelineDomScrollAnchor(scroller: HTMLElement): TimelineDomScrollAnchor | null {
  const viewport = scroller.getBoundingClientRect();
  const row = timelineRows(scroller).find((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return rect.bottom > viewport.top && rect.top < viewport.bottom;
  });
  const blockId = row?.dataset.timelineBlockId;
  const entryId = row?.dataset.timelineEntryId;
  if (!row || !blockId || !entryId) {
    return null;
  }
  return {
    blockId,
    entryId,
    viewportOffset: row.getBoundingClientRect().top - viewport.top
  };
}

export function restoreTimelineDomScrollAnchor(
  scroller: HTMLElement,
  anchor: TimelineDomScrollAnchor
): boolean {
  const row = timelineRows(scroller).find(
    (candidate) =>
      candidate.dataset.timelineBlockId === anchor.blockId ||
      candidate.dataset.timelineEntryId === anchor.entryId
  );
  if (!row) {
    return false;
  }
  const viewportTop = scroller.getBoundingClientRect().top;
  const nextOffset = row.getBoundingClientRect().top - viewportTop;
  const delta = nextOffset - anchor.viewportOffset;
  if (Math.abs(delta) >= 1) {
    scroller.scrollTop += delta;
  }
  return true;
}

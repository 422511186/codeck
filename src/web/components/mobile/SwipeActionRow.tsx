"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type CSSProperties } from "react";

export type SwipeAction = {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  "aria-label"?: string;
};

type SwipeActionRowProps = {
  children: ReactNode;
  action: SwipeAction;
  onContentClick?: () => void;
  disabled?: boolean;
  actionWidth?: number;
  openThreshold?: number;
  className?: string;
  style?: CSSProperties;
  contentStyle?: CSSProperties;
  "data-testid"?: string;
};

/**
 * Mobile list row: swipe left to reveal an action button.
 * Opening does not auto-fire the action; the user must tap the button.
 */
export function SwipeActionRow({
  children,
  action,
  onContentClick,
  disabled = false,
  actionWidth = 88,
  openThreshold = 40,
  className,
  style,
  contentStyle,
  "data-testid": testId
}: SwipeActionRowProps): JSX.Element {
  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number; offset: number } | null>(null);
  const axisRef = useRef<"undecided" | "horizontal" | "vertical">("undecided");

  useEffect(() => {
    if (disabled) {
      setOffsetBoth(0);
      setDragging(false);
      startRef.current = null;
      axisRef.current = "undecided";
    }
  }, [disabled]);

  function setOffsetBoth(value: number): void {
    offsetRef.current = value;
    setOffset(value);
  }

  function close(): void {
    setOffsetBoth(0);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (disabled || event.button !== 0) return;
    startRef.current = { x: event.clientX, y: event.clientY, offset: offsetRef.current };
    axisRef.current = "undecided";
    setDragging(true);
    const target = event.currentTarget;
    if (typeof target.setPointerCapture === "function") {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // jsdom / unsupported environments
      }
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const start = startRef.current;
    if (!start || disabled) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (axisRef.current === "undecided") {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axisRef.current = Math.abs(dy) > Math.abs(dx) ? "vertical" : "horizontal";
      if (axisRef.current === "vertical") {
        startRef.current = null;
        setDragging(false);
        return;
      }
    }

    if (axisRef.current !== "horizontal") return;

    event.preventDefault();
    const next = clamp(start.offset + dx, -actionWidth, 0);
    setOffsetBoth(next);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!dragging && !startRef.current) return;
    const start = startRef.current;
    const axis = axisRef.current;
    startRef.current = null;
    setDragging(false);

    if (axis === "horizontal") {
      const shouldOpen = offsetRef.current <= -openThreshold;
      setOffsetBoth(shouldOpen ? -actionWidth : 0);
      return;
    }

    const moved =
      start != null &&
      (Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8);
    if (!moved && offsetRef.current === 0) {
      onContentClick?.();
    } else if (!moved && offsetRef.current !== 0) {
      close();
    }
  }

  function handlePointerCancel(): void {
    startRef.current = null;
    setDragging(false);
    setOffsetBoth(offsetRef.current <= -openThreshold ? -actionWidth : 0);
  }

  function handleActionClick(): void {
    if (action.disabled) return;
    action.onClick();
    close();
  }

  const actionColor = action.tone === "danger" ? "var(--cw-danger)" : "var(--cw-accent)";

  return (
    <div
      className={className}
      data-testid={testId}
      data-swipe-row="true"
      data-swipe-open={offset < 0 ? "true" : "false"}
      style={{
        position: "relative",
        overflow: "hidden",
        touchAction: "pan-y",
        ...style
      }}
    >
      <div
        data-swipe-action-panel="true"
        style={{
          position: "absolute",
          inset: "0 0 0 auto",
          width: actionWidth,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "stretch"
        }}
      >
        <button
          type="button"
          data-swipe-action="true"
          aria-label={action["aria-label"] ?? action.label}
          disabled={action.disabled || disabled}
          onClick={handleActionClick}
          style={{
            flex: 1,
            border: "none",
            background: actionColor,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            opacity: action.disabled || disabled ? 0.55 : 1
          }}
        >
          {action.label}
        </button>
      </div>

      <div
        data-swipe-content="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{
          position: "relative",
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: dragging ? "none" : "transform 160ms ease",
          background: "var(--cw-card)",
          touchAction: "pan-y",
          ...contentStyle
        }}
      >
        {children}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

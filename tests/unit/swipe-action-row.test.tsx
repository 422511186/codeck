import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SwipeActionRow } from "../../src/web/components/mobile/SwipeActionRow";

function renderRow(onAction = vi.fn(), onContentClick = vi.fn()) {
  render(
    <SwipeActionRow
      data-testid="row"
      action={{ label: "归档", onClick: onAction }}
      onContentClick={onContentClick}
      actionWidth={88}
      openThreshold={40}
    >
      <div>会话标题</div>
    </SwipeActionRow>
  );
  return {
    onAction,
    onContentClick,
    content: screen.getByText("会话标题").parentElement as HTMLElement,
    action: screen.getByRole("button", { name: "归档" }),
    row: screen.getByTestId("row")
  };
}

function swipeLeft(target: HTMLElement, fromX = 200, toX = 100, y = 20): void {
  fireEvent.pointerDown(target, { button: 0, clientX: fromX, clientY: y, pointerId: 1 });
  fireEvent.pointerMove(target, { button: 0, clientX: toX, clientY: y, pointerId: 1 });
  fireEvent.pointerUp(target, { button: 0, clientX: toX, clientY: y, pointerId: 1 });
}

describe("SwipeActionRow", () => {
  it("does not fire action when only opened by swipe", () => {
    const { content, onAction, row } = renderRow();
    swipeLeft(content);
    expect(onAction).not.toHaveBeenCalled();
    expect(row).toHaveAttribute("data-swipe-open", "true");
  });

  it("fires action when revealed button is clicked", () => {
    const { content, action, onAction } = renderRow();
    swipeLeft(content);
    fireEvent.click(action);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("cancels swipe when gesture is mainly vertical", () => {
    const { content, onAction, onContentClick, row } = renderRow();
    fireEvent.pointerDown(content, { button: 0, clientX: 200, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(content, { button: 0, clientX: 198, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(content, { button: 0, clientX: 198, clientY: 80, pointerId: 1 });
    expect(onAction).not.toHaveBeenCalled();
    expect(onContentClick).not.toHaveBeenCalled();
    expect(row).toHaveAttribute("data-swipe-open", "false");
  });

  it("invokes content click on simple tap when closed", () => {
    const { content, onContentClick, onAction } = renderRow();
    fireEvent.pointerDown(content, { button: 0, clientX: 200, clientY: 20, pointerId: 1 });
    fireEvent.pointerUp(content, { button: 0, clientX: 201, clientY: 21, pointerId: 1 });
    expect(onContentClick).toHaveBeenCalledTimes(1);
    expect(onAction).not.toHaveBeenCalled();
  });
});

import { getAppServerGateway, unauthorized } from "../_route-helpers";
import { browserEventId, type BrowserTimelineEvent } from "../../../../server/app-server/runtime";
import { browserTimelineEventForBudget } from "../../../../server/timeline-event-payload";

export const dynamic = "force-dynamic";

const SSE_HEARTBEAT_INTERVAL_MS = 15_000;

type TimelineGapEvent = {
  type: "timeline-gap";
  lastEventId: string;
  threadId?: string;
};

export async function GET(request: Request): Promise<Response> {
  const unauthorizedResponse = unauthorized(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const gateway = getAppServerGateway();
  const url = new URL(request.url);
  const lastEventId = request.headers.get("last-event-id") || url.searchParams.get("lastEventId");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const send = (event: BrowserTimelineEvent) => {
        write(encodeSseEvent(browserEventId(event), event));
      };
      const liveBuffer: BrowserTimelineEvent[] = [];
      let replaying = true;
      const unsubscribe = gateway.onBrowserEvent((event) => {
        if (replaying) {
          liveBuffer.push(event);
          return;
        }
        send(event);
      });
      const backlog = gateway.listBrowserEventBacklog(lastEventId);
      const sentIds = new Set<string>();
      const sendOnce = (event: BrowserTimelineEvent) => {
        const id = browserEventId(event);
        if (sentIds.has(id)) {
          return;
        }
        sentIds.add(id);
        write(encodeSseEvent(id, event));
      };

      write(": connected\n\n");
      const heartbeat = setInterval(() => {
        write(": ping\n\n");
      }, SSE_HEARTBEAT_INTERVAL_MS);
      if (backlog.gap && lastEventId) {
        const threadId = threadIdFromBrowserEventId(lastEventId);
        write(encodeSseData({ type: "timeline-gap", lastEventId, ...(threadId ? { threadId } : {}) }));
      }
      for (const event of backlog.events) {
        sendOnce(event);
      }
      for (const event of liveBuffer) {
        sendOnce(event);
      }
      replaying = false;

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // The stream may already be closed by the runtime.
        }
      };
      request.signal.addEventListener("abort", close, { once: true });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

function encodeSseEvent(id: string, event: BrowserTimelineEvent): string {
  return `id: ${id}\n${encodeSseData(browserTimelineEventForBudget(event))}`;
}

function encodeSseData(event: BrowserTimelineEvent | TimelineGapEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function threadIdFromBrowserEventId(eventId: string): string | null {
  const match = /^([^:\s]+):\d+:\d+:[^:\s]+$/.exec(eventId);
  return match?.[1] ?? null;
}

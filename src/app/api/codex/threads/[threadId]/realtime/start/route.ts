import {
  audit,
  badRequest,
  getAppServerGateway,
  nonEmptyString,
  ok,
  optionalString,
  readJsonRecord,
  serverError,
  unauthorized
} from "../../../../_route-helpers";
import type {
  MobileJsonValue,
  MobileRealtimeConversationArchitecture,
  MobileRealtimeConversationVersion,
  MobileRealtimeVoice
} from "../../../../../../../shared/codex";

export async function POST(
  request: Request,
  context: { params: Promise<{ threadId: string }> }
): Promise<Response> {
  const auth = unauthorized(request);
  if (auth) {
    return auth;
  }

  try {
    const { threadId } = await context.params;
    if (!threadId) {
      return badRequest("threadId 不能为空");
    }

    const body = await readJsonRecord(request);
    const outputModality = body.outputModality === "text" || body.outputModality === "audio" ? body.outputModality : null;
    if (!outputModality) {
      return badRequest("outputModality 只能是 text 或 audio");
    }

    const architecture =
      body.architecture === "realtimeapi" || body.architecture === "avas"
        ? (body.architecture as MobileRealtimeConversationArchitecture)
        : null;
    const version = body.version === "v1" || body.version === "v2" ? (body.version as MobileRealtimeConversationVersion) : null;
    const voice = optionalString(body.voice) as MobileRealtimeVoice | null;

    await audit("thread.realtime.start", {
      threadId,
      outputModality,
      architecture,
      version,
      voice
    });
    const result = await getAppServerGateway().startThreadRealtime({
      threadId,
      outputModality,
      architecture,
      codexResponsesAsItems: typeof body.codexResponsesAsItems === "boolean" ? body.codexResponsesAsItems : null,
      codexResponseItemPrefix: optionalString(body.codexResponseItemPrefix),
      model: optionalString(body.model),
      includeStartupContext: typeof body.includeStartupContext === "boolean" ? body.includeStartupContext : null,
      prompt: optionalString(body.prompt),
      realtimeSessionId: optionalString(body.realtimeSessionId),
      transport: "transport" in body ? (body.transport as MobileJsonValue) : null,
      version,
      voice
    });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法启动 realtime 会话");
  }
}

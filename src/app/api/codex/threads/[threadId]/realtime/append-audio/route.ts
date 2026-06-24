import {
  audit,
  badRequest,
  getAppServerGateway,
  isRecord,
  nonEmptyString,
  ok,
  optionalString,
  readJsonRecord,
  serverError,
  unauthorized
} from "../../../../_route-helpers";

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
    if (!isRecord(body.audio)) {
      return badRequest("audio 不能为空");
    }

    const data = nonEmptyString(body.audio.data);
    const sampleRate = typeof body.audio.sampleRate === "number" ? body.audio.sampleRate : null;
    const numChannels = typeof body.audio.numChannels === "number" ? body.audio.numChannels : null;
    if (!data) {
      return badRequest("audio.data 不能为空");
    }
    if (!sampleRate || sampleRate <= 0) {
      return badRequest("audio.sampleRate 必须是正数");
    }
    if (!numChannels || numChannels <= 0) {
      return badRequest("audio.numChannels 必须是正数");
    }

    const samplesPerChannel =
      typeof body.audio.samplesPerChannel === "number" ? body.audio.samplesPerChannel : null;

    await audit("thread.realtime.appendAudio", {
      threadId,
      sampleRate,
      numChannels,
      dataLength: data.length
    });
    const result = await getAppServerGateway().appendThreadRealtimeAudio({
      threadId,
      audio: {
        data,
        sampleRate,
        numChannels,
        samplesPerChannel,
        itemId: optionalString(body.audio.itemId)
      }
    });
    return ok({ result });
  } catch (error) {
    return serverError(error, "无法追加 realtime audio");
  }
}

import { NextResponse } from "next/server";
import { getAppServerGateway } from "../../../../../server/app-server/runtime";
import { isRequestAuthenticated } from "../../../../../server/auth";

const unavailableUsage = {
  summary: {
    lifetimeTokens: null,
    peakDailyTokens: null,
    longestRunningTurnSec: null,
    currentStreakDays: null,
    longestStreakDays: null
  },
  dailyUsageBuckets: null
};

export async function GET(request: Request): Promise<Response> {
  if (!isRequestAuthenticated(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const usage = await getAppServerGateway().getAccountTokenUsage();
    return NextResponse.json({ ok: true, result: usage, usage });
  } catch (error) {
    if (isTokenUsageUnavailableError(error)) {
      return NextResponse.json({ ok: true, result: unavailableUsage, usage: unavailableUsage });
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "无法读取账号 token 用量" },
      { status: 502 }
    );
  }
}

function isTokenUsageUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /chatgpt authentication required to read token usage/i.test(error.message);
}

export type AppServerStatusView = {
  state: "disabled" | "idle" | "starting" | "connecting" | "ready" | "error";
  message?: string;
};

export type MobileThreadSummary = {
  id: string;
  title: string;
  preview: string;
  cwd: string;
  modelProvider: string;
  status: string;
  updatedAt: number;
};

export type MobileThreadPage = {
  threads: MobileThreadSummary[];
  nextCursor: string | null;
};

export type MobileModelOption = {
  id: string;
  label: string;
  isDefault: boolean;
  supportedReasoningEfforts: string[];
  inputModalities: string[];
};

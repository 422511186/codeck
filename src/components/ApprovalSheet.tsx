import type { PendingServerRequestView } from "../server/app-server/pending-requests";

type ApprovalSheetProps = {
  request: PendingServerRequestView;
  onResolve(request: PendingServerRequestView, value: string): void;
};

export function ApprovalSheet({ request, onResolve }: ApprovalSheetProps) {
  return (
    <section className="approval-sheet" aria-label="待确认请求">
      <div>
        <p className="eyebrow">{request.kind}</p>
        <h2>{request.title}</h2>
        <p>{request.description}</p>
      </div>
      <div className="approval-actions">
        {request.options.map((option) => (
          <button type="button" key={option.value} onClick={() => onResolve(request, option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

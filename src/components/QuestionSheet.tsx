import type { PendingServerRequestView } from "../server/app-server/pending-requests";

type QuestionSheetProps = {
  request: PendingServerRequestView;
  onResolve(request: PendingServerRequestView, value: string): void;
};

export function QuestionSheet({ request, onResolve }: QuestionSheetProps) {
  return (
    <section className="approval-sheet question-sheet" aria-label="待回答问题">
      <div>
        <p className="eyebrow">{request.kind}</p>
        <h2>{request.title}</h2>
        <p>{request.description}</p>
      </div>
      <div className="approval-actions">
        {request.options.map((option) => (
          <button type="button" key={option.value} onClick={() => onResolve(request, option.value)}>
            <span>{option.label}</span>
            {option.description ? <small>{option.description}</small> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

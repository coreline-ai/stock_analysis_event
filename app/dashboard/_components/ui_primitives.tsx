"use client";

export function LoadingBlock({ label = "불러오는 중..." }: { label?: string }) {
  return (
    <div className="card loading-card" role="status" aria-live="polite" aria-label={label}>
      <span className="spinner" aria-hidden />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="card empty-card" role="status" aria-live="polite" aria-label={title}>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="card error-card" role="alert" aria-live="assertive">
      <h3>오류</h3>
      <p>{message}</p>
    </div>
  );
}

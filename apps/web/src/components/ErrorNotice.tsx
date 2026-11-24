export default function ErrorNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  if (!message) return null;
  return <div className="error-banner inline-error"><span>{message}</span><button onClick={onDismiss} aria-label="Dismiss error">×</button></div>;
}

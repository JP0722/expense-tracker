export function ErrorText({ children }) {
  return children ? (
    <div role="alert" className="error-message">
      {children}
    </div>
  ) : null;
}

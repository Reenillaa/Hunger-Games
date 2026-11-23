/** Routes uncaught errors and rejections to a single handler (shows the recovery screen). */
export function installGlobalErrorHandlers(onError: (error: unknown) => void): () => void {
  const onWindowError = (e: ErrorEvent) => onError(e.error ?? e.message);
  const onRejection = (e: PromiseRejectionEvent) => onError(e.reason);
  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onWindowError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

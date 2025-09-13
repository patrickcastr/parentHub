import { useRouteError, isRouteErrorResponse } from "react-router-dom";

export function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-2">
          Route Error: {error.status} {error.statusText}
        </h1>
        <p>{(error as any).data || "Something went wrong with routing."}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-2">Render Error</h1>
      <pre className="text-xs opacity-70">{String(error)}</pre>
    </div>
  );
}
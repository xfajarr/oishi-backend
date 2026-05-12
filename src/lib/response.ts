/**
 * Standardized API response helpers.
 * All routes should use these for consistent { code, message, data } shape.
 */

/** 200 OK — success with optional data */
export function ok<T = unknown>(data: T, message = "OK"): Response {
  return json({ code: 200, message, data });
}

/** 201 Created — resource was created */
export function created<T = unknown>(data: T, message = "Created"): Response {
  return json({ code: 201, message, data });
}

/** 400 Bad Request — invalid input */
export function badRequest(message = "Bad request", details?: unknown): Response {
  return json({ code: 400, message, data: details ?? null }, 400);
}

/** 401 Unauthorized — auth failed */
export function unauthorized(message = "Unauthorized"): Response {
  return json({ code: 401, message, data: null }, 401);
}

/** 403 Forbidden — not your resource */
export function forbidden(message = "Forbidden"): Response {
  return json({ code: 403, message, data: null }, 403);
}

/** 404 Not Found — resource missing */
export function notFound(message = "Not found"): Response {
  return json({ code: 404, message, data: null }, 404);
}

/** 409 Conflict — e.g. handle taken */
export function conflict(message = "Conflict"): Response {
  return json({ code: 409, message, data: null }, 409);
}

/** 500 Internal Server Error */
export function serverError(message = "Internal server error"): Response {
  return json({ code: 500, message, data: null }, 500);
}

/** Generic helper — pass any code */
export function res<T = unknown>(
  code: number,
  message: string,
  data: T | null = null,
): Response {
  return json({ code, message, data }, code);
}

// ── Internal ────────────────────────────────────────────────────────────
function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

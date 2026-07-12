import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Wraps a route handler with uniform error handling.
 * ApiError -> its status, ZodError -> 400 with field issues, anything else -> 500.
 */
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return json({ error: err.message }, err.status);
      }
      if (err instanceof ZodError) {
        return json(
          {
            error: "Validation failed",
            issues: err.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
          400,
        );
      }
      console.error(err);
      return json({ error: "Internal server error" }, 500);
    }
  };
}

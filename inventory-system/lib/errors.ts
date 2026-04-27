import { NextResponse } from 'next/server';

export class AppError extends Error {
  statusCode: number;
  code: string | null;
  constructor(message: string, statusCode = 500, code: string | null = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

interface PostgresError extends Error {
  code?: string;
  detail?: string;
}

/** Map any thrown error to a NextResponse. Mirrors Express errorHandler. */
export function errorResponse(err: unknown): NextResponse {
  const isDev = process.env.NODE_ENV !== 'production';

  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.message, code: err.code ?? undefined },
      { status: err.statusCode },
    );
  }

  // JWT errors
  if (err instanceof Error) {
    if (err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    if (err.name === 'TokenExpiredError') {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }
    if (err.name === 'ZodError') {
      // ZodError shape — duck-type
      const zErr = err as Error & { errors?: Array<{ path: (string | number)[]; message: string }> };
      return NextResponse.json(
        {
          error: 'Validation Error',
          details: zErr.errors?.map((e) => ({ path: e.path.join('.'), message: e.message })) ?? [],
        },
        { status: 400 },
      );
    }
  }

  // Postgres unique violation
  const pgErr = err as PostgresError;
  if (pgErr?.code === '23505') {
    return NextResponse.json(
      {
        error: 'Conflict',
        message: 'A record with that value already exists',
        detail: isDev ? pgErr.detail : undefined,
      },
      { status: 409 },
    );
  }

  console.error('[errorResponse] Unhandled:', err);
  return NextResponse.json(
    {
      error: 'Internal Server Error',
      message: isDev && err instanceof Error ? err.message : undefined,
    },
    { status: 500 },
  );
}

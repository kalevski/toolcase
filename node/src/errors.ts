import { HTTP } from '@toolcase/base'

const { Status } = HTTP

const HTTP_LOCKED = 423

export class LibError extends Error {

	constructor(message: string) {
		super(message)
		this.name = new.target.name
	}
}

export class RepositoryError extends LibError {}

export class NotFoundError extends RepositoryError {

	readonly resource: string
	readonly identifier: unknown

	constructor(resource: string, identifier: unknown) {
		super(`${resource} not found: ${String(identifier)}`)
		this.resource = resource
		this.identifier = identifier
	}
}

export class ConflictError extends RepositoryError {

	readonly resource: string

	constructor(resource: string, message?: string) {
		super(message ?? `${resource} already exists`)
		this.resource = resource
	}
}

export class OptimisticLockError extends RepositoryError {

	readonly resource: string
	readonly expectedVersion: number
	readonly actualVersion: number | null

	constructor(resource: string, expectedVersion: number, actualVersion: number | null) {
		super(`${resource} version mismatch: expected ${expectedVersion}, got ${actualVersion ?? 'none'}`)
		this.resource = resource
		this.expectedVersion = expectedVersion
		this.actualVersion = actualVersion
	}
}

export class KVServiceError extends LibError {}

export class LockNotAcquiredError extends KVServiceError {

	readonly key: string

	constructor(key: string) {
		super(`Lock not acquired: ${key}`)
		this.key = key
	}
}

export class RateLimitedError extends KVServiceError {

	readonly key: string
	readonly resetInSeconds: number

	constructor(key: string, resetInSeconds: number) {
		super(`Rate limit exceeded for ${key}, retry in ${resetInSeconds}s`)
		this.key = key
		this.resetInSeconds = resetInSeconds
	}
}

export class EndpointError extends LibError {

	readonly statusCode: number
	readonly code: string

	constructor(statusCode: number, code: string, message: string) {
		super(message)
		this.statusCode = statusCode
		this.code = code
	}
}

export class ValidationError extends EndpointError {

	readonly details?: unknown

	constructor(message: string, details?: unknown) {
		super(Status.BAD_REQUEST, 'VALIDATION_ERROR', message)
		this.details = details
	}
}

export class OAuth2Error extends EndpointError {

	constructor(statusCode: number, code: string, message: string) {
		super(statusCode, code, message)
	}
}

export class OAuth2CallbackError extends OAuth2Error {

	readonly upstreamError: string
	readonly upstreamDescription?: string

	constructor(upstreamError: string, description?: string) {
		super(Status.BAD_REQUEST, 'OAUTH2_CALLBACK_ERROR', `${upstreamError}${description ? `: ${description}` : ''}`)
		this.upstreamError = upstreamError
		this.upstreamDescription = description
	}
}

export class OAuth2TokenError extends OAuth2Error {

	readonly upstreamStatus: number
	readonly upstreamBody?: unknown

	constructor(upstreamStatus: number, message: string, upstreamBody?: unknown) {
		super(Status.BAD_GATEWAY, 'OAUTH2_TOKEN_ERROR', message)
		this.upstreamStatus = upstreamStatus
		this.upstreamBody = upstreamBody
	}
}

export class OAuth2ProtocolError extends OAuth2Error {

	constructor(reason: string) {
		super(Status.BAD_REQUEST, 'OAUTH2_PROTOCOL_ERROR', reason)
	}
}

export class OIDCVerificationError extends OAuth2Error {

	constructor(reason: string) {
		super(Status.UNAUTHORIZED, 'OIDC_VERIFICATION_FAILED', reason)
	}
}

export class TokenIntrospectionError extends OAuth2Error {

	constructor(reason: string) {
		super(Status.UNAUTHORIZED, 'TOKEN_INTROSPECTION_FAILED', reason)
	}
}

export class ImageProcessorError extends LibError {

	readonly reason: string
	readonly path: string | null

	constructor(reason: string, message?: string, path?: string) {
		super(message ?? `image processing failed: ${reason}`)
		this.reason = reason
		this.path = path ?? null
	}
}

export class AtlasBuildError extends LibError {

	readonly stage: 'decode' | 'pack' | 'compose' | 'write'
	readonly path: string | null

	constructor(stage: 'decode' | 'pack' | 'compose' | 'write', message?: string, path?: string) {
		super(message ?? `atlas build failed at stage: ${stage}`)
		this.stage = stage
		this.path = path ?? null
	}
}

export function isLibError(error: unknown): error is LibError {
	return error instanceof LibError
}

export interface ErrorMeta {
	code: string | null
	status: number
}

/**
 * Resolves an error into HTTP-shaped metadata. Returns `null` for errors that
 * the library doesn't know how to surface (callers map those to 500 + opaque).
 */
export function errorMeta(error: unknown): ErrorMeta | null {
	if (error instanceof EndpointError) {
		return { code: error.code, status: error.statusCode }
	}
	if (error instanceof NotFoundError) {
		return { code: 'NOT_FOUND', status: Status.NOT_FOUND }
	}
	if (error instanceof ConflictError) {
		return { code: 'CONFLICT', status: Status.CONFLICT }
	}
	if (error instanceof OptimisticLockError) {
		return { code: 'VERSION_MISMATCH', status: Status.CONFLICT }
	}
	if (error instanceof RateLimitedError) {
		return { code: 'RATE_LIMITED', status: Status.TOO_MANY_REQUESTS }
	}
	if (error instanceof LockNotAcquiredError) {
		return { code: 'LOCKED', status: HTTP_LOCKED }
	}
	if (error instanceof ImageProcessorError) {
		return { code: null, status: Status.UNPROCESSABLE_ENTITY }
	}
	if (error instanceof AtlasBuildError) {
		return { code: null, status: Status.INTERNAL_SERVER_ERROR }
	}
	return null
}

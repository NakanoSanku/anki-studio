export type SyncRequestErrorCode =
  | "invalid_remote_deck_payload"
  | "invalid_remote_deck_revision"
  | "invalid_remote_deck_content"
  | "missing_remote_deck_content"
  | "invalid_request"
  | "invalid_expected_revision"
  | "invalid_deck_content"
  | "missing_deck_content"
  | "invalid_remote_index"
  | "invalid_remote_index_entry"
  | "invalid_remote_index_revision"

export class SyncRequestError extends Error {
  readonly status: number

  constructor(
    readonly code: SyncRequestErrorCode,
    message: string,
    status = 400
  ) {
    super(message)
    this.name = "SyncRequestError"
    this.status = status
  }
}

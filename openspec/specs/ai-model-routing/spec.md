# ai-model-routing Specification

## Purpose

Routes every AI request to an available model within free-tier limits, rotates between models and providers, and accounts for token usage and estimated cost.

## Requirements

### Requirement: Capability-based model pools
AI requests SHALL be routed by capability: text generation, video understanding, and embeddings. Each pool SHALL contain only models that support that capability, ordered by preference, with limits (RPM, TPM, RPD) taken from `doc/google-limits.md`.

#### Scenario: Video request
- **WHEN** a transcription request with a YouTube video is routed
- **THEN** only models from the video-capable pool are considered

### Requirement: Rotation within limits
The router SHALL pick the first model in the pool whose minute and day counters allow the request, and SHALL move to the next model when a limit is reached or the provider responds with a rate-limit or overload error.

#### Scenario: Daily limit reached
- **WHEN** the preferred text model has used all of its requests per day
- **THEN** the request is sent to the next text model in the pool

#### Scenario: Provider returns 429
- **WHEN** a model responds with HTTP 429 or 503
- **THEN** the model is cooled down and the request is retried on the next model

### Requirement: Persistent usage counters
Usage counters SHALL survive process restarts and SHALL reset per minute and per day according to the provider's quota window.

#### Scenario: Restart mid-day
- **WHEN** the worker restarts after using 300 requests of a 500 RPD model today
- **THEN** the router still counts those 300 requests toward today's limit

### Requirement: Optional OpenAI fallback
When `OPENAI_API_KEY` is configured, OpenAI models SHALL be used as the last-resort fallback for text and embedding requests. When it is not configured, the system SHALL work with Google AI only.

#### Scenario: No OpenAI key
- **WHEN** all Google text models are exhausted and no OpenAI key exists
- **THEN** the request fails with a "quota exhausted" error that the pipeline records, and the run continues

### Requirement: Usage logging
Every AI call SHALL be logged with provider, model, purpose, input and output tokens, latency, status and estimated paid-equivalent cost.

#### Scenario: Logged call
- **WHEN** a summary is generated
- **THEN** a usage record with its token counts and model appears in Monitoring

### Requirement: API key confidentiality
API keys SHALL be read from `.env` (`GOOGLE-AI-KEY`, optional `OPENAI_API_KEY`) on the server only and SHALL never appear in URLs, logs, node inputs/outputs, or responses sent to the browser.

#### Scenario: Inspecting node input
- **WHEN** a user opens the Input or Logs tab of a node that called an AI model
- **THEN** the shown request contains no API key

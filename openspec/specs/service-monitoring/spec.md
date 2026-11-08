# service-monitoring Specification

## Purpose

Lets operators watch the service in real time: worker and run state, processing throughput, AI usage against limits, and estimated token spend.

## Requirements

### Requirement: Realtime status stream
The server SHALL push service status to the browser continuously (worker heartbeat, active run, current step, progress, node statuses, recent events) with updates at least every 2 seconds while a page is open.

#### Scenario: Worker goes offline
- **WHEN** the worker process stops sending heartbeats for more than 30 seconds
- **THEN** the status dot turns red and the UI shows the worker as offline

### Requirement: Monitoring dashboard
The Monitoring tab SHALL show worker status and heartbeat, active run progress, next scheduled run, processed counts (today, total, per run), run success/failure history, and recent errors.

#### Scenario: Failed run visible
- **WHEN** a run failed
- **THEN** it appears in run history with status failed and its error message

### Requirement: AI usage and spend
The Monitoring tab SHALL show AI requests and tokens per model for today and over time, usage versus each model's RPM/RPD limits, and estimated paid-equivalent cost labelled as an estimate.

#### Scenario: Model near daily limit
- **WHEN** a model has used 90% of its requests per day
- **THEN** its usage bar is highlighted as near the limit

### Requirement: Run Now from monitoring
The Monitoring tab and the top bar SHALL offer Run Now, following the single-active-run rule.

#### Scenario: Run Now from monitoring
- **WHEN** the user presses Run Now on the Monitoring tab while idle
- **THEN** a manual run starts and appears as active within a few seconds

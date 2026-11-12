# game-ingestion Specification

## Purpose

Collects newly released games from Metacritic on a schedule or on demand and keeps the local game library up to date.

## Requirements

### Requirement: Hourly scheduled run
The worker SHALL start a collection run once per hour by default. The interval SHALL be configurable through the pipeline rules.

#### Scenario: Scheduled run starts
- **WHEN** the configured interval has elapsed since the previous run started and no run is active
- **THEN** a new run with trigger `schedule` is started

### Requirement: Manual run trigger
The system SHALL expose a manual trigger that starts a run immediately unless a run is already active.

#### Scenario: Manual trigger while idle
- **WHEN** a user presses "Run Now" and no run is active
- **THEN** a new run with trigger `manual` starts within a few seconds

#### Scenario: Manual trigger while a run is active
- **WHEN** a user presses "Run Now" while a run is active
- **THEN** no second run starts and the user is told a run is already in progress

### Requirement: Single active run
At most one run SHALL be active at a time. Runs left in `running` state by a crashed worker SHALL be marked `failed` when the worker starts.

#### Scenario: Stale run recovery
- **WHEN** the worker starts and finds a run in `running` state
- **THEN** that run is marked `failed` with a note that the worker restarted

### Requirement: Per-run game quota
Each run SHALL process up to 20 games (configurable) that were not already processed on the current day.

#### Scenario: Quota respected
- **WHEN** a run completes successfully and enough candidates exist
- **THEN** exactly the configured number of distinct games were processed in that run

### Requirement: Daily selection order
On each new day (in the configured timezone) selection SHALL restart: first the 20 entries of the Metacritic "New Releases" block, then successive pages of "See All" sorted by newest, continuing from the last page used that day.

#### Scenario: First run of the day
- **WHEN** the first run of a day starts
- **THEN** candidates are taken from New Releases before any See All page

#### Scenario: Later run on the same day
- **WHEN** a later run starts on the same day
- **THEN** candidates are taken from the See All pages, skipping games already processed today, advancing to the next page until the quota is filled

#### Scenario: Day rollover
- **WHEN** the date changes in the configured timezone
- **THEN** the processed-today set and page cursor are reset and selection starts again from New Releases

### Requirement: Collected game fields
For each processed game the system SHALL store: title, cover image, all platforms with per-platform Metascore and Userscore (when available), developer(s), genres, release date, description, a video link (when available), and the Metacritic URL.

#### Scenario: Multi-platform game
- **WHEN** a game is released on PS5, PC and Xbox Series X
- **THEN** the stored game lists all three platforms, each with its own Metascore and Userscore or an explicit "no score yet"

### Requirement: Upsert on re-visit
A game already in the library SHALL be updated rather than duplicated; scores, review summaries and insights MAY change on re-visit.

#### Scenario: Re-processing an existing game
- **WHEN** a game whose Metacritic slug already exists is processed again
- **THEN** the existing record is updated, its `updated` timestamp changes, and the library count is unchanged

### Requirement: Polite source access
Requests to Metacritic SHALL be sequential with a delay between calls, and a failure for one game SHALL NOT abort the whole run.

#### Scenario: One game fails
- **WHEN** fetching details for one candidate returns an error
- **THEN** the error is recorded for that game and the run continues with the next candidate

### Requirement: Run reporting
Every run SHALL record trigger, start/end time, status, games added, games updated, errors, and a timeline of step events.

#### Scenario: Completed run summary
- **WHEN** a run finishes
- **THEN** its record shows status `success` or `failed`, duration, and added/updated counts

### Requirement: Russian content
AI-generated content (review summaries, let's-play verdicts, market insights, custom fields) SHALL be produced in Russian by the default prompts. Each game description SHALL be translated into Russian once and stored next to the original; the original stays for sync and similarity, and a changed original SHALL be translated again. A failed translation SHALL NOT fail the game: the card shows the original.

#### Scenario: New game
- **WHEN** a run adds a game with an English description
- **THEN** the game gets a Russian description and the original is kept unchanged

#### Scenario: Stored English defaults
- **WHEN** the service starts with pipeline rules that still hold the old English default texts
- **THEN** those rules switch to the Russian defaults, and rules the user edited stay as they are

# Spec Delta

## Purpose

Gives game designers and targeting specialists actionable market insight computed from the collected library, styled after `doc/analytics-ref.png`.

## ADDED Requirements

### Requirement: Data-backed metrics only
All analytics values SHALL be computed from the local library and run data; when there is not enough data a section SHALL show an empty state rather than invented numbers.

#### Scenario: Empty library
- **WHEN** the library has no games
- **THEN** every analytics section shows an empty state

### Requirement: Headline KPIs
The Analytics tab SHALL show total games tracked, average Metascore, average Userscore and the trending genre, each with change versus the previous period of equal length.

#### Scenario: KPI change
- **WHEN** the selected period is 30 days
- **THEN** each KPI shows its value and the delta versus the previous 30 days

### Requirement: Genre and trend breakdowns
The Analytics tab SHALL show genre share, genre share over time, supply versus demand per month (games released vs. player interest measured by user review volume), under-served opportunities (genres with high interest per game and low supply), and popular genre/platform combinations.

#### Scenario: Under-served opportunity
- **WHEN** a genre has few games but high average user review volume
- **THEN** it appears in the high-interest / low-supply area of the opportunities chart

### Requirement: Period and platform filters
Analytics SHALL be filterable by period (7, 30, 90 days, 1 year, all) and platform.

#### Scenario: Platform filter
- **WHEN** the user selects "PC"
- **THEN** all analytics sections are recomputed for PC games only

### Requirement: Key insights
The system SHALL generate short AI key insights from the aggregated metrics after runs, and SHALL show the latest stored insights with their generation time.

#### Scenario: Insights refresh
- **WHEN** a run completes
- **THEN** key insights are regenerated from updated aggregates, at most once per run

### Requirement: Top games and market activity
The Analytics tab SHALL list top games by player interest and a live feed of recent library changes (game added / updated).

#### Scenario: New game added
- **WHEN** the worker adds a game
- **THEN** a "New game added" entry appears in Market Activity without reload

### Requirement: Report export
"Export Report" SHALL download the current analytics data for the selected filters as a file.

#### Scenario: Export
- **WHEN** the user clicks Export Report
- **THEN** a JSON or CSV file with the displayed metrics is downloaded

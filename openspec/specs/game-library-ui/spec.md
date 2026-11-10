# game-library-ui Specification

## Purpose

Lets users browse, filter, search and inspect the collected games in the Games tab, styled after `doc/games-ref.png`.

## Requirements

### Requirement: Application shell
The web UI SHALL use a dark shell with a left sidebar (logo, tabs Games, Workers, Analytics, Monitoring), a top bar with search, filters, a "Run Now" button and a live status dot, matching the reference images' visual language.

#### Scenario: Navigate tabs
- **WHEN** the user clicks a sidebar tab
- **THEN** the corresponding page opens and the tab is highlighted as active

### Requirement: Game list
The Games tab SHALL list loaded games with cover, title, platform badges, Metascore badge and the release date (or the time since last update when sorted by it), plus the total game count. "Show all" SHALL open a library dialog with search, platform filter, sort and paged results; picking a game there opens its card and closes the dialog.

#### Scenario: Library with games
- **WHEN** the library has 60 games
- **THEN** the list shows the first 10 with the total "60 games", and "Show all 60 games" opens the library dialog

#### Scenario: Close the library dialog
- **WHEN** the user presses Esc or clicks outside the dialog
- **THEN** the dialog closes and the page keeps its filters

### Requirement: Platform filter
The user SHALL be able to filter the list by platform; options SHALL come from platforms present in the library.

#### Scenario: Filter by PS5
- **WHEN** the user selects "PlayStation 5"
- **THEN** only games available on PlayStation 5 are listed

### Requirement: Title search
The user SHALL be able to search games by title (case-insensitive substring).

#### Scenario: Search
- **WHEN** the user types "elden"
- **THEN** only games whose title contains "elden" are listed

### Requirement: Rating sort
The user SHALL be able to sort by Metascore, Userscore, newest release and recently updated; games without a score SHALL sort last. Newest release SHALL be the default, with same-day releases ordered by when they were first collected and undated games last.

#### Scenario: Default order
- **WHEN** the user opens the Games tab without choosing a sort
- **THEN** the most recently released games are listed first

#### Scenario: Sort by Metascore
- **WHEN** the user selects "Sort by: Metascore"
- **THEN** games are ordered by highest Metascore first and unscored games appear at the end

### Requirement: Game card
Selecting a game SHALL show its card: hero image, title, platform badges, Metascore and Userscore (with per-platform values), developer, genres, release date, description, trailer/video link, critic and player likes/dislikes, let's-play insight, and similar games.

#### Scenario: Open card
- **WHEN** the user clicks a game in the list
- **THEN** its card is displayed and the URL identifies the selected game so it can be shared

#### Scenario: Missing data
- **WHEN** a game has no reviews or no let's-play insight yet
- **THEN** the card shows an explicit empty state for that section instead of placeholder content

### Requirement: Service monitor strip
The Games tab SHALL show a live Service Monitor strip with current run progress, next scheduled run, total processed games, last update, worker counts by status, and a Run Now button.

#### Scenario: Live progress
- **WHEN** a run is processing game 12 of 20
- **THEN** the strip shows 60% progress and the current step without a page reload

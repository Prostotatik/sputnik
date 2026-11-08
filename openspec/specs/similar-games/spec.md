# similar-games Specification

## Purpose

Recommends, for every game, other games from the local library that are most alike so users can navigate between related titles.

## Requirements

### Requirement: Similar games from the library
For each game the system SHALL provide up to 8 similar games selected only from games already in the library, ranked by similarity of description, genres, developer and platforms.

#### Scenario: Library has related games
- **WHEN** the library contains other action RPGs similar to a given action RPG
- **THEN** they appear in that game's Similar Games list, most similar first, and the game itself is excluded

### Requirement: Similarity stays current
Similar-game lists SHALL be recomputed after games are added or updated, without extra paid API calls for existing games.

#### Scenario: New game becomes a neighbour
- **WHEN** a new game similar to an existing one is ingested
- **THEN** after the run the existing game's Similar Games list can include the new game

### Requirement: Fallback without embeddings
When semantic vectors are unavailable for a game, similarity SHALL fall back to shared genres, developer and platforms.

#### Scenario: Embedding quota exhausted
- **WHEN** no embedding could be computed for a game
- **THEN** the game still receives a similar-games list based on metadata overlap

### Requirement: Navigable similar games
Clicking a similar game's name or cover SHALL open that game's card.

#### Scenario: Navigate to similar game
- **WHEN** the user clicks a similar game in a game card
- **THEN** the card of the clicked game is displayed

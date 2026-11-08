# Spec Delta

## Purpose

Turns Metacritic critic and user reviews into short, separate summaries of what reviewers like and dislike about each game.

## ADDED Requirements

### Requirement: Separate critic and user summaries
For each game with reviews, the system SHALL produce two independent summaries: one from critic reviews and one from user reviews. Each summary SHALL contain a list of likes and a list of dislikes (short phrases) and a one-paragraph verdict.

#### Scenario: Game with both review types
- **WHEN** a game has critic and user reviews
- **THEN** the game card shows "What Critics Like/Dislike" and "What Players Like/Dislike" from separate summaries

### Requirement: Balanced review sample
The summary input SHALL include both positive and negative reviews when they exist, not only the highest rated.

#### Scenario: Mixed reviews
- **WHEN** a game has both high- and low-scored user reviews
- **THEN** the review sample sent for summarization contains reviews from both ends

### Requirement: Skip when no reviews
When a game has no reviews of a type, the system SHALL NOT call an AI model for that type and SHALL mark the summary as unavailable.

#### Scenario: Unreviewed game
- **WHEN** a newly released game has zero critic reviews
- **THEN** no AI call is made for the critic summary and the UI shows that critic reviews are not available yet

### Requirement: Refresh on re-visit
Summaries SHALL be regenerated when a game is processed again and its review count has changed since the last summary.

#### Scenario: New reviews since last visit
- **WHEN** a game is re-processed and its user review count increased
- **THEN** the user summary is regenerated and its timestamp updated

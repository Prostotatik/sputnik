# Spec Delta

## Purpose

Captures what a popular let's-player says about each game by transcribing their narration and condensing it into a conclusion linked to the video.

## ADDED Requirements

### Requirement: Most popular commentated let's-play
The system SHALL search YouTube for let's-plays of the game and choose the most viewed candidate that has blogger commentary, excluding videos marked as "no commentary" and videos too short to be a let's-play.

#### Scenario: Candidate filtering
- **WHEN** search results include "Full Game – No Commentary" with the most views and a commentated let's-play with fewer views
- **THEN** the commentated let's-play is chosen

### Requirement: Narration transcription and conclusion
The system SHALL transcribe the blogger's narration from a bounded segment of the chosen video and produce a short conclusion about the game. The transcript excerpt, conclusion, video title, channel, view count and link SHALL be stored with the game.

#### Scenario: Successful insight
- **WHEN** a commentated let's-play is found and transcription succeeds
- **THEN** the game card shows the conclusion with a "Watch full video" link to that video

#### Scenario: Empty narration fallback
- **WHEN** the transcript of the chosen video is empty
- **THEN** the next candidate is tried, up to a configured number of attempts

### Requirement: Daily video budget
The total transcribed video duration per day SHALL stay within a configured budget; when it is exhausted, let's-play processing SHALL be skipped and retried on a later run.

#### Scenario: Budget exhausted
- **WHEN** the daily video budget is used up
- **THEN** remaining games are processed without a new let's-play insight and the skip is logged

### Requirement: Skip low-signal games
Let's-play processing SHALL be skipped for games with no critic and no user reviews (configurable).

#### Scenario: Unreviewed indie title
- **WHEN** a game has no reviews of any kind
- **THEN** no YouTube search or transcription is performed for it

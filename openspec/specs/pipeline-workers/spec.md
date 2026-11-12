# pipeline-workers Specification

## Purpose

Shows the collection pipeline as an interactive graph of prompt and tool nodes, lets users edit the rules that drive the worker, and displays live and historical execution, styled after `doc/workers-ref.png`.

## Requirements

### Requirement: Default pipeline rules
The system SHALL ship a default pipeline matching doc/TZ.md: Metacritic sync → fetch new games → parse game data, analyze reviews (critic and user summaries), find similar games, YouTube analysis (find let's-play, transcribe and analyze), and generate insights.

#### Scenario: Fresh install
- **WHEN** the service starts with an empty database
- **THEN** the Workers tab shows the default pipeline with default prompts and parameters

### Requirement: Rules drive the worker
Node settings SHALL be read by the worker at the start of every run: enabled flag, prompt text, model pool preference and node parameters (e.g. games per run, schedule interval, timezone, clip length, daily video budget).

#### Scenario: Edited prompt takes effect
- **WHEN** a user edits the critic summary prompt and saves it
- **THEN** the next run uses the edited prompt

#### Scenario: Disabled node
- **WHEN** a user disables the YouTube analysis node
- **THEN** the next run performs no YouTube searches or transcriptions

### Requirement: Validated rule edits
Saving node settings SHALL validate parameters (types and ranges) and SHALL reject invalid values with a visible error.

#### Scenario: Invalid parameter
- **WHEN** a user sets games per run to 0
- **THEN** the save is rejected and the previous value remains

### Requirement: Reset to defaults
The user SHALL be able to reset a node or the whole pipeline to the default rules.

#### Scenario: Reset pipeline
- **WHEN** the user confirms "Reset to defaults"
- **THEN** all nodes return to default prompts and parameters and custom nodes are removed

### Requirement: Custom prompt nodes
The user SHALL be able to add a custom prompt node with a name, an output field key and a prompt over the game data; the worker SHALL run it for each processed game and store the result as an extra field shown on the game card. Adding a rule SHALL happen in a dialog that offers example rules, clickable placeholders, a "only games with reviews" option, a model choice and a one-off test on a library game that does not store the answer. The node SHALL be drawn after the let's-play verdict, where it runs.

#### Scenario: Test before saving
- **WHEN** the user writes a prompt and presses Test with a game selected
- **THEN** the model's answer for that game is shown and nothing is saved

#### Scenario: Add custom field
- **WHEN** the user adds a custom node "Monetization" with a prompt and runs the pipeline
- **THEN** processed games get a "Monetization" field visible in their card

### Requirement: Live node status
Each node SHALL display live status (idle, queued, running, success, failed), elapsed time and progress during a run, without page reload.

#### Scenario: Node running
- **WHEN** the worker is summarizing reviews
- **THEN** the «Сводка критиков» node shows «Работает» with an increasing timer

### Requirement: Node details
Selecting a node SHALL show its details with tabs Overview (status, duration, start time, agent type, description, current rules), Rules (an editor with a help line for every parameter and a model picker), Input, Output and Logs from its latest execution. An "Edit rules" button SHALL open the Rules tab directly.

#### Scenario: Inspect node output
- **WHEN** the user selects the «Отбор новых игр» node and opens «Выход»
- **THEN** the list of games selected in the latest run is shown

### Requirement: Run history
The Workers tab SHALL show recent run events and run summaries, and offer Live and History views with selectable past runs.

#### Scenario: View past run
- **WHEN** the user switches to History and selects a past run
- **THEN** the graph shows node statuses from that run

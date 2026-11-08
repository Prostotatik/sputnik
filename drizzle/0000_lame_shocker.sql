CREATE TABLE `ai_calls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`capability` text NOT NULL,
	`purpose` text NOT NULL,
	`run_id` integer,
	`game_id` integer,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`cost_usd` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_calls_ts_idx` ON `ai_calls` (`ts`);--> statement-breakpoint
CREATE TABLE `ai_model_state` (
	`model` text PRIMARY KEY NOT NULL,
	`minute_bucket` text DEFAULT '' NOT NULL,
	`minute_requests` integer DEFAULT 0 NOT NULL,
	`minute_tokens` integer DEFAULT 0 NOT NULL,
	`day_bucket` text DEFAULT '' NOT NULL,
	`day_requests` integer DEFAULT 0 NOT NULL,
	`day_tokens` integer DEFAULT 0 NOT NULL,
	`cooldown_until` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `analytics_insights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer NOT NULL,
	`run_id` integer,
	`insights` text NOT NULL,
	`model` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_state` (
	`day` text PRIMARY KEY NOT NULL,
	`phase` text NOT NULL,
	`page` integer DEFAULT 1 NOT NULL,
	`processed` text DEFAULT '[]' NOT NULL,
	`video_seconds` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_custom_fields` (
	`game_id` integer NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`game_id`, `key`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game_embeddings` (
	`game_id` integer PRIMARY KEY NOT NULL,
	`model` text NOT NULL,
	`vector` blob NOT NULL,
	`source_hash` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game_insights` (
	`game_id` integer PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`video_url` text NOT NULL,
	`video_title` text NOT NULL,
	`channel` text,
	`views` integer,
	`duration_sec` integer,
	`thumbnail_url` text,
	`transcript` text NOT NULL,
	`conclusion` text NOT NULL,
	`highlights` text DEFAULT '[]' NOT NULL,
	`model` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game_platforms` (
	`game_id` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`metascore` integer,
	`critic_review_count` integer DEFAULT 0 NOT NULL,
	`userscore` real,
	`user_review_count` integer DEFAULT 0 NOT NULL,
	`release_date` text,
	PRIMARY KEY(`game_id`, `slug`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `platform_slug_idx` ON `game_platforms` (`slug`);--> statement-breakpoint
CREATE TABLE `game_similar` (
	`game_id` integer NOT NULL,
	`similar_id` integer NOT NULL,
	`score` real NOT NULL,
	`rank` integer NOT NULL,
	PRIMARY KEY(`game_id`, `similar_id`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`similar_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game_summaries` (
	`game_id` integer NOT NULL,
	`kind` text NOT NULL,
	`likes` text NOT NULL,
	`dislikes` text NOT NULL,
	`verdict` text NOT NULL,
	`review_count` integer NOT NULL,
	`model` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`game_id`, `kind`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`release_date` text,
	`cover_url` text,
	`card_image_url` text,
	`hero_url` text,
	`developer` text,
	`publisher` text,
	`genres` text DEFAULT '[]' NOT NULL,
	`metascore` integer,
	`userscore` real,
	`critic_review_count` integer DEFAULT 0 NOT NULL,
	`user_review_count` integer DEFAULT 0 NOT NULL,
	`video_url` text,
	`video_title` text,
	`metacritic_url` text NOT NULL,
	`must_play` integer DEFAULT false NOT NULL,
	`source` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_slug_unique` ON `games` (`slug`);--> statement-breakpoint
CREATE INDEX `games_title_idx` ON `games` (`title`);--> statement-breakpoint
CREATE INDEX `games_updated_idx` ON `games` (`updated_at`);--> statement-breakpoint
CREATE TABLE `library_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`kind` text NOT NULL,
	`game_id` integer NOT NULL,
	`title` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `library_events_ts_idx` ON `library_events` (`ts`);--> statement-breakpoint
CREATE TABLE `pipeline_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`prompt` text,
	`params` text DEFAULT '{}' NOT NULL,
	`parent_id` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `run_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer,
	`ts` integer NOT NULL,
	`level` text NOT NULL,
	`node_id` text,
	`message` text NOT NULL,
	`detail` text,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `run_events_run_idx` ON `run_events` (`run_id`);--> statement-breakpoint
CREATE TABLE `run_nodes` (
	`run_id` integer NOT NULL,
	`node_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`done` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`input` text,
	`output` text,
	`logs` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`run_id`, `node_id`),
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `run_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`requested_at` integer NOT NULL,
	`status` text NOT NULL,
	`run_id` integer
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`day` text NOT NULL,
	`phase` text,
	`total` integer DEFAULT 0 NOT NULL,
	`processed` integer DEFAULT 0 NOT NULL,
	`added` integer DEFAULT 0 NOT NULL,
	`updated` integer DEFAULT 0 NOT NULL,
	`errors` integer DEFAULT 0 NOT NULL,
	`current_step` text,
	`current_game` text,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `worker_heartbeat` (
	`id` integer PRIMARY KEY NOT NULL,
	`pid` integer NOT NULL,
	`started_at` integer NOT NULL,
	`beat_at` integer NOT NULL,
	`state` text NOT NULL,
	`next_run_at` integer
);

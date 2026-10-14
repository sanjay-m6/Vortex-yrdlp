use std::collections::HashSet;

use crate::batch::parser::parse_batch_text;
use crate::batch::validator::normalize_batch_url;
use crate::database::{fetch_all_downloads, DbState};
use crate::models::{BatchEntryStatus, BatchValidatedEntry, BatchValidationResult, DownloadState};

pub fn validate_and_deduplicate_batch(text: &str, db: Option<&DbState>) -> BatchValidationResult {
    let parsed_lines = parse_batch_text(text);
    let mut entries = Vec::new();
    let mut seen_batch_urls = HashSet::new();

    // Query existing downloads from database to check against persistent records
    let existing_downloads = if let Some(database) = db {
        if let Ok(conn) = database.conn.lock() {
            fetch_all_downloads(&conn).unwrap_or_default()
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    let mut valid_count = 0;
    let mut duplicate_count = 0;
    let mut already_queued_count = 0;
    let mut already_completed_count = 0;
    let mut invalid_count = 0;

    for (line_num, raw_line) in parsed_lines {
        match normalize_batch_url(&raw_line) {
            Ok(normalized) => {
                if seen_batch_urls.contains(&normalized) {
                    duplicate_count += 1;
                    entries.push(BatchValidatedEntry {
                        original_line: line_num,
                        raw_input: raw_line,
                        normalized_url: Some(normalized),
                        status: BatchEntryStatus::DuplicateWithinBatch,
                        reason: Some("Duplicate URL within this import".to_string()),
                        title_hint: None,
                    });
                } else {
                    seen_batch_urls.insert(normalized.clone());

                    // Check if already in persistent SQLite database
                    let db_match = existing_downloads
                        .iter()
                        .find(|d| d.request.webpage_url == normalized);

                    if let Some(existing) = db_match {
                        if existing.status == DownloadState::Completed {
                            already_completed_count += 1;
                            entries.push(BatchValidatedEntry {
                                original_line: line_num,
                                raw_input: raw_line,
                                normalized_url: Some(normalized),
                                status: BatchEntryStatus::AlreadyCompleted,
                                reason: Some("Already downloaded in history".to_string()),
                                title_hint: existing.request.title.clone(),
                            });
                        } else if existing.status.is_active()
                            || existing.status == DownloadState::Queued
                        {
                            already_queued_count += 1;
                            entries.push(BatchValidatedEntry {
                                original_line: line_num,
                                raw_input: raw_line,
                                normalized_url: Some(normalized),
                                status: BatchEntryStatus::AlreadyQueued,
                                reason: Some(format!("Already in queue ({:?})", existing.status)),
                                title_hint: existing.request.title.clone(),
                            });
                        } else {
                            // Previously failed/cancelled - allow re-importing as valid
                            valid_count += 1;
                            entries.push(BatchValidatedEntry {
                                original_line: line_num,
                                raw_input: raw_line,
                                normalized_url: Some(normalized),
                                status: BatchEntryStatus::Valid,
                                reason: None,
                                title_hint: existing.request.title.clone(),
                            });
                        }
                    } else {
                        valid_count += 1;
                        entries.push(BatchValidatedEntry {
                            original_line: line_num,
                            raw_input: raw_line,
                            normalized_url: Some(normalized),
                            status: BatchEntryStatus::Valid,
                            reason: None,
                            title_hint: None,
                        });
                    }
                }
            }
            Err(err_msg) => {
                invalid_count += 1;
                entries.push(BatchValidatedEntry {
                    original_line: line_num,
                    raw_input: raw_line,
                    normalized_url: None,
                    status: BatchEntryStatus::InvalidUrl,
                    reason: Some(err_msg),
                    title_hint: None,
                });
            }
        }
    }

    let total_count = entries.len();

    BatchValidationResult {
        entries,
        total_count,
        valid_count,
        duplicate_count,
        already_queued_count,
        already_completed_count,
        invalid_count,
    }
}

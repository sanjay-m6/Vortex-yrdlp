use chrono::Utc;
use rusqlite::{params, Connection, Result};

use crate::models::{
    FileAvailability, MediaLibraryFilter, MediaLibraryItem, MediaLibraryResponse,
    MediaLibrarySummary,
};

/// Initializes Phase 8 schema additions and migrations idempotently.
pub fn init_library_schema(conn: &Connection) -> Result<()> {
    let needed_columns = [
        ("settings_snapshot", "TEXT"),
        ("uploader", "TEXT"),
        ("duration", "REAL"),
        ("file_extension", "TEXT"),
        ("format_label", "TEXT"),
        ("file_size_bytes", "INTEGER"),
        ("file_availability", "TEXT NOT NULL DEFAULT 'unknown'"),
        ("last_verified_at", "TEXT"),
    ];

    for (col_name, col_type) in needed_columns {
        let has_col: bool = conn
            .prepare(&format!(
                "SELECT COUNT(*) FROM pragma_table_info('downloads') WHERE name = '{}'",
                col_name
            ))?
            .query_row([], |row| row.get::<_, i64>(0))
            .unwrap_or(0)
            > 0;

        if !has_col {
            let alter_sql = format!(
                "ALTER TABLE downloads ADD COLUMN {} {};",
                col_name, col_type
            );
            conn.execute_batch(&alter_sql)?;
        }
    }

    // Indexes for fast library searching, filtering, and sorting
    conn.execute_batch(
        "
        CREATE INDEX IF NOT EXISTS idx_downloads_media_type ON downloads(media_type);
        CREATE INDEX IF NOT EXISTS idx_downloads_completed_at ON downloads(completed_at);
        CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at);
        CREATE INDEX IF NOT EXISTS idx_downloads_file_avail ON downloads(file_availability);
        CREATE INDEX IF NOT EXISTS idx_downloads_title ON downloads(title);
        ",
    )?;

    Ok(())
}

/// Helper to derive a clean format label from stored attributes if not explicitly populated.
pub fn derive_format_label(
    media_type: &str,
    format_selection_json: &str,
    file_ext: Option<&str>,
    custom_label: Option<&str>,
) -> String {
    if let Some(lbl) = custom_label {
        if !lbl.trim().is_empty() {
            return lbl.to_string();
        }
    }

    let ext_upper = file_ext
        .map(|e| e.trim_start_matches('.').to_uppercase())
        .unwrap_or_default();

    if media_type == "audio" {
        if ext_upper.is_empty() {
            "Audio".to_string()
        } else {
            format!("{} Audio", ext_upper)
        }
    } else {
        // Inspect format_selection JSON
        if format_selection_json.contains("\"1080p\"") {
            format!(
                "1080p {}",
                if ext_upper.is_empty() {
                    "Video"
                } else {
                    &ext_upper
                }
            )
        } else if format_selection_json.contains("\"720p\"") {
            format!(
                "720p {}",
                if ext_upper.is_empty() {
                    "Video"
                } else {
                    &ext_upper
                }
            )
        } else if format_selection_json.contains("\"4k\"")
            || format_selection_json.contains("\"2160p\"")
        {
            format!(
                "4K {}",
                if ext_upper.is_empty() {
                    "Video"
                } else {
                    &ext_upper
                }
            )
        } else if format_selection_json.contains("\"1440p\"") {
            format!(
                "1440p {}",
                if ext_upper.is_empty() {
                    "Video"
                } else {
                    &ext_upper
                }
            )
        } else if format_selection_json.contains("\"480p\"") {
            format!(
                "480p {}",
                if ext_upper.is_empty() {
                    "Video"
                } else {
                    &ext_upper
                }
            )
        } else if !ext_upper.is_empty() {
            format!("{} Video", ext_upper)
        } else {
            "Best Quality".to_string()
        }
    }
}

/// Queries the media library with parameterized search, status, media_type, availability filters,
/// sorting, and pagination. Also returns global summary metrics.
pub fn query_media_library(
    conn: &Connection,
    filter: &MediaLibraryFilter,
) -> Result<MediaLibraryResponse> {
    let mut where_clauses = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    // 1. Text search on title or uploader
    if let Some(ref q) = filter.search_query {
        let trimmed = q.trim();
        if !trimmed.is_empty() {
            let pattern = format!("%{}%", trimmed.to_lowercase());
            where_clauses.push("(LOWER(d.title) LIKE ? OR LOWER(COALESCE(d.uploader, '')) LIKE ?)");
            params_vec.push(Box::new(pattern.clone()));
            params_vec.push(Box::new(pattern));
        }
    }

    // 2. Status filter
    if let Some(ref st) = filter.status {
        let st_lower = st.trim().to_lowercase();
        if st_lower != "all" && !st_lower.is_empty() {
            where_clauses.push("LOWER(d.status) = ?");
            params_vec.push(Box::new(st_lower));
        }
    }

    // 3. Media type filter
    if let Some(ref mt) = filter.media_type {
        let mt_lower = mt.trim().to_lowercase();
        if mt_lower != "all" && !mt_lower.is_empty() {
            where_clauses.push("LOWER(d.media_type) = ?");
            params_vec.push(Box::new(mt_lower));
        }
    }

    // 4. File availability filter
    if let Some(ref av) = filter.availability {
        let av_lower = av.trim().to_lowercase();
        if av_lower != "all" && !av_lower.is_empty() {
            where_clauses.push("LOWER(d.file_availability) = ?");
            params_vec.push(Box::new(av_lower));
        }
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    // Sorting
    let sort_sql = match filter.sort_by.as_deref().unwrap_or("newest") {
        "oldest" => "ORDER BY COALESCE(d.completed_at, d.created_at) ASC",
        "title" => "ORDER BY d.title COLLATE NOCASE ASC",
        "file_size" => {
            "ORDER BY COALESCE(d.file_size_bytes, d.total_bytes, d.downloaded_bytes, 0) DESC"
        }
        _ => "ORDER BY COALESCE(d.completed_at, d.created_at) DESC",
    };

    // Calculate total count matching filters
    let count_query = format!("SELECT COUNT(*) FROM downloads d {}", where_sql);
    let mut count_stmt = conn.prepare(&count_query)?;
    let rusqlite_params: Vec<&dyn rusqlite::ToSql> =
        params_vec.iter().map(|p| p.as_ref()).collect();
    let total_count: i64 = count_stmt.query_row(rusqlite_params.as_slice(), |row| row.get(0))?;

    // Pagination
    let page = filter.page.unwrap_or(1).max(1);
    let page_size = filter.page_size.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * page_size;
    let total_pages = if total_count == 0 {
        1
    } else {
        ((total_count as f64) / (page_size as f64)).ceil() as u32
    };

    // Query items
    let select_sql = format!(
        "SELECT
            d.id, d.title, d.webpage_url, d.uploader, d.thumbnail_url,
            d.media_type, d.format_selection, d.format_label, d.file_extension,
            d.output_path, d.file_size_bytes, d.total_bytes, d.downloaded_bytes,
            d.duration, d.status, d.created_at, d.completed_at, d.error_message,
            (SELECT COUNT(*) FROM download_attempts a WHERE a.download_id = d.id) as attempts,
            d.file_availability, d.last_verified_at
        FROM downloads d
        {}
        {}
        LIMIT ? OFFSET ?",
        where_sql, sort_sql
    );

    let mut select_stmt = conn.prepare(&select_sql)?;
    let mut full_params: Vec<&dyn rusqlite::ToSql> =
        params_vec.iter().map(|p| p.as_ref()).collect();
    let limit_param = page_size as i64;
    let offset_param = offset as i64;
    full_params.push(&limit_param);
    full_params.push(&offset_param);

    let rows = select_stmt.query_map(full_params.as_slice(), |row| {
        let id: String = row.get(0)?;
        let title: String = row.get(1)?;
        let source_url: String = row.get(2)?;
        let uploader: Option<String> = row.get(3)?;
        let thumbnail_url: Option<String> = row.get(4)?;
        let media_type: String = row.get(5)?;
        let format_json: String = row.get(6)?;
        let format_label_raw: Option<String> = row.get(7)?;
        let file_extension: Option<String> = row.get(8)?;
        let output_path: Option<String> = row.get(9)?;
        let file_size_bytes_db: Option<i64> = row.get(10)?;
        let total_bytes: Option<i64> = row.get(11)?;
        let downloaded_bytes: Option<i64> = row.get(12)?;
        let duration: Option<f64> = row.get(13)?;
        let status: String = row.get(14)?;
        let created_at: String = row.get(15)?;
        let completed_at: Option<String> = row.get(16)?;
        let last_error: Option<String> = row.get(17)?;
        let attempt_count: i64 = row.get(18)?;
        let file_avail_str: String = row.get(19)?;
        let last_verified_at: Option<String> = row.get(20)?;

        let format_label = derive_format_label(
            &media_type,
            &format_json,
            file_extension.as_deref(),
            format_label_raw.as_deref(),
        );

        let file_size_bytes = file_size_bytes_db
            .or(total_bytes)
            .or(downloaded_bytes)
            .filter(|&b| b > 0)
            .map(|b| b as u64);

        Ok(MediaLibraryItem {
            id,
            title,
            source_url,
            uploader,
            thumbnail_url,
            media_type,
            format_label,
            file_extension,
            output_path,
            file_size_bytes,
            duration,
            status,
            created_at,
            completed_at,
            last_error,
            attempt_count: attempt_count.max(1) as u32,
            file_availability: FileAvailability::from_str(&file_avail_str),
            last_verified_at,
        })
    })?;

    let mut items = Vec::new();
    for r in rows.flatten() {
        items.push(r);
    }

    // Global summary
    let summary = get_media_library_summary(conn)?;

    Ok(MediaLibraryResponse {
        items,
        total_count: total_count as usize,
        page,
        page_size,
        total_pages,
        summary,
    })
}

/// Computes overall library summary metrics from stored downloads.
pub fn get_media_library_summary(conn: &Connection) -> Result<MediaLibrarySummary> {
    let mut stmt = conn.prepare(
        "SELECT
            COUNT(CASE WHEN LOWER(status) = 'completed' THEN 1 END) as total_completed,
            COUNT(CASE WHEN LOWER(status) = 'failed' THEN 1 END) as total_failed,
            COUNT(CASE WHEN LOWER(status) = 'cancelled' THEN 1 END) as total_cancelled,
            COALESCE(SUM(
                CASE WHEN LOWER(status) = 'completed'
                     THEN COALESCE(file_size_bytes, total_bytes, downloaded_bytes, 0)
                     ELSE 0 END
            ), 0) as total_bytes
        FROM downloads",
    )?;

    stmt.query_row([], |row| {
        let total_completed: i64 = row.get(0)?;
        let total_failed: i64 = row.get(1)?;
        let total_cancelled: i64 = row.get(2)?;
        let total_bytes: i64 = row.get(3)?;

        Ok(MediaLibrarySummary {
            total_completed: total_completed.max(0) as usize,
            total_failed: total_failed.max(0) as usize,
            total_cancelled: total_cancelled.max(0) as usize,
            total_library_bytes: total_bytes.max(0) as u64,
        })
    })
}

/// Fetches a single library item by task/download id.
pub fn fetch_media_item_by_id(conn: &Connection, id: &str) -> Result<Option<MediaLibraryItem>> {
    let mut stmt = conn.prepare(
        "SELECT
            d.id, d.title, d.webpage_url, d.uploader, d.thumbnail_url,
            d.media_type, d.format_selection, d.format_label, d.file_extension,
            d.output_path, d.file_size_bytes, d.total_bytes, d.downloaded_bytes,
            d.duration, d.status, d.created_at, d.completed_at, d.error_message,
            (SELECT COUNT(*) FROM download_attempts a WHERE a.download_id = d.id) as attempts,
            d.file_availability, d.last_verified_at
        FROM downloads d
        WHERE d.id = ?1",
    )?;

    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let title: String = row.get(1)?;
        let source_url: String = row.get(2)?;
        let uploader: Option<String> = row.get(3)?;
        let thumbnail_url: Option<String> = row.get(4)?;
        let media_type: String = row.get(5)?;
        let format_json: String = row.get(6)?;
        let format_label_raw: Option<String> = row.get(7)?;
        let file_extension: Option<String> = row.get(8)?;
        let output_path: Option<String> = row.get(9)?;
        let file_size_bytes_db: Option<i64> = row.get(10)?;
        let total_bytes: Option<i64> = row.get(11)?;
        let downloaded_bytes: Option<i64> = row.get(12)?;
        let duration: Option<f64> = row.get(13)?;
        let status: String = row.get(14)?;
        let created_at: String = row.get(15)?;
        let completed_at: Option<String> = row.get(16)?;
        let last_error: Option<String> = row.get(17)?;
        let attempt_count: i64 = row.get(18)?;
        let file_avail_str: String = row.get(19)?;
        let last_verified_at: Option<String> = row.get(20)?;

        let format_label = derive_format_label(
            &media_type,
            &format_json,
            file_extension.as_deref(),
            format_label_raw.as_deref(),
        );

        let file_size_bytes = file_size_bytes_db
            .or(total_bytes)
            .or(downloaded_bytes)
            .filter(|&b| b > 0)
            .map(|b| b as u64);

        Ok(Some(MediaLibraryItem {
            id,
            title,
            source_url,
            uploader,
            thumbnail_url,
            media_type,
            format_label,
            file_extension,
            output_path,
            file_size_bytes,
            duration,
            status,
            created_at,
            completed_at,
            last_error,
            attempt_count: attempt_count.max(1) as u32,
            file_availability: FileAvailability::from_str(&file_avail_str),
            last_verified_at,
        }))
    } else {
        Ok(None)
    }
}

/// Updates the file verification state and verified size for a download record.
pub fn update_media_file_verification(
    conn: &Connection,
    id: &str,
    availability: FileAvailability,
    file_size_bytes: Option<u64>,
    file_extension: Option<&str>,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    let avail_str = availability.as_str();

    conn.execute(
        "UPDATE downloads SET
            file_availability = ?1,
            file_size_bytes = COALESCE(?2, file_size_bytes),
            file_extension = COALESCE(?3, file_extension),
            last_verified_at = ?4,
            updated_at = ?4
        WHERE id = ?5",
        params![
            avail_str,
            file_size_bytes.map(|s| s as i64),
            file_extension,
            now,
            id,
        ],
    )?;

    Ok(())
}

/// Relinks a moved file with a new verified path and updates availability.
pub fn relink_media_item(
    conn: &Connection,
    id: &str,
    new_path: &str,
    file_size_bytes: u64,
    file_extension: Option<&str>,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE downloads SET
            output_path = ?1,
            file_size_bytes = ?2,
            file_extension = COALESCE(?3, file_extension),
            file_availability = 'available',
            last_verified_at = ?4,
            updated_at = ?4
        WHERE id = ?5",
        params![new_path, file_size_bytes as i64, file_extension, now, id,],
    )?;

    Ok(())
}

/// Deletes a download history record without touching files on disk.
pub fn delete_history_record(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM downloads WHERE id = ?1", params![id])?;
    Ok(())
}

/// Fetches completed downloads with an output path for batch availability verification.
pub fn fetch_completed_downloads_for_verification(
    conn: &Connection,
    limit: usize,
) -> Result<Vec<(String, String)>> {
    let mut stmt = conn.prepare(
        "SELECT id, output_path FROM downloads
         WHERE LOWER(status) = 'completed' AND output_path IS NOT NULL AND output_path != ''
         ORDER BY COALESCE(last_verified_at, '1970-01-01') ASC
         LIMIT ?1",
    )?;

    let rows = stmt.query_map(params![limit as i64], |row| Ok((row.get(0)?, row.get(1)?)))?;

    let mut result = Vec::new();
    for r in rows.flatten() {
        result.push(r);
    }
    Ok(result)
}

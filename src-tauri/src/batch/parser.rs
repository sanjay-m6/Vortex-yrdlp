pub fn parse_batch_text(input: &str) -> Vec<(usize, String)> {
    let mut results = Vec::new();

    for (idx, line) in input.lines().enumerate() {
        let line_num = idx + 1;
        let trimmed = line.trim();

        // Skip blank lines and comments starting with '#'
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        // Handle space or tab separated tokens on the same line if multiple URLs are pasted
        let tokens: Vec<&str> = trimmed.split_whitespace().collect();
        if tokens.len() > 1
            && tokens
                .iter()
                .all(|t| t.starts_with("http://") || t.starts_with("https://"))
        {
            for token in tokens {
                results.push((line_num, token.to_string()));
            }
        } else {
            results.push((line_num, trimmed.to_string()));
        }

        // Bounded max limit
        if results.len() >= 500 {
            break;
        }
    }

    results
}

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde_json::json;

use crate::graph::CodeGraph;
use super::ToolResult;

/// Returns the last `n` components of a path for display.
fn shorten_path(path: &Path, n: usize) -> String {
    let components: Vec<_> = path.components().collect();
    if components.len() <= n {
        return path.display().to_string();
    }
    let last_n: Vec<_> = components[components.len() - n..].iter().map(|c| c.as_os_str()).collect();
    format!(".../{}", last_n.iter().map(|s| s.to_string_lossy()).collect::<Vec<_>>().join("/"))
}

/// Lists all files that depend on the given file (direct + indirect).
///
/// `file_deps(graph, path, depth)` calls `graph.file_dependents(path, depth)`.
/// - `direct`: files at depth 1 (symbol-level callers, excluding the file itself)
/// - `indirect`: files at depth 2..=depth
/// - `total`: direct + indirect count
pub fn file_deps(graph: &CodeGraph, file_path: &str, depth: usize) -> ToolResult {
    let path = PathBuf::from(file_path);

    if !graph.is_ready() {
        return ToolResult {
            call_id: String::new(),
            output: "Code graph is not yet indexed.".to_string(),
            success: false,
        };
    }

    if graph.symbols_in_file(&path).is_none() {
        return ToolResult {
            call_id: String::new(),
            output: format!("File '{}' not found in code graph.", file_path),
            success: false,
        };
    }

    // All dependents up to `depth`
    let all_dependents = graph.file_dependents(&path, depth);

    // Direct: depth 1 only (i.e. files whose symbols directly call this file's symbols)
    let direct_ids: HashSet<_> = {
        let symbol_ids = match graph.symbols_in_file(&path) {
            Some(ids) => ids,
            None => return ToolResult {
                call_id: String::new(),
                output: format!("File '{}' not found in code graph.", file_path),
                success: false,
            },
        };
        let mut direct = HashSet::new();
        for &sym_id in symbol_ids {
            if let Some(edges) = graph.callers(sym_id) {
                for edge in edges {
                    if let Some(node) = graph.node(edge.to) {
                        if node.file != path {
                            direct.insert(node.file.clone());
                        }
                    }
                }
            }
        }
        direct
    };

    let mut indirect = Vec::new();
    for dep in &all_dependents {
        if !direct_ids.contains(dep) {
            indirect.push(dep.clone());
        }
    }

    let direct: Vec<String> = direct_ids.iter().map(|p| shorten_path(p, 3)).collect();
    let indirect: Vec<String> = indirect.iter().map(|p| shorten_path(p, 3)).collect();
    let total = direct.len() + indirect.len();

    ToolResult {
        call_id: String::new(),
        output: json!({
            "direct": direct,
            "indirect": indirect,
            "total": total,
        }).to_string(),
        success: true,
    }
}

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use super::ToolResult;

/// Returns the last 3 components of a path for display.
fn shorten_path(path: &Path) -> String {
    let components: Vec<_> = path.components().collect();
    if components.len() <= 3 {
        return path.display().to_string();
    }
    let last3: Vec<_> = components[components.len() - 3..].iter().map(|c| c.as_os_str()).collect();
    format!(".../{}", last3.iter().map(|s| s.to_string_lossy()).collect::<Vec<_>>().join("/"))
}

/// Evaluates the blast radius of changing a file.
/// Returns human-readable formatted text.
pub fn blast_radius(graph: &crate::graph::CodeGraph, file_path: &str) -> ToolResult {
    let path = PathBuf::from(file_path);

    if !graph.is_ready() {
        return ToolResult {
            call_id: String::new(),
            output: "Code graph is not yet indexed. The graph will be available after the \
                background indexer completes. Try again shortly.".to_string(),
            success: false,
        };
    }

    let symbols = match graph.symbols_in_file(&path) {
        Some(ids) => ids.clone(),
        None => {
            return ToolResult {
                call_id: String::new(),
                output: format!(
                    "File '{}' not found in code graph. Check the path or wait for indexing.",
                    file_path
                ),
                success: false,
            };
        }
    };

    // Direct dependents (depth 1): files whose symbols directly call this file's symbols
    let mut direct = HashSet::new();
    for &sym_id in &symbols {
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

    // Indirect dependents (depth 2-3): use file_dependents with depth 3,
    // then subtract direct dependents
    let all_dependents = graph.file_dependents(&path, 3);
    let mut indirect = HashSet::new();
    for dep in &all_dependents {
        if !direct.contains(dep) {
            indirect.insert(dep.clone());
        }
    }

    let total = direct.len() + indirect.len();

    let mut out = format!("Blast radius for {}:\n\n", shorten_path(&path));

    out.push_str(&format!("DIRECT DEPENDENTS ({} files):\n", direct.len()));
    if direct.is_empty() {
        out.push_str("  (none)\n");
    } else {
        let mut sorted: Vec<_> = direct.iter().collect();
        sorted.sort();
        for f in sorted {
            out.push_str(&format!("  {}\n", shorten_path(f)));
        }
    }

    out.push_str(&format!("\nINDIRECT DEPENDENTS ({} files):\n", indirect.len()));
    if indirect.is_empty() {
        out.push_str("  (none)\n");
    } else {
        let mut sorted: Vec<_> = indirect.iter().collect();
        sorted.sort();
        for f in sorted {
            out.push_str(&format!("  {}\n", shorten_path(f)));
        }
    }

    out.push_str(&format!("\nTOTAL IMPACT: {} files\n", total));

    ToolResult {
        call_id: String::new(),
        output: out,
        success: true,
    }
}
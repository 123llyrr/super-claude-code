use crate::graph::CodeGraph;
use super::ToolResult;

/// Find the shortest call chain between two symbols.
///
/// Returns a human-readable call chain or an error message if either symbol
/// is not found or no path exists between them.
pub fn trace_chain(graph: &CodeGraph, from: &str, to: &str) -> ToolResult {
    // Find source symbol
    let from_matches = graph.find_by_name(from);
    if from_matches.is_empty() {
        return ToolResult {
            call_id: String::new(),
            output: format!("Source symbol '{}' not found in code graph ({} symbols indexed).",
                from, graph.node_count()),
            success: false,
        };
    }

    // Find target symbol
    let to_matches = graph.find_by_name(to);
    if to_matches.is_empty() {
        return ToolResult {
            call_id: String::new(),
            output: format!("Target symbol '{}' not found in code graph ({} symbols indexed).",
                to, graph.node_count()),
            success: false,
        };
    }

    // Try all combinations of from/to matches to find any path
    let mut out = String::new();
    let mut found_any = false;

    for from_sym in &from_matches {
        for to_sym in &to_matches {
            if let Some(path) = graph.shortest_path(from_sym.id, to_sym.id) {
                found_any = true;
                out.push_str(&format!("Call chain from {}() to {}():\n\n", from, to));
                for (i, &sym_id) in path.iter().enumerate() {
                    if let Some(node) = graph.node(sym_id) {
                        let arrow = if i == 0 { "" } else { "  → " };
                        let indent = if i == 0 { "" } else { "    " };
                        out.push_str(&format!("{}{}{}() ({}:{})\n",
                            indent, arrow, node.name, shorten_path(&node.file), node.start_line));
                    }
                }
                out.push('\n');
                out.push_str("[SCOPE: The issue is in ONE of these functions. Read ONLY these files — do not explore outside this chain.]");
            }
        }
    }

    if !found_any {
        out.push_str(&format!("No call path found between {}() and {}()", from, to));
    }

    ToolResult {
        call_id: String::new(),
        output: out,
        success: found_any,
    }
}

fn shorten_path(path: &std::path::Path) -> String {
    let components: Vec<_> = path.components().collect();
    if components.len() <= 3 {
        return path.display().to_string();
    }
    let last3: Vec<_> = components[components.len() - 3..].iter().map(|c| c.as_os_str()).collect();
    format!(".../{}", last3.iter().map(|s| s.to_string_lossy()).collect::<Vec<_>>().join("/"))
}

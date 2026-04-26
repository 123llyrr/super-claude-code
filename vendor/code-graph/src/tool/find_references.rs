use std::path::PathBuf;

use serde::Serialize;

use crate::graph::{CodeGraph, EdgeKind, SymbolKind};

/// A reference to a symbol (caller site).
#[derive(Serialize)]
pub struct ReferenceInfo {
    pub file: String,
    pub line: usize,
    pub name: String,
    pub kind: String,
    pub context: String,
    pub depth: usize,
}

/// Tool result for find_references.
#[derive(Serialize)]
pub struct FindReferencesResult {
    pub references: Vec<ReferenceInfo>,
}

/// Find all references (callers) to a symbol across the project.
///
/// # Arguments
/// * `graph` - The code graph to query
/// * `symbol` - The symbol name to find references for
/// * `file_path` - Anchor file path (used to resolve which symbol instance to use if multiple match)
///
/// # Returns
/// A JSON string containing all reference locations with file, line, name, kind, and call context.
pub fn find_references(graph: &CodeGraph, symbol: &str, file_path: &str) -> ToolResult {
    // Find all symbols matching the name
    let candidates: Vec<_> = graph.find_by_name(symbol);

    if candidates.is_empty() {
        return ToolResult {
            call_id: String::new(),
            output: serde_json::to_string(&FindReferencesResult { references: vec![] }).unwrap(),
            success: false,
        };
    };

    // If file_path is provided, try to find the best matching symbol in that file
    let anchor_path = PathBuf::from(file_path);
    let target_symbol = if !candidates.iter().any(|s| s.file == anchor_path) {
        // No exact match in the anchor file, pick the first candidate
        candidates.first().copied()
    } else {
        // Find the symbol defined in the anchor file
        candidates.iter().find(|s| s.file == anchor_path).copied()
    };

    let Some(target) = target_symbol else {
        return ToolResult {
            call_id: String::new(),
            output: serde_json::to_string(&FindReferencesResult { references: vec![] }).unwrap(),
            success: false,
        };
    };

    let mut references: Vec<ReferenceInfo> = Vec::new();

    // Get direct callers (depth = 1)
    if let Some(edges) = graph.callers(target.id) {
        for edge in edges {
            if let Some(caller_node) = graph.node(edge.to) {
                // Only include actual Calls edges (not References or Imports)
                if matches!(edge.kind, EdgeKind::Calls) {
                    references.push(ReferenceInfo {
                        file: caller_node.file.to_string_lossy().to_string(),
                        line: edge.line,
                        name: caller_node.name.clone(),
                        kind: kind_to_string(&caller_node.kind),
                        context: format!("calls {}", symbol),
                        depth: 1,
                    });
                }
            }
        }
    }

    // Get transitive callers (up to depth 3)
    let transitive = graph.trace_callers(target.id, 3);
    for (caller_id, depth) in transitive {
        if let Some(caller_node) = graph.node(caller_id) {
            // Get the edge line for context
            let edge_line = graph
                .callers(target.id)
                .and_then(|edges| edges.iter().find(|e| e.to == caller_id))
                .map(|e| e.line)
                .unwrap_or(0);

            references.push(ReferenceInfo {
                file: caller_node.file.to_string_lossy().to_string(),
                line: edge_line,
                name: caller_node.name.clone(),
                kind: kind_to_string(&caller_node.kind),
                context: format!("calls {} (depth {})", symbol, depth),
                depth,
            });
        }
    }

    // Sort by file and line
    references.sort_by(|a, b| {
        let file_cmp = a.file.cmp(&b.file);
        if file_cmp == std::cmp::Ordering::Equal {
            a.line.cmp(&b.line)
        } else {
            file_cmp
        }
    });

    // Deduplicate by (file, line)
    references.dedup_by(|a, b| a.file == b.file && a.line == b.line);

    let result = FindReferencesResult { references };
    ToolResult {
        call_id: String::new(),
        output: serde_json::to_string(&result).unwrap(),
        success: true,
    }
}

/// Convert SymbolKind to a human-readable string.
fn kind_to_string(kind: &SymbolKind) -> String {
    match kind {
        SymbolKind::Function => "Function".to_string(),
        SymbolKind::Method => "Method".to_string(),
        SymbolKind::Struct => "Struct".to_string(),
        SymbolKind::Class => "Class".to_string(),
        SymbolKind::Trait => "Trait".to_string(),
        SymbolKind::Interface => "Interface".to_string(),
        SymbolKind::Enum => "Enum".to_string(),
        SymbolKind::Constant => "Constant".to_string(),
        SymbolKind::Variable => "Variable".to_string(),
        SymbolKind::Module => "Module".to_string(),
        SymbolKind::Import => "Import".to_string(),
        SymbolKind::TypeAlias => "TypeAlias".to_string(),
        SymbolKind::Other(s) => s.clone(),
    }
}

/// Tool result structure for JSON output.
pub use super::ToolResult;

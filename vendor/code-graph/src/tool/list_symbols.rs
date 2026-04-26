use std::path::PathBuf;

use serde::Serialize;

use crate::graph::{CodeGraph, SymbolKind};

/// Result of list_symbols: a list of symbols in a file.
#[derive(Serialize)]
pub struct SymbolInfo {
    pub name: String,
    pub kind: String,
    pub start_line: usize,
    pub end_line: usize,
}

/// Tool result for list_symbols.
#[derive(Serialize)]
pub struct ListSymbolsResult {
    pub symbols: Vec<SymbolInfo>,
}

/// List all symbols (functions, structs, etc.) in a given file.
///
/// # Arguments
/// * `graph` - The code graph to query
/// * `file_path` - Absolute path to the source file
///
/// # Returns
/// A JSON string containing the list of symbols with their name, kind, and line ranges.
pub fn list_symbols(graph: &CodeGraph, file_path: &str) -> ToolResult {
    let path = PathBuf::from(file_path);

    let symbol_ids = match graph.symbols_in_file(&path) {
        Some(ids) => ids,
        None => {
            return ToolResult {
                call_id: String::new(),
                output: serde_json::to_string(&ListSymbolsResult { symbols: vec![] }).unwrap(),
                success: false,
            };
        }
    };

    let mut symbols: Vec<SymbolInfo> = Vec::new();

    for &id in symbol_ids {
        if let Some(node) = graph.node(id) {
            symbols.push(SymbolInfo {
                name: node.name.clone(),
                kind: kind_to_string(&node.kind),
                start_line: node.start_line,
                end_line: node.end_line,
            });
        }
    }

    // Sort by start line
    symbols.sort_by_key(|s| s.start_line);

    let result = ListSymbolsResult { symbols };
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

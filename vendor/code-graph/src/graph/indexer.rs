use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::Mutex;

use parking_lot::RwLock;

use ignore::WalkBuilder;
use streaming_iterator::StreamingIterator;
use tree_sitter::{Parser, Query, QueryCursor};

use crate::semantic::language::{Lang, LanguageRegistry};

use super::resolve::resolve_callee;
use super::{CodeGraph, Edge, EdgeKind, SymbolKind, SymbolNode, Visibility};

/// Result of parsing a single file: extracted symbols and raw call edges.
struct FileParseResult {
    symbols: Vec<SymbolNode>,
    raw_calls: Vec<RawCall>,
}

/// A raw (unresolved) call extracted from source.
struct RawCall {
    caller_name: String,
    callee_name: String,
    line: usize,
}

/// Supported extensions for indexing.
const INDEXED_EXTENSIONS: &[&str] = &[
    "rs", "py", "js", "ts", "tsx", "go", "java", "c", "cpp", "vue",
];

/// Directory names that should never be indexed as source roots.
const SKIPPED_DIR_NAMES: &[&str] = &[
    ".git",
    ".worktrees",
    "node_modules",
    "target",
    "deps",
    ".next",
    ".nuxt",
    ".svelte-kit",
    "dist",
    "build",
    "coverage",
];

/// Background indexer that walks a project directory, parses source files
/// with tree-sitter, extracts symbols and call edges, and populates a
/// shared `CodeGraph`.
pub struct GraphIndexer {
    pub graph: Arc<RwLock<CodeGraph>>,
    project_dir: Arc<Mutex<PathBuf>>,
}

impl GraphIndexer {
    /// Create a new indexer for the given project directory.
    pub fn new(graph: Arc<RwLock<CodeGraph>>, project_dir: PathBuf) -> Self {
        Self {
            graph,
            project_dir: Arc::new(Mutex::new(project_dir)),
        }
    }

    /// Update the project directory (interior mutability for use via RwLock).
    pub fn set_project_dir(&self, project_dir: PathBuf) {
        *self.project_dir.lock().unwrap() = project_dir;
    }

    /// Get a clone of the current project directory.
    pub fn get_project_dir(&self) -> PathBuf {
        self.project_dir.lock().unwrap().clone()
    }

    /// Full/incremental index pass.
    ///
    /// 1. Collect files via `ignore::WalkBuilder` (respects .gitignore)
    /// 2. Compare mtimes — only parse dirty/new files
    /// 3. Detect deleted files — remove from graph
    /// 4. Parse dirty files, extract symbols and calls
    /// 5. Resolve calls to edges
    pub fn index_all(&mut self) {
        // Refuse to index obvious non-projects. Walking $HOME (or /) pulls
        // in Library/, Downloads/, Documents/ trees with hundreds of
        // thousands of paths — the sync walk then pegs a tokio worker
        // thread for seconds, starving the TUI event loop (the 5 ms
        // deferred-render-tick stops firing, so typed characters don't
        // show up until something else wakes the runtime). If someone
        // really does keep code at $HOME, they can drop a `.git` in there
        // and it'll be treated as a project again (see `looks_like_project`).
        if is_home_or_root(&self.get_project_dir()) && !looks_like_project(&self.get_project_dir()) {
            return;
        }

        // Walk + stat the tree on a dedicated thread. `WalkBuilder` is pure sync I/O;
        // running it on a background thread avoids blocking the async runtime.
        let project_dir = self.get_project_dir();
        let files = std::thread::spawn(move || collect_files_sync(&project_dir))
            .join()
            .unwrap_or_default();
        let current_paths: HashSet<PathBuf> = files.iter().map(|(p, _)| p.clone()).collect();

        // Snapshot mtimes under a short read lock to determine dirty files.
        let (deleted, dirty_files) = {
            let graph = self.graph.read();
            let deleted: Vec<PathBuf> = graph.file_mtimes.keys()
                .filter(|p| !current_paths.contains(*p))
                .cloned()
                .collect();
            let dirty: Vec<(PathBuf, u64)> = files.into_iter()
                .filter(|(path, mtime)| {
                    graph.file_mtimes.get(path) != Some(mtime)
                })
                .collect();
            (deleted, dirty)
        };
        // Read lock released here.

        // Parse dirty files OUTSIDE the lock (CPU-intensive, no graph access needed).
        let worker_count = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
            .min(dirty_files.len().max(1))
            .min(8);

        let all_results: Vec<(PathBuf, u64, FileParseResult)> = if worker_count <= 1 {
            dirty_files
                .into_iter()
                .filter_map(|(path, mtime)| parse_file_at_path(&path).map(|result| (path, mtime, result)))
                .collect()
        } else {
            let chunk_size = dirty_files.len().div_ceil(worker_count);
            let workers: Vec<_> = dirty_files
                .chunks(chunk_size)
                .map(|chunk| {
                    let chunk = chunk.to_vec();
                    std::thread::spawn(move || {
                        chunk.into_iter()
                            .filter_map(|(path, mtime)| parse_file_at_path(&path).map(|result| (path, mtime, result)))
                            .collect::<Vec<_>>()
                    })
                })
                .collect();

            let mut results = Vec::new();
            for worker in workers {
                if let Ok(mut chunk_results) = worker.join() {
                    results.append(&mut chunk_results);
                }
            }
            results
        };

        eprintln!(
            "[code-graph] parsed {} dirty files with {} workers",
            all_results.len(),
            worker_count
        );

        if deleted.is_empty() && all_results.is_empty() {
            return; // Nothing to update
        }

        // Single write lock for ALL mutations — atomic from readers' perspective.
        // Grep/trace_callees will block briefly here but never see partial state.
        let mut graph = self.graph.write();

        // Remove deleted files
        for path in &deleted {
            graph.remove_file(path);
        }

        // Remove + re-insert dirty files
        for (path, mtime, result) in &all_results {
            graph.remove_file(path);
            for sym in &result.symbols {
                graph.add_symbol(sym.clone());
            }
            graph.file_mtimes.insert(path.clone(), *mtime);
        }

        // Resolve calls to edges (all symbols inserted, safe to resolve)
        for (_path, _mtime, result) in &all_results {
            for raw_call in &result.raw_calls {
                let caller_candidates = graph.find_by_name(&raw_call.caller_name);
                let caller_id = caller_candidates.first().map(|s| s.id);
                if let Some(caller_id) = caller_id {
                    let caller_file = graph.node(caller_id).unwrap().file.clone();
                    if let Some(callee_id) =
                        resolve_callee(&graph, &raw_call.callee_name, &caller_file, &[])
                    {
                        graph.add_edge(
                            caller_id,
                            Edge { to: callee_id, kind: EdgeKind::Calls, line: raw_call.line },
                        );
                    }
                }
            }
        }
        // Write lock released here — graph is fully consistent.
    }

    /// Re-index a single file (for live updates after edit).
    pub fn reindex_file(&mut self, path: &Path) {
        let mtime = match std::fs::metadata(path) {
            Ok(meta) => {
                use std::time::UNIX_EPOCH;
                meta.modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0)
            }
            Err(_) => {
                // File was deleted
                let mut graph = self.graph.write();
                graph.remove_file(&path.to_path_buf());
                return;
            }
        };

        let result = match parse_file_at_path(path) {
            Some(r) => r,
            None => return,
        };

        let mut graph = self.graph.write();
        let path_buf = path.to_path_buf();

        // Remove old data
        graph.remove_file(&path_buf);

        // Insert symbols
        for sym in &result.symbols {
            graph.add_symbol(sym.clone());
        }
        graph.file_mtimes.insert(path_buf.clone(), mtime);

        // Resolve calls
        for raw_call in &result.raw_calls {
            let caller_candidates = graph.find_by_name(&raw_call.caller_name);
            let caller_id = caller_candidates.first().map(|s| s.id);

            if let Some(caller_id) = caller_id {
                let caller_file = graph.node(caller_id).unwrap().file.clone();
                if let Some(callee_id) =
                    resolve_callee(&graph, &raw_call.callee_name, &caller_file, &[])
                {
                    graph.add_edge(
                        caller_id,
                        Edge {
                            to: callee_id,
                            kind: EdgeKind::Calls,
                            line: raw_call.line,
                        },
                    );
                }
            }
        }
    }

    /// Walk the project directory, returning (path, mtime) for indexable files.
    /// Kept as a method for legacy callers / tests; dispatches to the free
    /// function so `index_all` can run the same logic on a blocking thread.
    #[allow(dead_code)]
    fn collect_files(&self) -> Vec<(PathBuf, u64)> {
        collect_files_sync(&self.get_project_dir())
    }
}

/// Parse a single file: extract symbols and raw calls.
fn parse_file_at_path(path: &Path) -> Option<FileParseResult> {
    let source = std::fs::read_to_string(path).ok()?;
    let lang = LanguageRegistry::detect(path)?;

    let mut parser = Parser::new();
    parser.set_language(&lang.grammar()).ok()?;
    let tree = parser.parse(source.as_bytes(), None)?;

    let symbols = extract_symbols(path, &source, lang, &tree);
    let raw_calls = extract_calls(&source, lang, &tree, &symbols);

    Some(FileParseResult { symbols, raw_calls })
}

pub fn list_symbols_in_file(path: &Path) -> Vec<SymbolNode> {
    parse_file_at_path(path)
        .map(|result| result.symbols)
        .unwrap_or_default()
}

/// Extract symbol definitions from a parsed tree using the language's symbols_query.
fn extract_symbols(
    path: &Path,
    source: &str,
    lang: Lang,
    tree: &tree_sitter::Tree,
) -> Vec<SymbolNode> {
    let query_src = lang.symbols_query();
    let query = match Query::new(&lang.grammar(), query_src) {
        Ok(q) => q,
        Err(_) => return Vec::new(),
    };

    let def_idx = match query.capture_index_for_name("definition") {
        Some(i) => i,
        None => return Vec::new(),
    };
    let name_idx = match query.capture_index_for_name("name") {
        Some(i) => i,
        None => return Vec::new(),
    };

    let mut cursor = QueryCursor::new();
    let mut matches = cursor.matches(&query, tree.root_node(), source.as_bytes());

    let mut symbols = Vec::new();
    let mut seen_ranges: HashSet<(usize, usize)> = HashSet::new();
    let path_buf = path.to_path_buf();

    loop {
        matches.advance();
        let m = match matches.get() {
            Some(m) => m,
            None => break,
        };

        let mut sym_name: Option<String> = None;
        let mut def_start_line = 0usize;
        let mut def_end_line = 0usize;
        let mut def_start_byte = 0usize;
        let mut def_end_byte = 0usize;
        let mut ts_kind = "";
        let mut has_def = false;

        for capture in m.captures {
            if capture.index == name_idx {
                sym_name = Some(
                    source[capture.node.start_byte()..capture.node.end_byte()].to_string(),
                );
            }
            if capture.index == def_idx {
                def_start_byte = capture.node.start_byte();
                def_end_byte = capture.node.end_byte();
                def_start_line = capture.node.start_position().row + 1;
                def_end_line = capture.node.end_position().row + 1;
                ts_kind = capture.node.kind();
                has_def = true;
            }
        }

        if let (Some(name), true) = (sym_name, has_def) {
            let range = (def_start_byte, def_end_byte);
            if seen_ranges.contains(&range) {
                continue;
            }
            seen_ranges.insert(range);

            let id = CodeGraph::make_id(&path_buf, &name, def_start_line);
            let kind = classify_symbol_kind(ts_kind);

            symbols.push(SymbolNode {
                id,
                name,
                kind,
                visibility: Visibility::Unknown,
                file: path_buf.clone(),
                start_line: def_start_line,
                end_line: def_end_line,
                signature: None,
            });
        }
    }

    symbols
}

/// Extract raw call edges from a parsed tree using the language's calls_query.
fn extract_calls(
    source: &str,
    lang: Lang,
    tree: &tree_sitter::Tree,
    symbols: &[SymbolNode],
) -> Vec<RawCall> {
    let query_src = match lang.calls_query() {
        Some(q) => q,
        None => return Vec::new(),
    };

    let query = match Query::new(&lang.grammar(), query_src) {
        Ok(q) => q,
        Err(_) => return Vec::new(),
    };

    let callee_idx = match query.capture_index_for_name("callee") {
        Some(i) => i,
        None => return Vec::new(),
    };

    let mut cursor = QueryCursor::new();
    let mut matches = cursor.matches(&query, tree.root_node(), source.as_bytes());

    let mut raw_calls = Vec::new();

    loop {
        matches.advance();
        let m = match matches.get() {
            Some(m) => m,
            None => break,
        };

        for capture in m.captures {
            if capture.index == callee_idx {
                let callee_name =
                    source[capture.node.start_byte()..capture.node.end_byte()].to_string();
                let call_line = capture.node.start_position().row + 1;

                let caller_name = symbols
                    .iter()
                    .filter(|s| {
                        matches!(s.kind, SymbolKind::Function | SymbolKind::Method)
                            && s.start_line <= call_line
                            && call_line <= s.end_line
                    })
                    .last()
                    .map(|s| s.name.clone());

                if let Some(caller_name) = caller_name {
                    if caller_name == callee_name {
                        continue;
                    }

                    raw_calls.push(RawCall {
                        caller_name,
                        callee_name,
                        line: call_line,
                    });
                }
            }
        }
    }

    raw_calls
}

/// Map tree-sitter node kind strings to `SymbolKind`.
fn classify_symbol_kind(ts_kind: &str) -> SymbolKind {
    match ts_kind {
        "function_item" | "function_definition" | "function_declaration" | "func_literal" => {
            SymbolKind::Function
        }
        "method_definition" | "method_declaration" => SymbolKind::Method,
        "struct_item" | "struct_specifier" => SymbolKind::Struct,
        "class_definition" | "class_declaration" | "class_specifier" => SymbolKind::Class,
        "trait_item" => SymbolKind::Trait,
        "interface_declaration" => SymbolKind::Interface,
        "enum_item" | "enum_declaration" | "enum_specifier" => SymbolKind::Enum,
        "const_item" | "const_declaration" => SymbolKind::Constant,
        "let_declaration" | "variable_declaration" | "static_item" => SymbolKind::Variable,
        "mod_item" | "module" => SymbolKind::Module,
        "use_declaration" | "import_statement" | "import_declaration" => SymbolKind::Import,
        "type_item" | "type_alias_declaration" => SymbolKind::TypeAlias,
        "impl_item" => SymbolKind::Other("impl".to_string()),
        other => SymbolKind::Other(other.to_string()),
    }
}

/// True when `path` is the user's HOME directory or the filesystem root.
/// Either one hosts a massive tree the indexer should never walk in full.
fn is_home_or_root(path: &Path) -> bool {
    if path == Path::new("/") {
        return true;
    }
    if let Some(home) = dirs::home_dir() {
        if path == home.as_path() {
            return true;
        }
    }
    false
}

/// Cheap "is this a project?" heuristic — checks for a project-marker
/// file or directory at the root. Used as an escape hatch for users who
/// *do* keep code at $HOME: if a marker is present, the indexer walks it
/// even though the path would otherwise look like a non-project.
fn looks_like_project(dir: &Path) -> bool {
    const MARKERS: &[&str] = &[
        ".git",
        ".atomcode",
        "Cargo.toml",
        "package.json",
        "pyproject.toml",
        "go.mod",
        "pom.xml",
        "build.gradle",
        "build.gradle.kts",
    ];
    MARKERS.iter().any(|m| dir.join(m).exists())
}

/// Free-function form of the file walk so `tokio::task::spawn_blocking`
/// can own it cleanly (taking only `&Path`, not `&self`).
fn collect_files_sync(project_dir: &Path) -> Vec<(PathBuf, u64)> {
    let mut files = Vec::new();
    let project_dir = project_dir.to_path_buf();

    let walker = WalkBuilder::new(&project_dir)
        .hidden(true)
        .git_ignore(true)
        .filter_entry(move |entry| should_index_entry(entry.path(), &project_dir))
        .build();

    for entry in walker {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = match path.extension().and_then(|e| e.to_str()) {
            Some(e) => e,
            None => continue,
        };

        if !INDEXED_EXTENSIONS.contains(&ext) {
            continue;
        }

        let mtime = match entry.metadata() {
            Ok(meta) => {
                use std::time::UNIX_EPOCH;
                meta.modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0)
            }
            Err(_) => 0,
        };

        files.push((path.to_path_buf(), mtime));
    }

    files
}

fn should_index_entry(path: &Path, project_dir: &Path) -> bool {
    let relative = match path.strip_prefix(project_dir) {
        Ok(relative) => relative,
        Err(_) => return true,
    };

    for component in relative.components() {
        let name = component.as_os_str().to_string_lossy();
        if SKIPPED_DIR_NAMES.iter().any(|dir| *dir == name) {
            return false;
        }
    }

    true
}

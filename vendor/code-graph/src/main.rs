use std::path::PathBuf;
use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

mod graph;
mod semantic;
mod tool;

use graph::indexer::{list_symbols_in_file, GraphIndexer};
use graph::{resolve, CodeGraph};

/// Global graph indexer, lazily initialized.
static INDEXER: once_cell::sync::Lazy<Arc<RwLock<GraphIndexer>>> =
    once_cell::sync::Lazy::new(|| {
        Arc::new(RwLock::new(GraphIndexer::new(
            Arc::new(RwLock::new(CodeGraph::new())),
            PathBuf::from("."),
        )))
    });

// ---------------------------------------------------------------------------
// IPC protocol types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct Command {
    pub cmd: String,
    #[serde(flatten)]
    pub params: CommandParams,
    pub id: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum CommandParams {
    Init { project_dir: String },
    Query { method: String, params: QueryParams },
    IndexFile { path: String },
    Ready {},
    Unknown,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryParams {
    pub file_path: Option<String>,
    pub symbol_id: Option<u64>,
    pub name: Option<String>,
    pub depth: Option<usize>,
    pub to: Option<String>, // for trace_chain
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Response {
    pub id: u64,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl Response {
    fn success(id: u64, result: serde_json::Value) -> Self {
        Self {
            id,
            ok: true,
            result: Some(result),
            error: None,
        }
    }

    fn error(id: u64, msg: &str) -> Self {
        Self {
            id,
            ok: false,
            result: None,
            error: Some(msg.to_string()),
        }
    }
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async fn handle_init(project_dir: String, id: u64) -> Response {
    eprintln!("[code-graph] init project_dir={}", project_dir);

    // Set project directory and perform a full index before replying so the
    // first client request can use the graph immediately.
    let indexer = Arc::clone(&INDEXER);
    {
        let mut indexer_mut = indexer.write();
        indexer_mut.set_project_dir(PathBuf::from(&project_dir));
        indexer_mut.index_all();
    }

    let indexer = INDEXER.read();
    let graph = indexer.graph.read();
    Response::success(
        id,
        serde_json::json!({
            "ready": graph.is_ready(),
            "node_count": graph.node_count(),
            "file_count": graph.file_count(),
        }),
    )
}

async fn handle_query(method: &str, params: &QueryParams, id: u64) -> Response {
    let indexer = INDEXER.read();
    let graph = indexer.graph.read();

    match method {
        "list_symbols" => {
            let file_path = match &params.file_path {
                Some(p) => PathBuf::from(p),
                None => {
                    return Response::error(id, "list_symbols requires file_path");
                }
            };
            let symbols = graph
                .symbols_in_file(&file_path)
                .map(|ids| {
                    ids.iter()
                        .filter_map(|&id| graph.node(id))
                        .map(|n| {
                            serde_json::json!({
                                "id": n.id,
                                "name": n.name,
                                "kind": format!("{:?}", n.kind),
                                "visibility": format!("{:?}", n.visibility),
                                "file": n.file,
                                "start_line": n.start_line,
                                "end_line": n.end_line,
                                "signature": n.signature,
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            Response::success(id, serde_json::json!({ "symbols": symbols }))
        }

        "list_symbols_fast" => {
            let file_path = match &params.file_path {
                Some(p) => PathBuf::from(p),
                None => {
                    return Response::error(id, "list_symbols_fast requires file_path");
                }
            };
            let symbols = list_symbols_in_file(&file_path)
                .into_iter()
                .map(|n| {
                    serde_json::json!({
                        "name": n.name,
                        "kind": format!("{:?}", n.kind),
                        "start_line": n.start_line,
                        "end_line": n.end_line,
                    })
                })
                .collect::<Vec<_>>();

            Response::success(id, serde_json::json!({ "symbols": symbols }))
        }

        "node" => {
            let symbol_id = match params.symbol_id {
                Some(id) => id,
                None => return Response::error(id, "node requires symbol_id"),
            };
            match graph.node(symbol_id) {
                Some(n) => Response::success(
                    id,
                    serde_json::json!({
                        "id": n.id,
                        "name": n.name,
                        "kind": format!("{:?}", n.kind),
                        "visibility": format!("{:?}", n.visibility),
                        "file": n.file,
                        "start_line": n.start_line,
                        "end_line": n.end_line,
                        "signature": n.signature,
                    }),
                ),
                None => Response::error(id, "symbol not found"),
            }
        }

        "find_references" | "find_by_name" => {
            let name = match &params.name {
                Some(n) => n.as_str(),
                None => return Response::error(id, "find_by_name requires name"),
            };
            let file_path = params.file_path.as_deref().unwrap_or("");
            let result = tool::find_references::find_references(&graph, name, file_path);
            let parsed: serde_json::Value =
                serde_json::from_str(&result.output).unwrap_or(serde_json::json!({ "references": [] }));
            Response::success(id, parsed)
        }

        "callers" => {
            let symbol_id = match params.symbol_id {
                Some(id) => id,
                None => return Response::error(id, "callers requires symbol_id"),
            };
            let callers: Vec<serde_json::Value> = graph
                .callers(symbol_id)
                .map(|edges| {
                    edges
                        .iter()
                        .map(|e| {
                            serde_json::json!({
                                "to": e.to,
                                "kind": format!("{:?}", e.kind),
                                "line": e.line,
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            Response::success(id, serde_json::json!({ "callers": callers }))
        }

        "callees" => {
            let symbol_id = match params.symbol_id {
                Some(id) => id,
                None => return Response::error(id, "callees requires symbol_id"),
            };
            let callees: Vec<serde_json::Value> = graph
                .callees(symbol_id)
                .map(|edges| {
                    edges
                        .iter()
                        .map(|e| {
                            serde_json::json!({
                                "to": e.to,
                                "kind": format!("{:?}", e.kind),
                                "line": e.line,
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();
            Response::success(id, serde_json::json!({ "callees": callees }))
        }

        "trace_callers" => {
            let symbol = match &params.name {
                Some(n) => n.as_str(),
                None => return Response::error(id, "trace_callers requires 'symbol' param"),
            };
            let depth = params.depth.unwrap_or(3);
            let candidates = graph.find_by_name(symbol);
            let sym_id = match candidates.first() {
                Some(n) => n.id,
                None => return Response::success(id, serde_json::json!({ "callers": [] })),
            };
            let result: Vec<serde_json::Value> = graph
                .trace_callers(sym_id, depth)
                .iter()
                .filter_map(|(node_id, depth)| {
                    graph.node(*node_id).map(|node| {
                        serde_json::json!({
                            "name": node.name,
                            "kind": format!("{:?}", node.kind),
                            "file": node.file,
                            "line": node.start_line,
                            "depth": depth,
                        })
                    })
                })
                .collect();
            Response::success(id, serde_json::json!({ "callers": result }))
        }

        "trace_callees" => {
            let symbol = match &params.name {
                Some(n) => n.as_str(),
                None => return Response::error(id, "trace_callees requires 'symbol' param"),
            };
            let depth = params.depth.unwrap_or(3);
            let candidates = graph.find_by_name(symbol);
            let sym_id = match candidates.first() {
                Some(n) => n.id,
                None => return Response::success(id, serde_json::json!({ "callees": [] })),
            };
            let result: Vec<serde_json::Value> = graph
                .trace_callees(sym_id, depth)
                .iter()
                .filter_map(|(node_id, depth)| {
                    graph.node(*node_id).map(|node| {
                        serde_json::json!({
                            "name": node.name,
                            "kind": format!("{:?}", node.kind),
                            "file": node.file,
                            "line": node.start_line,
                            "depth": depth,
                        })
                    })
                })
                .collect();
            Response::success(id, serde_json::json!({ "callees": result }))
        }

        "trace_chain" => {
            let from = match &params.name {
                Some(n) => n.as_str(),
                None => return Response::error(id, "trace_chain requires 'from' param"),
            };
            let to = match &params.to {
                Some(t) => t.as_str(),
                None => return Response::error(id, "trace_chain requires 'to' param"),
            };
            let result = tool::trace_chain::trace_chain(&graph, from, to);
            Response::success(id, serde_json::json!({ "output": result.output }))
        }

        "file_deps" => {
            let file_path = match &params.file_path {
                Some(p) => p.as_str(),
                None => return Response::error(id, "file_deps requires file_path"),
            };
            let depth = params.depth.unwrap_or(3);
            let result = tool::file_deps::file_deps(&graph, file_path, depth);
            // Parse the JSON output string back into structured data
            let parsed: serde_json::Value =
                serde_json::from_str(&result.output).unwrap_or(serde_json::Value::Null);
            Response::success(id, parsed)
        }

        "blast_radius" => {
            let file_path = match &params.file_path {
                Some(p) => p.as_str(),
                None => return Response::error(id, "blast_radius requires file_path"),
            };
            let result = tool::blast_radius::blast_radius(&graph, file_path);
            Response::success(id, serde_json::json!({ "output": result.output }))
        }

        "shortest_path" => {
            let from = match params.symbol_id {
                Some(id) => id,
                None => return Response::error(id, "shortest_path requires symbol_id"),
            };
            let to = params
                .name
                .as_ref()
                .and_then(|n| n.parse().ok())
                .or_else(|| params.file_path.as_ref().and_then(|p| p.parse().ok()));
            let to = match to {
                Some(t) => t,
                None => {
                    return Response::error(
                        id,
                        "shortest_path requires 'name' or 'file_path' as second id",
                    )
                }
            };
            match graph.shortest_path(from, to) {
                Some(path) => Response::success(id, serde_json::json!({ "path": path })),
                None => Response::success(id, serde_json::json!({ "path": null })),
            }
        }

        "file_dependents" => {
            let file_path = match &params.file_path {
                Some(p) => PathBuf::from(p),
                None => return Response::error(id, "file_dependents requires file_path"),
            };
            let depth: usize = params
                .name
                .as_ref()
                .and_then(|n| n.parse().ok())
                .unwrap_or(2);
            let deps: Vec<String> = graph
                .file_dependents(&file_path, depth)
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            Response::success(id, serde_json::json!({ "dependents": deps }))
        }

        "resolve_callee" => {
            let callee_name = match &params.name {
                Some(n) => n.as_str(),
                None => return Response::error(id, "resolve_callee requires name"),
            };
            let caller_file = match &params.file_path {
                Some(p) => PathBuf::from(p),
                None => return Response::error(id, "resolve_callee requires file_path"),
            };
            let imported_names: Vec<String> = serde_json::from_value(
                params
                    .symbol_id
                    .map(|_| serde_json::Value::Array(vec![]))
                    .unwrap_or(serde_json::Value::Null),
            )
            .unwrap_or_default();
            match resolve::resolve_callee(&graph, callee_name, &caller_file, &imported_names) {
                Some(id) => Response::success(id, serde_json::json!({ "symbol_id": id })),
                None => Response::success(id, serde_json::json!({ "symbol_id": null })),
            }
        }

        _ => Response::error(id, &format!("unknown query method: {}", method)),
    }
}

async fn handle_index_file(path: &str, id: u64) -> Response {
    eprintln!("[code-graph] index_file path={}", path);

    let path_buf = PathBuf::from(path);
    let indexer = Arc::clone(&INDEXER);
    tokio::spawn(async move {
        let mut indexer = indexer.write();
        indexer.reindex_file(&path_buf);
    });

    Response::success(
        id,
        serde_json::json!({
            "indexed": true,
        }),
    )
}

async fn handle_ready(id: u64) -> Response {
    let indexer = INDEXER.read();
    let graph = indexer.graph.read();
    Response::success(
        id,
        serde_json::json!({
            "ready": graph.is_ready(),
            "node_count": graph.node_count(),
            "file_count": graph.file_count(),
        }),
    )
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() {
    // Unbuffered line buffering for stdout (JSON responses)
    use std::io::{self, Write};
    let mut stdout = io::BufWriter::new(io::stdout());

    loop {
        let mut line = String::new();
        if let Ok(bytes) = io::stdin().read_line(&mut line) {
            if bytes == 0 {
                break; // EOF
            }
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            let cmd: Command = match serde_json::from_str(line) {
                Ok(c) => c,
                Err(e) => {
                    let resp = Response {
                        id: 0,
                        ok: false,
                        result: None,
                        error: Some(format!("parse error: {}", e)),
                    };
                    writeln!(stdout, "{}", serde_json::to_string(&resp).unwrap()).unwrap();
                    stdout.flush().unwrap();
                    continue;
                }
            };

            let resp: Response = match &cmd.params {
                CommandParams::Init { project_dir } => {
                    handle_init(project_dir.clone(), cmd.id).await
                }
                CommandParams::Query { method, params } => {
                    handle_query(method, params, cmd.id).await
                }
                CommandParams::IndexFile { path } => handle_index_file(path, cmd.id).await,
                CommandParams::Ready {} => handle_ready(cmd.id).await,
                CommandParams::Unknown => Response::error(cmd.id, "unknown command"),
            };

            writeln!(stdout, "{}", serde_json::to_string(&resp).unwrap()).unwrap();
            stdout.flush().unwrap();
        }
    }
}

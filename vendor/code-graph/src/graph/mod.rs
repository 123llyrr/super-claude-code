use std::collections::hash_map::DefaultHasher;
use std::collections::{HashMap, HashSet, VecDeque};
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub mod resolve;

pub type SymbolId = u64;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SymbolKind {
    Function,
    Method,
    Struct,
    Class,
    Trait,
    Interface,
    Enum,
    Constant,
    Variable,
    Module,
    Import,
    TypeAlias,
    Other(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Visibility {
    Public,
    Private,
    Protected,
    Internal,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolNode {
    pub id: SymbolId,
    pub name: String,
    pub kind: SymbolKind,
    pub visibility: Visibility,
    pub file: PathBuf,
    pub start_line: usize,
    pub end_line: usize,
    pub signature: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EdgeKind {
    Calls,
    Imports,
    Inherits,
    Implements,
    References,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub to: SymbolId,
    pub kind: EdgeKind,
    pub line: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeGraph {
    pub nodes: HashMap<SymbolId, SymbolNode>,
    pub edges_out: HashMap<SymbolId, Vec<Edge>>,
    pub edges_in: HashMap<SymbolId, Vec<Edge>>,
    pub file_symbols: HashMap<PathBuf, Vec<SymbolId>>,
    pub file_mtimes: HashMap<PathBuf, u64>,
}

impl CodeGraph {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges_out: HashMap::new(),
            edges_in: HashMap::new(),
            file_symbols: HashMap::new(),
            file_mtimes: HashMap::new(),
        }
    }

    pub fn make_id(file: &PathBuf, name: &str, start_line: usize) -> SymbolId {
        let mut hasher = DefaultHasher::new();
        file.hash(&mut hasher);
        name.hash(&mut hasher);
        start_line.hash(&mut hasher);
        hasher.finish()
    }

    pub fn add_symbol(&mut self, node: SymbolNode) {
        let id = node.id;
        let file = node.file.clone();
        self.nodes.insert(id, node);
        self.file_symbols.entry(file).or_default().push(id);
    }

    pub fn add_edge(&mut self, from: SymbolId, edge: Edge) {
        let to = edge.to;
        let kind = edge.kind.clone();
        let line = edge.line;
        self.edges_out.entry(from).or_default().push(edge);
        self.edges_in.entry(to).or_default().push(Edge {
            to: from,
            kind,
            line,
        });
    }

    pub fn node(&self, id: SymbolId) -> Option<&SymbolNode> {
        self.nodes.get(&id)
    }

    pub fn symbols_in_file(&self, file: &PathBuf) -> Option<&Vec<SymbolId>> {
        self.file_symbols.get(file)
    }

    pub fn callees(&self, id: SymbolId) -> Option<&Vec<Edge>> {
        self.edges_out.get(&id)
    }

    pub fn callers(&self, id: SymbolId) -> Option<&Vec<Edge>> {
        self.edges_in.get(&id)
    }

    pub fn remove_file(&mut self, file: &PathBuf) {
        let symbol_ids = match self.file_symbols.remove(file) {
            Some(ids) => ids,
            None => return,
        };
        for &id in &symbol_ids {
            self.nodes.remove(&id);
            if let Some(out_edges) = self.edges_out.remove(&id) {
                for edge in &out_edges {
                    if let Some(in_list) = self.edges_in.get_mut(&edge.to) {
                        in_list.retain(|e| e.to != id);
                        if in_list.is_empty() {
                            self.edges_in.remove(&edge.to);
                        }
                    }
                }
            }
            if let Some(in_edges) = self.edges_in.remove(&id) {
                for edge in &in_edges {
                    if let Some(out_list) = self.edges_out.get_mut(&edge.to) {
                        out_list.retain(|e| e.to != id);
                        if out_list.is_empty() {
                            self.edges_out.remove(&edge.to);
                        }
                    }
                }
            }
        }
        self.file_mtimes.remove(file);
    }

    pub fn find_by_name(&self, name: &str) -> Vec<&SymbolNode> {
        self.nodes.values().filter(|n| n.name == name).collect()
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }

    pub fn file_count(&self) -> usize {
        self.file_symbols.len()
    }

    pub fn is_ready(&self) -> bool {
        !self.nodes.is_empty()
    }

    pub fn trace_callers(&self, id: SymbolId, max_depth: usize) -> Vec<(SymbolId, usize)> {
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        let mut result = Vec::new();
        visited.insert(id);
        queue.push_back((id, 0usize));
        while let Some((current, depth)) = queue.pop_front() {
            if depth >= max_depth {
                continue;
            }
            if let Some(edges) = self.callers(current) {
                for edge in edges {
                    if visited.insert(edge.to) {
                        result.push((edge.to, depth + 1));
                        queue.push_back((edge.to, depth + 1));
                    }
                }
            }
        }
        result
    }

    pub fn trace_callees(&self, id: SymbolId, max_depth: usize) -> Vec<(SymbolId, usize)> {
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        let mut result = Vec::new();
        visited.insert(id);
        queue.push_back((id, 0usize));
        while let Some((current, depth)) = queue.pop_front() {
            if depth >= max_depth {
                continue;
            }
            if let Some(edges) = self.callees(current) {
                for edge in edges {
                    if visited.insert(edge.to) {
                        result.push((edge.to, depth + 1));
                        queue.push_back((edge.to, depth + 1));
                    }
                }
            }
        }
        result
    }

    pub fn shortest_path(&self, from: SymbolId, to: SymbolId) -> Option<Vec<SymbolId>> {
        if from == to {
            return Some(vec![from]);
        }
        let max_hops = 10;
        let mut visited = HashSet::new();
        let mut queue = VecDeque::new();
        let mut parent: HashMap<SymbolId, SymbolId> = HashMap::new();
        visited.insert(from);
        queue.push_back((from, 0usize));
        while let Some((current, depth)) = queue.pop_front() {
            if depth >= max_hops {
                continue;
            }
            if let Some(edges) = self.callees(current) {
                for edge in edges {
                    if visited.insert(edge.to) {
                        parent.insert(edge.to, current);
                        if edge.to == to {
                            let mut path = vec![to];
                            let mut cur = to;
                            while let Some(&p) = parent.get(&cur) {
                                path.push(p);
                                cur = p;
                            }
                            path.reverse();
                            return Some(path);
                        }
                        queue.push_back((edge.to, depth + 1));
                    }
                }
            }
        }
        None
    }

    pub fn file_dependents(&self, file: &Path, max_depth: usize) -> Vec<PathBuf> {
        let file_buf = file.to_path_buf();
        let symbol_ids = match self.file_symbols.get(&file_buf) {
            Some(ids) => ids.clone(),
            None => return Vec::new(),
        };
        let mut dependent_files = HashSet::new();
        for &sym_id in &symbol_ids {
            for (caller_id, _depth) in self.trace_callers(sym_id, max_depth) {
                if let Some(node) = self.node(caller_id) {
                    if node.file != file_buf {
                        dependent_files.insert(node.file.clone());
                    }
                }
            }
        }
        dependent_files.into_iter().collect()
    }
}

impl Default for CodeGraph {
    fn default() -> Self {
        Self::new()
    }
}

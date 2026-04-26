pub mod blast_radius;
pub mod file_deps;
pub mod find_references;
pub mod list_symbols;
pub mod trace_callers;
pub mod trace_callees;
pub mod trace_chain;

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use tokio::sync::RwLock;

use crate::graph::CodeGraph;

/// Tool definition exposed to the agent.
#[derive(Debug, Clone)]
pub struct ToolDef {
    pub name: &'static str,
    pub description: String,
    pub parameters: serde_json::Value,
}

/// The result of a tool execution.
#[derive(Debug, Clone)]
pub struct ToolResult {
    pub call_id: String,
    pub output: String,
    pub success: bool,
}

/// What a tool requires before executing.
#[derive(Debug, Clone)]
pub enum ApprovalRequirement {
    AutoApprove,
    RequireApproval(String),
}

/// Shared execution context passed to every tool invocation.
#[derive(Clone)]
pub struct ToolContext {
    pub graph: Arc<RwLock<CodeGraph>>,
    pub working_dir: Arc<RwLock<PathBuf>>,
}

impl ToolContext {
    pub fn new(graph: CodeGraph) -> Self {
        Self::with_working_dir(graph, PathBuf::from("."))
    }

    pub fn with_working_dir(graph: CodeGraph, working_dir: PathBuf) -> Self {
        Self {
            graph: Arc::new(RwLock::new(graph)),
            working_dir: Arc::new(RwLock::new(working_dir)),
        }
    }
}

#[async_trait]
pub trait Tool: Send + Sync {
    fn definition(&self) -> ToolDef;
    fn approval(&self, args: &str) -> ApprovalRequirement;
    async fn execute(&self, args: &str, ctx: &ToolContext) -> Result<ToolResult>;
}

/// Registry of available tools with stable iteration order.
pub struct ToolRegistry {
    tools: BTreeMap<String, Arc<dyn Tool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: BTreeMap::new(),
        }
    }

    pub fn register(&mut self, tool: Box<dyn Tool>) {
        let name = tool.definition().name.to_string();
        self.tools.insert(name, Arc::from(tool));
    }

    pub fn get_definitions(&self) -> Vec<ToolDef> {
        self.tools.values().map(|t| t.definition()).collect()
    }

    pub fn get(&self, name: &str) -> Option<&dyn Tool> {
        self.tools.get(name).map(|t| t.as_ref())
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

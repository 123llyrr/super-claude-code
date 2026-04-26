export interface SymbolNode {
  id: number;
  name: string;
  kind: 'Function' | 'Method' | 'Struct' | 'Class' | 'Trait' | 'Interface' | 'Enum' | 'Constant' | 'Variable' | 'Module' | 'Import' | 'TypeAlias' | string;
  visibility: 'Public' | 'Private' | 'Protected' | 'Internal' | 'Unknown';
  file: string;
  start_line: number;
  end_line: number;
  signature?: string;
}

export interface Edge {
  to: number;
  kind: 'Calls' | 'Imports' | 'Inherits' | 'Implements' | 'References';
  line: number;
}

export interface ListSymbolsResult {
  symbols: Pick<SymbolNode, 'name' | 'kind' | 'start_line' | 'end_line'>[];
}

export interface FindReferencesResult {
  references: { file: string; line: number; name: string; kind: string; context: string }[];
}

export interface TraceCallersResult {
  callers: { name: string; kind: string; file: string; line: number; depth: number }[];
}

export interface TraceCalleesResult {
  callees: { name: string; kind: string; file: string; line: number; depth: number }[];
}

export interface FileDepsResult {
  direct: string[];
  indirect: string[];
  total: number;
}

export interface BlastRadiusResult {
  output: string; // pre-formatted text
}

export interface TraceChainResult {
  output: string; // pre-formatted text
}

export interface GraphStats {
  ready: boolean;
  node_count: number;
  file_count: number;
}

export interface GraphError {
  error: string;
}

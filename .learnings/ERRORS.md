# Errors

Command failures and integration errors.

---
## [ERR-20260426-001] code-graph-init-timeout

**Logged**: 2026-04-26T22:55:26+08:00
**Priority**: high
**Status**: pending
**Area**: backend

### Summary
Initial code-graph indexing timed out on a large monorepo because the indexer walked generated and duplicate trees and the client left orphan daemon processes behind.

### Error
```
Timeout waiting for init
```

### Context
- Command/operation attempted: project-wide code graph initialization on Super-Claude-Code
- Indexer originally scanned node_modules, vendor/code-graph/target, and .worktrees
- Repeated failed runs left multiple code-graph-daemon processes alive

### Suggested Fix
Skip non-source directories by default, parallelize parsing, and kill the daemon on client timeouts to prevent orphan buildup.

### Metadata
- Reproducible: yes
- Related Files: vendor/code-graph/src/graph/indexer.rs, src/graph/client.ts

---

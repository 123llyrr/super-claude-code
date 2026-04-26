# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260426-001] insight

**Logged**: 2026-04-26T14:00:00Z
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
回复速度变慢，疑似技能系统（self-improvement/skills）加载开销

### Details
用户反馈「回复速度变慢了」。可能原因：
1. 每次工具调用前都执行 Skill 工具检查（约2-3秒 overhead）
2. 记忆系统（MEMORY.md + memory/）文件较大时加载慢
3. Skill 工具本身有初始化开销

### Suggested Action
评估是否可以将技能检查从「每次响应前」改为「首次加载后缓存」
监控 `.learnings/` 文件大小，避免过度膨胀

### Metadata
- Source: user_feedback
- Tags: performance

---

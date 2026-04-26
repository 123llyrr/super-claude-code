import { EventStream } from 'src/utils/EventStream.ts'
import type { QueryEvent, QueryResult } from './events/types.ts'
import { queryOutputToQueryEvents, resetTurnTracking } from './events/transformer.js'
import type { QueryParams } from '../query.js'
import { query as originalQuery } from '../query.js'

/**
 * Execute a query and return an EventStream of typed QueryEvents.
 *
 * Usage:
 *   const stream = queryEvent(params)
 *   for await (const event of stream) {
 *     switch (event.type) {
 *       case 'text_delta':     // text streaming
 *       case 'thinking_delta': // thinking streaming
 *       case 'toolcall_delta': // tool call input streaming
 *       case 'tool_execution_start': // tool began executing
 *       case 'tool_execution_update': // tool progress
 *       case 'tool_execution_end':    // tool finished
 *       case 'turn_start':      // new turn
 *       case 'turn_end':        // turn complete
 *       case 'compact':         // context compaction
 *       case 'retry':           // API retry
 *       case 'agent_end':       // query finished
 *       case 'error':           // error occurred
 *     }
 *   }
 *   const result = await stream.result() // QueryResult
 */
export function queryEvent(params: QueryParams): EventStream<QueryEvent, QueryResult> {
  const stream = new EventStream<QueryEvent, QueryResult>(
    (event): event is QueryEvent => event.type === 'agent_end',
    (event) => {
      if (event.type === 'agent_end') {
        return { type: 'success' as const, messages: event.messages }
      }
      return { type: 'success' as const }
    },
    { maxQueueSize: 1000 },
  )

  // Reset turn tracking for each top-level query
  resetTurnTracking()

  // Run original query in background and transform output to events
  ;(async () => {
    try {
      // Emit agent_start before the first iteration
      stream.push({ type: 'agent_start' })

      for await (const msg of originalQuery(params)) {
        const events = queryOutputToQueryEvents(msg)
        for (const event of events) {
          stream.push(event)
        }
      }
      stream.end()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      stream.push({ type: 'error', code: 'QUERY_ERROR', message: errorMessage })
      stream.endWithError(err, { type: 'error', error: errorMessage })
    }
  })()

  return stream
}

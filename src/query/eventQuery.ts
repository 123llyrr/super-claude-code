import { EventStream } from 'src/utils/EventStream.ts'
import type { QueryEvent, QueryResult } from './events/types.ts'
import { sdkMessageToQueryEvents } from './events/transformer.js'
import type { QueryParams } from '../query.js'
import { query as originalQuery } from '../query.js'

export function queryEvent(params: QueryParams): EventStream<QueryEvent, QueryResult> {
  const stream = new EventStream<QueryEvent, QueryResult>(
    (event): event is QueryEvent => event.type === 'agent_end',
    (event) => {
      if (event.type === 'agent_end') {
        return { type: 'success', messages: event.messages }
      }
      return { type: 'success' }
    }
  )

  // Run original query and transform output
  ;(async () => {
    try {
      for await (const msg of originalQuery(params)) {
        const events = sdkMessageToQueryEvents(msg as any)
        for (const event of events) {
          stream.push(event)
        }
      }
      stream.end()
    } catch (err) {
      stream.push({ type: 'error', code: 'QUERY_ERROR', message: String(err) })
      stream.end({ type: 'error', error: String(err) })
    }
  })()

  return stream
}
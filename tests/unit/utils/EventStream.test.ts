import { describe, it, expect } from 'bun:test'
import { EventStream } from 'src/utils/EventStream.ts'

describe('EventStream', () => {
  it('delivers events to async iterator', async () => {
    const stream = new EventStream<{type: string}, string>(
      e => e.type === 'end',
      e => e.type === 'end' ? 'done' : ''
    )
    stream.push({ type: 'a' })
    stream.push({ type: 'b' })
    stream.push({ type: 'end' })

    const events = []
    for await (const e of stream) events.push(e)
    expect(events).toEqual([{ type: 'a' }, { type: 'b' }, { type: 'end' }])
  })

  it('returns result via result()', async () => {
    const stream = new EventStream<{type: string}, string>(
      e => e.type === 'end',
      () => 'extracted'
    )
    stream.push({ type: 'a' })
    stream.push({ type: 'end' })

    const result = await stream.result()
    expect(result).toBe('extracted')
  })

  it('queues events when no consumer waiting', async () => {
    const stream = new EventStream<number, number>(
      n => n === -1,
      n => n
    )
    stream.push(1)
    stream.push(2)
    stream.push(-1)

    const events = []
    for await (const e of stream) events.push(e)
    expect(events).toEqual([1, 2, -1])
  })

  it('delivers immediately to waiting consumer', async () => {
    const stream = new EventStream<number, number>(
      n => n === -1,
      n => n
    )

    const p = (async () => {
      const events = []
      for await (const e of stream) events.push(e)
      return events
    })()

    stream.push(1)
    stream.push(2)
    stream.push(-1)

    expect(await p).toEqual([1, 2, -1])
  })
})
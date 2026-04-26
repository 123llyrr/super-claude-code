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

    const events: {type: string}[] = []
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

    const events: number[] = []
    for await (const e of stream) events.push(e)
    expect(events).toEqual([1, 2, -1])
  })

  it('delivers immediately to waiting consumer', async () => {
    const stream = new EventStream<number, number>(
      n => n === -1,
      n => n
    )

    const p = (async () => {
      const events: number[] = []
      for await (const e of stream) events.push(e)
      return events
    })()

    stream.push(1)
    stream.push(2)
    stream.push(-1)

    expect(await p).toEqual([1, 2, -1])
  })

  it('delivers terminal event when consumer is waiting', async () => {
    const stream = new EventStream<{type: string}, string>(
      e => e.type === 'terminal',
      e => e.type === 'terminal' ? 'result' : ''
    )

    const p = (async () => {
      const events: {type: string}[] = []
      for await (const e of stream) events.push(e)
      return events
    })()

    stream.push({ type: 'first' })
    stream.push({ type: 'second' })
    stream.push({ type: 'terminal' })

    const events = await p
    expect(events).toHaveLength(3)
    expect(events[0]).toEqual({ type: 'first' })
    expect(events[1]).toEqual({ type: 'second' })
    expect(events[2]).toEqual({ type: 'terminal' })
  })

  it('result() gets final value from terminal event', async () => {
    const stream = new EventStream<{type: string; data?: string}, string>(
      e => e.type === 'terminal',
      e => e.data ?? 'default'
    )

    stream.push({ type: 'a' })
    stream.push({ type: 'terminal', data: 'extracted-from-event' })

    const result = await stream.result()
    expect(result).toBe('extracted-from-event')
  })

  it('end() closes iterator and resolves result', async () => {
    const stream = new EventStream<string, string>(
      () => false,
      () => 'not-used'
    )

    stream.push('a')
    stream.push('b')
    stream.end('manual-end')

    const events: string[] = []
    for await (const e of stream) events.push(e)
    expect(events).toEqual(['a', 'b'])
    expect(await stream.result()).toBe('manual-end')
  })

  it('endWithError sets error and resolves result', async () => {
    const stream = new EventStream<string, string>(
      () => false,
      () => 'not-used'
    )

    stream.push('a')
    stream.endWithError(new Error('something broke'), 'error-result')

    expect(stream.error).toBeInstanceOf(Error)
    expect((stream.error as Error).message).toBe('something broke')
    expect(await stream.result()).toBe('error-result')
  })

  it('subscribe receives events', async () => {
    const stream = new EventStream<string, string>(
      () => false,
      () => 'not-used'
    )

    const received: string[] = []
    stream.subscribe((e) => received.push(e))

    // Give the subscriber a tick to start iterating
    await new Promise(r => setTimeout(r, 10))

    stream.push('hello')
    stream.push('world')
    stream.end('done')

    // Let the subscriber process
    await new Promise(r => setTimeout(r, 20))

    expect(received).toEqual(['hello', 'world'])
  })

  it('subscribe unsubscribe stops receiving events', async () => {
    const stream = new EventStream<string, string>(
      () => false,
      () => 'not-used'
    )

    const received: string[] = []
    const unsub = stream.subscribe((e) => received.push(e))

    await new Promise(r => setTimeout(r, 10))

    stream.push('first')
    // Wait for it to be processed
    await new Promise(r => setTimeout(r, 10))
    unsub()
    stream.push('second')
    stream.end('done')

    expect(received).toContain('first')
    expect(received).not.toContain('second')
  })

  it('multiple subscribers all receive events', async () => {
    const stream = new EventStream<string, string>(
      () => false,
      () => 'not-used'
    )

    const received1: string[] = []
    const received2: string[] = []

    stream.subscribe((e) => received1.push(e))
    stream.subscribe((e) => received2.push(e))

    await new Promise(r => setTimeout(r, 10))

    stream.push('shared')
    stream.end('done')

    await new Promise(r => setTimeout(r, 20))

    expect(received1).toEqual(['shared'])
    expect(received2).toEqual(['shared'])
  })

  it('drops non-terminal events when queue exceeds maxQueueSize', async () => {
    const stream = new EventStream<number, number>(
      n => n === -1,
      n => n,
      { maxQueueSize: 2 },
    )

    stream.push(1) // queue=[1], length=1 < 2
    stream.push(2) // queue=[1,2], length=2 >= 2, but still fits
    stream.push(3) // this one should be dropped (queue already at 2)
    stream.push(-1) // terminal always gets through

    const received: number[] = []
    // Consumer must start AFTER all pushes since we're testing queue behavior
    for await (const e of stream) {
      received.push(e)
    }

    expect(received).toContain(1)
    expect(received).toContain(2)
    expect(received).not.toContain(3)
    expect(received).toContain(-1)
  })
})

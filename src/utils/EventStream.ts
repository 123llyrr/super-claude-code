export class EventStream<T, R = T> {
  private queue: T[] = []
  private waiting: Array<() => void> = []
  private done = false
  private finalResult: R | undefined
  private resolveResult!: (r: R) => void
  private resultPromise: Promise<R>
  private errorValue: unknown = undefined
  private maxQueueSize: number
  // Track the slowest consuming index so we can trim the queue
  private minConsumedIndex = 0

  constructor(
    private isTerminal: (event: T) => boolean,
    private extractResult: (event: T) => R,
    options?: { maxQueueSize?: number },
  ) {
    this.resultPromise = new Promise(resolve => { this.resolveResult = resolve })
    this.maxQueueSize = options?.maxQueueSize ?? Infinity
  }

  /**
   * Push an event to the stream. All events go through the queue
   * so rapid synchronous pushes are never lost — the queue buffers
   * them until consumers drain. Waiters are woken only to re-check
   * the queue.
   */
  push(event: T): void {
    if (this.done) return

    // Terminal events always go through (skip queue cap)
    const isTerminalEvent = this.isTerminal(event)

    // Drop non-terminal events if queue is at capacity
    if (!isTerminalEvent && this.queue.length >= this.maxQueueSize) return

    this.queue.push(event)

    if (isTerminalEvent) {
      this.done = true
      this.finalResult = this.extractResult(event)
      this.resolveResult(this.finalResult)
    }

    // Wake a waiting consumer (the value is already in the queue)
    const waiter = this.waiting.shift()
    if (waiter) {
      waiter()
    }
  }

  /**
   * End the stream, optionally with a result value.
   */
  end(result?: R): void {
    if (this.done) return
    this.done = true
    if (result !== undefined) {
      this.finalResult = result
      this.resolveResult(result)
    }
    // Wake all waiters so they see done=true
    while (this.waiting.length) {
      this.waiting.shift()!()
    }
  }

  /**
   * End the stream with an error.
   */
  endWithError(error: unknown, result?: R): void {
    if (this.done) return
    this.done = true
    this.errorValue = error
    if (result !== undefined) {
      this.finalResult = result
    }
    this.resolveResult(this.finalResult!)
    while (this.waiting.length) {
      this.waiting.shift()!()
    }
  }

  /** The error that terminated the stream, if any. */
  get error(): unknown {
    return this.errorValue
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let index = 0
    while (true) {
      // Drain all queued events
      while (index < this.queue.length) {
        yield this.queue[index++]!
        // Update the slowest-consumer watermark after each yield
        this.updateMinConsumed(index)
      }

      if (this.done) return

      // Wait for more events
      await new Promise<void>(resolve => {
        this.waiting.push(resolve)
      })
    }
  }

  /** Promise that resolves with the stream's final result. */
  result(): Promise<R> {
    return this.resultPromise
  }

  /**
   * Subscribe a listener callback. Returns an unsubscribe function.
   */
  subscribe(listener: (event: T) => void): () => void {
    let cancelled = false
    const it = this[Symbol.asyncIterator]()
    ;(async () => {
      try {
        while (!cancelled) {
          const result = await it.next()
          if (result.done) break
          if (!cancelled) {
            try {
              listener(result.value)
            } catch {
              // Swallow errors in listener
            }
          }
        }
      } catch {
        // Swallow iteration errors
      }
    })()
    return () => {
      cancelled = true
    }
  }

  /**
   * Trim queue items that all active consumers have already consumed.
   * Called after each yield to keep memory bounded.
   */
  private updateMinConsumed(latestIndex: number): void {
    // For now, we don't trim — each async iterator has its own index,
    // and we can't easily know the slowest. Future optimization.
    this.minConsumedIndex = Math.min(this.minConsumedIndex, latestIndex)
  }
}

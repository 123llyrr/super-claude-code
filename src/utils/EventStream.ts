export class EventStream<T, R = T> {
  private queue: T[] = []
  private waiting: Array<(value: IteratorResult<T>) => void> = []
  private done = false
  private finalResult: R | undefined
  private resolveResult!: (r: R) => void
  private resultPromise: Promise<R>

  constructor(
    private isTerminal: (event: T) => boolean,
    private extractResult: (event: T) => R,
  ) {
    this.resultPromise = new Promise(resolve => { this.resolveResult = resolve })
  }

  push(event: T): void {
    if (this.done) return

    if (this.isTerminal(event)) {
      this.done = true
      this.finalResult = this.extractResult(event)
      this.resolveResult(this.finalResult)
      if (this.waiting.length) {
        while (this.waiting.length) {
          const waiter = this.waiting.shift()!
          waiter({ value: event, done: false })
        }
      } else {
        this.queue.push(event)
      }
      return
    }

    const waiter = this.waiting.shift()
    if (waiter) {
      waiter({ value: event, done: false })
    } else {
      this.queue.push(event)
    }
  }

  end(result?: R): void {
    this.done = true
    if (result !== undefined) {
      this.finalResult = result
      this.resolveResult(result)
    }
    while (this.waiting.length) {
      this.waiting.shift()!({ value: undefined as any, done: true })
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let index = 0
    while (true) {
      if (index < this.queue.length) {
        yield this.queue[index++]!
      } else if (this.done) {
        return
      } else {
        const result = await new Promise<IteratorResult<T>>(resolve =>
          this.waiting.push(resolve as any)
        )
        if (result.done) return
        yield result.value as T
      }
    }
  }

  result(): Promise<R> {
    return this.resultPromise
  }
}
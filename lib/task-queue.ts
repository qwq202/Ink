export interface TaskOptions {
  timeoutMs?: number
  signal?: AbortSignal
}

export interface Task<T = unknown> {
  id: string
  name: string
  execute: () => Promise<T>
  status: "pending" | "running" | "completed" | "failed"
  result?: T
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  options?: TaskOptions
}

export class TaskQueue {
  private queue: Task[] = []
  private running: Task[] = []
  private maxConcurrent: number
  private listeners: Set<() => void> = new Set()

  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent
  }

  addTask<T>(name: string, execute: () => Promise<T>, options?: TaskOptions): Task<T> {
    const task: Task<T> = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).substring(7),
      name,
      execute,
      status: "pending",
      createdAt: Date.now(),
      options,
    }

    this.queue.push(task as Task)
    this.notifyListeners()
    this.processQueue()

    return task
  }

  private async processQueue(): Promise<void> {
    while (this.running.length < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()
      if (!task) break

      task.status = "running"
      task.startedAt = Date.now()
      this.running.push(task)
      this.notifyListeners()

      try {
        const { timeoutMs, signal } = task.options || {}

        if (signal?.aborted) {
          throw new Error(signal.reason?.toString() || "Task aborted")
        }

        const result = await this.runWithTimeout(task.execute, timeoutMs, signal)
        task.result = result
        task.status = "completed"
      } catch (error) {
        task.status = "failed"
        task.error = error instanceof Error ? error.message : "Unknown error"
      } finally {
        task.completedAt = Date.now()
        this.running = this.running.filter((t) => t.id !== task.id)
        this.notifyListeners()
        this.processQueue()
      }
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  clear(): void {
    this.queue = []
    this.running = []
    this.notifyListeners()
  }

  private async runWithTimeout<T>(execute: () => Promise<T>, timeoutMs?: number, signal?: AbortSignal): Promise<T> {
    if (!timeoutMs) {
      return execute()
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    if (signal) {
      const abortPromise = new Promise<T>((_, reject) => {
        signal.addEventListener("abort", () => {
          reject(new Error(signal.reason?.toString() || "Task aborted"))
        })
      })
      return Promise.race([execute(), timeoutPromise, abortPromise]).finally(() => clearTimeout(timer))
    }

    return Promise.race([execute(), timeoutPromise]).finally(() => clearTimeout(timer))
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener())
  }

  getStatus() {
    return {
      pending: this.queue.length,
      running: this.running.length,
      tasks: [...this.running, ...this.queue],
    }
  }
}

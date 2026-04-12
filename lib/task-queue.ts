export interface TaskOptions {
  timeoutMs?: number
  signal?: AbortSignal
}

export interface Task<T = unknown> {
  id: string
  name: string
  execute: () => Promise<T>
  status: "pending" | "running" | "completed" | "failed" | "cancelled"
  result?: T
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  options?: TaskOptions
  progress?: number
  retryCount?: number
  estimatedTime?: number
  abortController?: AbortController
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
    const abortController = new AbortController()
    const task: Task<T> = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).substring(7),
      name,
      execute,
      status: "pending",
      createdAt: Date.now(),
      options: { ...options, signal: abortController.signal },
      progress: 0,
      retryCount: 0,
      abortController,
    }

    this.queue.push(task as Task)
    this.notifyListeners()
    if (typeof queueMicrotask === "function") {
      queueMicrotask(() => this.processQueue())
    } else {
      setTimeout(() => this.processQueue(), 0)
    }

    return task
  }

  cancelTask(taskId: string): boolean {
    // Check running tasks
    const runningTask = this.running.find((t) => t.id === taskId)
    if (runningTask) {
      runningTask.abortController?.abort()
      runningTask.status = "cancelled"
      runningTask.error = "Task cancelled by user"
      this.running = this.running.filter((t) => t.id !== taskId)
      this.notifyListeners()
      this.processQueue()
      return true
    }

    // Check pending tasks
    const pendingTask = this.queue.find((t) => t.id === taskId)
    if (pendingTask) {
      pendingTask.status = "cancelled"
      pendingTask.error = "Task cancelled by user"
      this.queue = this.queue.filter((t) => t.id !== taskId)
      this.notifyListeners()
      return true
    }

    return false
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

        // Update progress during execution
        const progressExecute = async () => {
          const result = await task.execute()
          task.progress = 100
          return result
        }

        const result = await this.runWithTimeout(progressExecute, timeoutMs, signal)
        task.result = result
        task.status = "completed"
        task.progress = 100
      } catch (error) {
        if (task.abortController?.signal.aborted) {
          task.status = "cancelled"
          task.error = error instanceof Error ? error.message : "Task cancelled"
        } else {
          task.status = "failed"
          task.error = error instanceof Error ? error.message : "Unknown error"
          // Increment retry count for failed tasks
          task.retryCount = (task.retryCount || 0) + 1
        }
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

  getTask(taskId: string): Task | undefined {
    return [...this.running, ...this.queue].find((t) => t.id === taskId)
  }
}

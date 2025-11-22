"use client"

import { useState, useEffect, useRef } from "react"
import { TaskQueue, type Task, type TaskOptions } from "@/lib/task-queue"

export function useTaskQueue(maxConcurrent = 2) {
  const queueRef = useRef<TaskQueue>()
  const [tasks, setTasks] = useState<Task[]>([])
  const [pending, setPending] = useState(0)
  const [running, setRunning] = useState(0)

  useEffect(() => {
    if (!queueRef.current) {
      queueRef.current = new TaskQueue(maxConcurrent)
    }

    const unsubscribe = queueRef.current.subscribe(() => {
      const status = queueRef.current!.getStatus()
      setTasks(status.tasks)
      setPending(status.pending)
      setRunning(status.running)
    })

    return () => {
      unsubscribe()
      queueRef.current?.clear()
    }
  }, [maxConcurrent])

  const addTask = <T,>(name: string, execute: () => Promise<T>, options?: TaskOptions): Task<T> => {
    if (!queueRef.current) {
      queueRef.current = new TaskQueue(maxConcurrent)
    }
    return queueRef.current.addTask(name, execute, options)
  }

  const cancelTask = (taskId: string): boolean => {
    if (!queueRef.current) {
      return false
    }
    return queueRef.current.cancelTask(taskId)
  }

  const getTask = (taskId: string): Task | undefined => {
    if (!queueRef.current) {
      return undefined
    }
    return queueRef.current.getTask(taskId)
  }

  return {
    addTask,
    cancelTask,
    getTask,
    tasks,
    pending,
    running,
  }
}

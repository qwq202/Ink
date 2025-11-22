"use client"

import React, { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { X, Clock, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import type { Task } from "@/lib/task-queue"
import { cn } from "@/lib/utils"

interface TaskStatusPanelProps {
  tasks: Task[]
  onCancel: (taskId: string) => void
  className?: string
}

export function TaskStatusPanel({ tasks, onCancel, className }: TaskStatusPanelProps) {
  const [cancelTaskId, setCancelTaskId] = useState<string | null>(null)

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {
      running: [],
      pending: [],
      completed: [],
      failed: [],
      cancelled: [],
    }

    tasks.forEach((task) => {
      if (task.status === "running") {
        groups.running.push(task)
      } else if (task.status === "pending") {
        groups.pending.push(task)
      } else if (task.status === "completed") {
        groups.completed.push(task)
      } else if (task.status === "failed") {
        groups.failed.push(task)
      } else if (task.status === "cancelled") {
        groups.cancelled.push(task)
      }
    })

    return groups
  }, [tasks])

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const getEstimatedTime = (task: Task) => {
    if (task.status === "completed" && task.startedAt && task.completedAt) {
      return formatTime(task.completedAt - task.startedAt)
    }
    if (task.status === "running" && task.startedAt) {
      const elapsed = Date.now() - task.startedAt
      const estimated = task.estimatedTime || 30000 // Default 30s
      return `预计剩余 ${formatTime(Math.max(0, estimated - elapsed))}`
    }
    return null
  }

  const TaskItem = ({ task }: { task: Task }) => {
    const statusConfig = {
      running: { icon: Loader2, color: "text-blue-500", bg: "bg-blue-50", label: "生成中" },
      pending: { icon: Clock, color: "text-gray-500", bg: "bg-gray-50", label: "排队中" },
      completed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50", label: "已完成" },
      failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-50", label: "失败" },
      cancelled: { icon: XCircle, color: "text-gray-400", bg: "bg-gray-50", label: "已取消" },
    }

    const config = statusConfig[task.status] || statusConfig.pending
    const Icon = config.icon
    const canCancel = task.status === "running" || task.status === "pending"
    const showRetry = task.status === "failed" && (task.retryCount || 0) > 0

    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-lg border", config.bg)}>
        <Icon className={cn("h-5 w-5", config.color, task.status === "running" && "animate-spin")} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-gray-900 truncate">{task.name}</p>
            <Badge variant="outline" className="text-xs">
              {config.label}
            </Badge>
            {showRetry && (
              <Badge variant="outline" className="text-xs text-orange-600">
                第 {task.retryCount} 次重试
              </Badge>
            )}
          </div>
          {task.status === "running" && (
            <div className="space-y-1">
              <Progress value={task.progress || 0} className="h-1.5" />
              <p className="text-xs text-gray-500">{getEstimatedTime(task)}</p>
            </div>
          )}
          {task.status === "failed" && task.error && (
            <p className="text-xs text-red-600 mt-1 truncate" title={task.error}>
              {task.error}
            </p>
          )}
          {task.status === "completed" && task.startedAt && task.completedAt && (
            <p className="text-xs text-gray-500 mt-1">耗时: {formatTime(task.completedAt - task.startedAt)}</p>
          )}
        </div>
        {canCancel && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setCancelTaskId(task.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  const hasActiveTasks = groupedTasks.running.length > 0 || groupedTasks.pending.length > 0

  if (tasks.length === 0) {
    return null
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">任务状态</CardTitle>
            {hasActiveTasks && (
              <Badge variant="outline" className="text-xs">
                {groupedTasks.running.length} 运行中 / {groupedTasks.pending.length} 排队中
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {groupedTasks.running.length > 0 && (
            <div className="space-y-2">
              {groupedTasks.running.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
          {groupedTasks.pending.length > 0 && (
            <div className="space-y-2">
              {groupedTasks.pending.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
          {groupedTasks.completed.length > 0 && groupedTasks.completed.length <= 3 && (
            <div className="space-y-2">
              {groupedTasks.completed.slice(0, 3).map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
          {groupedTasks.failed.length > 0 && (
            <div className="space-y-2">
              {groupedTasks.failed.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={cancelTaskId !== null} onOpenChange={(open) => !open && setCancelTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>取消任务</AlertDialogTitle>
            <AlertDialogDescription>
              确定要取消这个任务吗？取消后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>保留</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelTaskId) {
                  onCancel(cancelTaskId)
                  setCancelTaskId(null)
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              取消任务
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}


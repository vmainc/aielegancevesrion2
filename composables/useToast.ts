export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

export const useToast = () => {
  // Move useState inside the function so it's only called in setup context
  const toasts = useState<Toast[]>('toasts', () => [])

  const removeToast = (id: string) => {
    const index = toasts.value.findIndex(toast => toast.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  const showToast = (message: string, type: ToastType = 'info', duration: number = 5000) => {
    const id = Math.random().toString(36).substring(2, 9)
    const toast: Toast = {
      id,
      message,
      type,
      duration
    }

    toasts.value.push(toast)

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  const success = (message: string, duration?: number) => {
    return showToast(message, 'success', duration)
  }

  const error = (message: string, duration?: number) => {
    return showToast(message, 'error', duration)
  }

  const info = (message: string, duration?: number) => {
    return showToast(message, 'info', duration)
  }

  const warning = (message: string, duration?: number) => {
    return showToast(message, 'warning', duration)
  }

  return {
    toasts: readonly(toasts),
    showToast,
    removeToast,
    success,
    error,
    info,
    warning
  }
}


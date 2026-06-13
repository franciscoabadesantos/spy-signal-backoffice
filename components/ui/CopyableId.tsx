'use client'

import { useState } from 'react'
import { truncateId } from '@/lib/format'

interface Props {
  id: string
  maxLen?: number
  className?: string
}

export function CopyableId({ id, maxLen = 12, className }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!id) return
    void navigator.clipboard.writeText(id)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      className={`copyable-id ${className ?? ''}`}
      title={id}
      onClick={handleCopy}
    >
      {truncateId(id, maxLen)}
      {copied && <span className="copyable-id-check">✓</span>}
    </button>
  )
}

"use client"

import React, { useCallback, useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Bold, Italic, Strikethrough, List, ListOrdered, Link, Code, Paperclip, AtSign, Send, X, Image as ImageIcon, FileText, Smile, Type, TypeIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface RichMessageEditorRef {
    focus: () => void
}

interface RichMessageEditorProps {
    value?: string // html
    placeholder?: string
    disabled?: boolean
    maxLength?: number
    onChange?: (html: string, text: string) => void
    onTyping?: () => void
    onStopTyping?: () => void
    // Called when editor requests a send. Should resolve true on success.
    onSend?: (html: string, text: string, files: File[]) => Promise<boolean>
    className?: string
}

const RichMessageEditor = forwardRef<RichMessageEditorRef, RichMessageEditorProps>(
    ({ value = "", placeholder = "Type a message...", disabled = false, maxLength = 5000, onChange, onTyping, onStopTyping, onSend, className }, ref) => {
        const contentRef = useRef<HTMLDivElement | null>(null)
        const textareaRef = useRef<HTMLTextAreaElement | null>(null)
        const fileInputRef = useRef<HTMLInputElement | null>(null)
        const typingTimerRef = useRef<number | null>(null)

        const [isFocused, setIsFocused] = useState(false)
        const [attachments, setAttachments] = useState<File[]>([])
        const [showToolbar, setShowToolbar] = useState(true)

        const [users, setUsers] = useState<Array<{ id: string; name: string; email?: string }>>([])
        const [showSuggestions, setShowSuggestions] = useState(false)
        const [mentionQuery, setMentionQuery] = useState("")
        const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string }>>([])

        const [showEmojiPicker, setShowEmojiPicker] = useState(false)
        const emojiPickerRef = useRef<HTMLDivElement | null>(null)
        const EMOJIS = ['😀', '😄', '😊', '😂', '👍', '🎉', '🔥', '❤️', '😮', '😢', '🤝', '🙌', '😎', '🤔']

        // Keep internal content synced with value prop
        useEffect(() => {
            if (contentRef.current && value !== contentRef.current.innerHTML) {
                contentRef.current.innerHTML = value || ""
            }
        }, [value])

        useImperativeHandle(ref, () => ({
            focus: () => {
                contentRef.current?.focus()
            }
        }))

        const triggerTyping = useCallback(() => {
            if (disabled) return
            if (onTyping) onTyping()
            if (typingTimerRef.current) {
                window.clearTimeout(typingTimerRef.current)
            }
            typingTimerRef.current = window.setTimeout(() => {
                if (onStopTyping) onStopTyping()
                typingTimerRef.current = null
            }, 2000)
        }, [disabled, onTyping, onStopTyping])

        // Fetch simple user list for mentions (best-effort)
        useEffect(() => {
            let mounted = true
                ; (async () => {
                    try {
                        const res = await fetch('/api/users?limit=50')
                        const data = await res.json()
                        if (!mounted) return
                        if (Array.isArray(data)) {
                            setUsers(data.map((u: any) => ({ id: u._id || u.id || u.id_str || u.id, name: u.name || u.username || u.email })))
                        } else if (data?.users) {
                            setUsers(data.users.map((u: any) => ({ id: u._id || u.id || u.id_str || u.id, name: u.name || u.username || u.email })))
                        }
                    } catch (e) {
                        // ignore
                    }
                })()
            return () => { mounted = false }
        }, [])

        const handleInput = useCallback(() => {
            const el = contentRef.current
            if (!el) return
            let text = el.innerText || ""

            if (maxLength && text.length > maxLength) {
                // trim to max length
                text = text.slice(0, maxLength)
                el.innerText = text
            }

            const html = el.innerHTML
            onChange?.(html, text)
            triggerTyping()

            // mention detection (last token starting with @)
            const m = text.match(/@([\w-]*)$/)
            if (m) {
                setMentionQuery(m[1])
                setShowSuggestions(true)
                const q = m[1].toLowerCase()
                setSuggestions(users.filter(u => u.name.toLowerCase().includes(q)).slice(0, 6))
            } else {
                setShowSuggestions(false)
                setMentionQuery("")
            }
        }, [maxLength, onChange, triggerTyping, users])

        const exec = useCallback((cmd: string, value?: string) => {
            if (disabled) return
            contentRef.current?.focus()
            document.execCommand(cmd, false, value)
            handleInput()
            contentRef.current?.focus()
        }, [disabled, handleInput])

        const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                // send
                const html = contentRef.current?.innerHTML || ""
                const text = contentRef.current?.innerText || ""
                const success = await onSend?.(html, text, attachments)
                if (success) {
                    // clear
                    if (contentRef.current) contentRef.current.innerHTML = ""
                    setAttachments([])
                    setShowSuggestions(false)
                }
                return
            }

            // For shift+enter let default happen (inserting line break)

            // Update suggestion query when typing in
            setTimeout(() => {
                const t = contentRef.current?.innerText || ""
                const m = t.match(/@([\w-]*)$/)
                if (m) {
                    setMentionQuery(m[1])
                    setShowSuggestions(true)
                    const q = m[1].toLowerCase()
                    setSuggestions(users.filter(u => u.name.toLowerCase().includes(q)).slice(0, 6))
                }
            }, 0)
        }, [onSend, attachments, users])

        const handlePaste = useCallback((e: React.ClipboardEvent) => {
            const el = contentRef.current
            if (!el) return
            e.preventDefault()
            const text = e.clipboardData.getData('text/plain')
            // sanitize basic
            const sanitized = text.replace(/</g, "&lt;").replace(/>/g, "&gt;")
            document.execCommand('insertHTML', false, sanitized)
            handleInput()
        }, [handleInput])

        const { toast } = (function safeRequire() {
            try {
                // dynamic require to avoid SSR issues
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                return require('@/hooks/use-toast').useToast()
            } catch (e) {
                return { toast: () => { } }
            }
        })()

        const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(e.target.files || [])
            const validFiles: File[] = []
            for (const file of files) {
                if (file.size > 10 * 1024 * 1024) {
                    try { toast({ title: 'File too large', description: `${file.name} is larger than 10MB`, variant: 'destructive' }) } catch (e) { }
                    continue
                }
                validFiles.push(file)
            }

            if (attachments.length + validFiles.length > 5) {
                try { toast({ title: 'Too many files', description: 'You can only attach up to 5 files', variant: 'destructive' }) } catch (e) { }
                // trim
                const remain = 5 - attachments.length
                setAttachments(prev => [...prev, ...validFiles].slice(0, remain))
            } else {
                setAttachments(prev => [...prev, ...validFiles])
            }

            if (e.target) e.target.value = ''
        }, [attachments, toast])

        const removeAttachment = useCallback((index: number) => {
            setAttachments(prev => prev.filter((_, i) => i !== index))
        }, [])

        const insertMentionAtCaret = useCallback((name: string) => {
            const el = contentRef.current
            if (!el) return

            // replace last @query with @name
            const text = el.innerText || ''
            const newText = text.replace(/@[^@\s]*$/, '@' + name + ' ')
            el.innerText = newText
            handleInput()
            el.focus()

            setShowSuggestions(false)
        }, [handleInput])

        // Emoji insertion
        const insertEmoji = useCallback((emoji: string) => {
            if (disabled) return
            contentRef.current?.focus()
            try {
                // insert at caret
                document.execCommand('insertText', false, emoji)
            } catch (e) {
                // fallback
                const el = contentRef.current
                if (!el) return
                el.innerText = (el.innerText || '') + emoji
            }
            handleInput()
            setShowEmojiPicker(false)
        }, [disabled, handleInput])

        // Close emoji picker on outside click
        useEffect(() => {
            const onDocClick = (e: MouseEvent) => {
                if (!showEmojiPicker) return
                const target = e.target as Node
                if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
                    setShowEmojiPicker(false)
                }
            }
            document.addEventListener('click', onDocClick)
            return () => document.removeEventListener('click', onDocClick)
        }, [showEmojiPicker])

        const openMentionSuggestions = useCallback(() => {
            setShowSuggestions(true)
            setMentionQuery('')
            setSuggestions(users.slice(0, 6))
            contentRef.current?.focus()
        }, [users])

        const addLink = useCallback(() => {
            const url = window.prompt("Enter URL")
            if (!url) return
            exec('createLink', url)
        }, [exec])

        return (
            <div className={cn("rich-message-editor border rounded-md bg-background", className)}>

                {/* topbar for text editing options */}
                {showToolbar && (
                    <div className="flex items-center gap-1 border-b p-2 bg-card">
                        <Button variant="ghost" size="sm" onClick={() => exec('bold')} title="Bold">
                            <Bold className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => exec('italic')} title="Italic">
                            <Italic className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => exec('strikeThrough')} title="Strikethrough">
                            <Strikethrough className="h-4 w-4" />
                        </Button>

                        <div className="mx-1" />
                        <Button variant="ghost" size="sm" onClick={() => exec('insertUnorderedList')} title="Bullet list">
                            <List className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => exec('insertOrderedList')} title="Numbered list">
                            <ListOrdered className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="sm" onClick={addLink} title="Add link">
                            <Link className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => exec('insertHTML', '<code></code>')} title="Inline code">
                            <Code className="h-4 w-4" />
                        </Button>




                    </div>
                )}

                {/* Attachment previews */}
                {attachments.length > 0 && (
                    <div className="p-2 flex flex-wrap gap-2 border-b">
                        {attachments.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-2 py-1 border rounded bg-muted/30">
                                {file.type.startsWith('image/') ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                <span className="text-xs max-w-[160px] truncate">{file.name}</span>
                                <Button variant="ghost" size="sm" onClick={() => removeAttachment(idx)}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Editor */}
                <div className="relative">
                    <div
                        ref={contentRef}
                        contentEditable={!disabled}
                        suppressContentEditableWarning
                        onInput={handleInput}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        className={cn(
                            "min-h-[44px] max-h-40 overflow-y-auto p-3 outline-none prose prose-sm bg-background rounded-b-md",
                            disabled && 'opacity-50 cursor-not-allowed'
                        )}
                        role="textbox"
                        aria-multiline="true"
                    />

                    {/* Placeholder overlay when empty and not focused */}
                    {(!isFocused && !(contentRef.current?.innerText || '').trim()) && (
                        <div className="pointer-events-none absolute top-3 left-3 text-muted-foreground text-sm">
                            {placeholder}
                        </div>
                    )}

                    {/* Mention suggestions dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute z-40 left-2 top-full mt-1 w-56 bg-card border rounded shadow">
                            {suggestions.map(s => (
                                <div
                                    key={s.id}
                                    className="px-3 py-2 hover:bg-accent/10 cursor-pointer"
                                    onMouseDown={(e) => { e.preventDefault(); insertMentionAtCaret(s.name) }}
                                >
                                    {s.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/5">
                    <div className="flex items-center">
                        {/* Attach file */}
                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.txt,.zip" />
                        <button
                            className="border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150"
                            onClick={() => fileInputRef.current?.click()}
                            title="Attach file"
                        >
                            <Paperclip className="h-5 w-5" />
                        </button>
                        <button
                            className="border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150" onClick={() => setShowToolbar(p => !p)} title="Toggle formatting">
                            <TypeIcon className="h-5 w-5" />
                        </button>
                        {/* Mention button */}
                        <button className="border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150" onClick={openMentionSuggestions} title="Mention someone">
                            <AtSign className="h-5 w-5" />
                        </button>
                        {/* Emoji picker (bottom) */}
                        <div className="relative" ref={emojiPickerRef}>
                            <button className="border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150" onClick={() => setShowEmojiPicker(s => !s)} title="Add emoji">
                                <Smile className="h-5 w-5" />
                            </button>

                            {showEmojiPicker && (
                                <div className="absolute bottom-full mb-2 left-0 w-44 p-2 bg-card border rounded shadow grid grid-cols-6 gap-1">
                                    {EMOJIS.map(e => (
                                        <button
                                            key={e}
                                            className="p-1 text-lg hover:bg-accent/10 rounded"
                                            onMouseDown={(evt) => { evt.preventDefault(); insertEmoji(e) }}
                                            aria-label={`Insert ${e}`}
                                        >
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <div>
                            {(contentRef.current?.innerText || '').length}/{maxLength}
                        </div>
                        {/* Send button inside editor */}
                        <button
                            className="border-0 p-2 transition-colors duration-150 hover:text-primary [&>svg]:transition-all [&>svg]:duration-150 hover:[&>svg]:rotate-45 hover:[&>svg]:text-primary hover:[&>svg]:scale-110"
                            onClick={async () => {
                                const html = contentRef.current?.innerHTML || ''
                                const text = contentRef.current?.innerText || ''
                                const success = await onSend?.(html, text, attachments)
                                if (success) {
                                    if (contentRef.current) contentRef.current.innerHTML = ''
                                    setAttachments([])
                                    setShowSuggestions(false)
                                }
                            }} title="Send message">
                            <Send className="h-5 w-5 text-primary" />
                        </button>
                    </div>
                </div>
            </div>
        )
    }
)

RichMessageEditor.displayName = 'RichMessageEditor'

export default RichMessageEditor

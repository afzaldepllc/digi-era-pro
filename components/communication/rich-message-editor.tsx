"use client"

import React, { useCallback, useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Bold, Italic, Strikethrough, List, ListOrdered, Link, Code, Paperclip, AtSign, Send, X, Image as ImageIcon, FileText, Smile, Type, TypeIcon, Quote } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEditor, EditorContent } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import BoldExt from '@tiptap/extension-bold'
import ItalicExt from '@tiptap/extension-italic'
import StrikeExt from '@tiptap/extension-strike'
import Heading from '@tiptap/extension-heading'
import Blockquote from '@tiptap/extension-blockquote'
import CodeBlock from '@tiptap/extension-code-block'
import History from '@tiptap/extension-history'
import LinkExt from '@tiptap/extension-link'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'

import HardBreak from '@tiptap/extension-hard-break'

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

        const editor = useEditor({
            extensions: [
                Document,
                Paragraph,
                Text,
                BoldExt,
                ItalicExt,
                StrikeExt,
                Heading.configure({ levels: [1, 2, 3] }),
                Blockquote,
                CodeBlock,
                ListItem,
                BulletList.configure({
                    HTMLAttributes: {
                        class: 'bullet-list',
                    },
                }),
                OrderedList.configure({
                    HTMLAttributes: {
                        class: 'ordered-list',
                    },
                }),
                LinkExt.configure({ openOnClick: false }),
                History,
                HardBreak.configure({ keepMarks: true }),
            ],
            content: value || '',
            editable: !disabled,
            immediatelyRender: false, // Fix SSR issue
            onUpdate: ({ editor }) => {
                const html = editor.getHTML()
                const text = editor.getText()
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
            },
        })

        // Update editor content when value prop changes
        useEffect(() => {
            if (editor && value !== editor.getHTML()) {
                editor.commands.setContent(value || '')
            }
        }, [editor, value])

        useImperativeHandle(ref, () => ({
            focus: () => {
                editor?.commands.focus()
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

        const addLink = useCallback(() => {
            const url = window.prompt("Enter URL")
            if (!url) return
            editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }, [editor])

        const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
                // If in a list, allow default behavior (create new list item)
                if (editor?.isActive('bulletList') || editor?.isActive('orderedList')) {
                    return;
                }
                e.preventDefault()
                // send plain text
                const text = editor?.getText() || ""
                const success = await onSend?.("", text, attachments)
                if (success) {
                    // clear
                    editor?.commands.setContent('')
                    setAttachments([])
                    setShowSuggestions(false)
                }
                return
            }
        }, [editor, onSend, attachments])

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
            editor?.commands.insertContent('@' + name + ' ')
            setShowSuggestions(false)
        }, [editor])

        // Emoji insertion
        const insertEmoji = useCallback((emoji: string) => {
            if (disabled) return
            editor?.commands.insertContent(emoji)
            setShowEmojiPicker(false)
        }, [disabled, editor])

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
            editor?.commands.focus()
        }, [users, editor])

        return (
            <div className={cn("rich-message-editor border rounded-md bg-background", className)}>

                {/* topbar for text editing options */}
                {showToolbar && (
                    <div className="flex items-center gap-1 border-b p-2 bg-card">
                        <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleBold().run()} className={editor?.isActive('bold') ? 'bg-accent' : ''} title="Bold">
                            <Bold className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleItalic().run()} className={editor?.isActive('italic') ? 'bg-accent' : ''} title="Italic">
                            <Italic className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleStrike().run()} className={editor?.isActive('strike') ? 'bg-accent' : ''} title="Strikethrough">
                            <Strikethrough className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={editor?.isActive('bulletList') ? 'bg-accent' : ''} title="Bullet list">
                            <List className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={editor?.isActive('orderedList') ? 'bg-accent' : ''} title="Numbered list">
                            <ListOrdered className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="sm" onClick={addLink} className={editor?.isActive('link') ? 'bg-accent' : ''} title="Add link">
                            <Link className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleCodeBlock().run()} className={editor?.isActive('codeBlock') ? 'bg-accent' : ''} title="Code block">
                            <Code className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="sm" onClick={() => editor?.chain().focus().toggleBlockquote().run()} className={editor?.isActive('blockquote') ? 'bg-accent' : ''} title="Blockquote">
                            <Quote className="h-4 w-4" />
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
                    <EditorContent
                        editor={editor}
                        data-placeholder={placeholder}
                        onKeyDown={handleKeyDown}
                        className={cn(
                            "min-h-[44px] max-h-40 overflow-y-auto p-3 outline-none prose prose-sm bg-background rounded-b-md",
                            "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[44px]",
                            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
                            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground",
                            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
                            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
                            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
                            // List styling
                            "[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-6 [&_.ProseMirror_ul]:my-2",
                            "[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-6 [&_.ProseMirror_ol]:my-2",
                            "[&_.ProseMirror_li]:my-1",
                            "[&_.ProseMirror_ul_ul]:list-[circle] [&_.ProseMirror_ul_ul_ul]:list-[square]",
                            "[&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-border [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:ml-0 [&_.ProseMirror_blockquote]:italic",
                            "[&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:rounded [&_.ProseMirror_pre]:overflow-x-auto",
                            "[&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:text-sm",
                            disabled && 'opacity-50 cursor-not-allowed'
                        )}
                    />

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
                            {(editor?.getText() || '').length}/{maxLength}
                        </div>
                        {/* Send button inside editor */}
                        <button
                            className="border-0 p-2 transition-colors duration-150 hover:text-primary [&>svg]:transition-all [&>svg]:duration-150 hover:[&>svg]:rotate-45 hover:[&>svg]:text-primary hover:[&>svg]:scale-110"
                            onClick={async () => {
                                const html = editor?.getHTML() || ''
                                const text = editor?.getText() || ''
                                const success = await onSend?.(html, text, attachments)
                                if (success) {
                                    editor?.commands.setContent('')
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

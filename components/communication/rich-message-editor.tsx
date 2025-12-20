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
            if (!editor) return
            
            // Get editor state for analysis
            const { state } = editor.view
            const { $from, empty: isSelectionEmpty } = state.selection
            const currentNode = $from.parent
            const isInBulletList = editor.isActive('bulletList')
            const isInOrderedList = editor.isActive('orderedList')
            const isInList = isInBulletList || isInOrderedList
            
            // Check if we're in a list item by traversing up the node hierarchy
            // The cursor is usually in a paragraph inside a listItem, not directly in listItem
            let isInListItem = false
            let listItemDepth = -1
            for (let d = $from.depth; d > 0; d--) {
                if ($from.node(d).type.name === 'listItem') {
                    isInListItem = true
                    listItemDepth = d
                    break
                }
            }
            
            const isAtStart = $from.parentOffset === 0
            const isEmptyNode = currentNode.textContent.trim() === ''
            
            // Check if entire list item content is empty (not just current paragraph)
            let isListItemEmpty = false
            if (isInListItem && listItemDepth > 0) {
                const listItemNode = $from.node(listItemDepth)
                isListItemEmpty = listItemNode.textContent.trim() === ''
            }
            
            // ==================== ENTER KEY (WITHOUT SHIFT) ====================
            // Send message - primary action
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                const text = editor.getText() || ""
                const html = editor.getHTML() || ""
                const success = await onSend?.(html, text, attachments)
                if (success) {
                    editor.commands.setContent('')
                    setAttachments([])
                    setShowSuggestions(false)
                }
                return
            }
            
            // ==================== SHIFT+ENTER ====================
            // New line or new list item
            if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault()
                
                if (isInList && isInListItem) {
                    // In a list item
                    if (isListItemEmpty) {
                        // Empty list item - exit the list
                        editor.chain()
                            .focus()
                            .liftListItem('listItem')
                            .run()
                    } else {
                        // Non-empty list item - create a new list item in the same list
                        editor.chain()
                            .focus()
                            .splitListItem('listItem')
                            .run()
                    }
                } else {
                    // Not in a list - insert line break
                    editor.chain()
                        .focus()
                        .setHardBreak()
                        .run()
                }
                return
            }
            
            // ==================== BACKSPACE KEY ====================
            if (e.key === "Backspace") {
                // Only handle when cursor (no text selection)
                if (!isSelectionEmpty) {
                    return // Let default handle text selection deletion
                }
                
                if (isInList && isInListItem && isAtStart && listItemDepth > 0) {
                    const listNode = $from.node(listItemDepth - 1)
                    const listItemIndex = $from.index(listItemDepth - 1)
                    const totalListItems = listNode.childCount
                    
                    if (isListItemEmpty) {
                        e.preventDefault()
                        
                        if (totalListItems === 1) {
                            // Only one empty item in list - remove entire list and create paragraph
                            editor.chain()
                                .focus()
                                .liftListItem('listItem')
                                .run()
                        } else if (listItemIndex === totalListItems - 1) {
                            // Last item in list and it's empty - delete this item and position after list
                            // Use deleteNode to remove just this list item
                            const listItemPos = $from.before(listItemDepth)
                            editor.chain()
                                .focus()
                                .command(({ tr, dispatch }) => {
                                    if (dispatch) {
                                        const listItemNode = $from.node(listItemDepth)
                                        tr.delete(listItemPos, listItemPos + listItemNode.nodeSize)
                                    }
                                    return true
                                })
                                .run()
                        } else if (listItemIndex === 0) {
                            // First item but there are more items - just lift this item out
                            editor.chain()
                                .focus()
                                .liftListItem('listItem')
                                .run()
                        } else {
                            // Middle empty item - delete it and stay in list
                            const listItemPos = $from.before(listItemDepth)
                            editor.chain()
                                .focus()
                                .command(({ tr, dispatch }) => {
                                    if (dispatch) {
                                        const listItemNode = $from.node(listItemDepth)
                                        tr.delete(listItemPos, listItemPos + listItemNode.nodeSize)
                                    }
                                    return true
                                })
                                .run()
                        }
                    } else if (listItemIndex === 0) {
                        // First item with content - lift it out of list
                        e.preventDefault()
                        editor.chain()
                            .focus()
                            .liftListItem('listItem')
                            .run()
                    }
                    // Otherwise let default behavior merge with previous item
                }
                return
            }
            
            // ==================== TAB KEY ====================
            // Indent/outdent list items
            if (e.key === "Tab" && isInList && isInListItem) {
                e.preventDefault()
                if (e.shiftKey) {
                    // Shift+Tab - decrease indent (lift)
                    editor.chain().focus().liftListItem('listItem').run()
                } else {
                    // Tab - increase indent (sink)
                    editor.chain().focus().sinkListItem('listItem').run()
                }
                return
            }
        }, [editor, onSend, attachments])
        
        // Enhanced list toggle handlers that handle list type switching properly
        const toggleBulletList = useCallback(() => {
            if (!editor) return
            
            // If currently in an ordered list, convert to bullet list (not exit and create new)
            if (editor.isActive('orderedList')) {
                // First toggle off ordered list, then toggle on bullet list
                // This converts the list in place
                editor.chain()
                    .focus()
                    .toggleOrderedList()
                    .toggleBulletList()
                    .run()
            } else {
                // Just toggle bullet list normally (turn on or off)
                editor.chain().focus().toggleBulletList().run()
            }
        }, [editor])
        
        const toggleOrderedList = useCallback(() => {
            if (!editor) return
            
            // If currently in a bullet list, convert to ordered list (not exit and create new)
            if (editor.isActive('bulletList')) {
                // First toggle off bullet list, then toggle on ordered list
                // This converts the list in place
                editor.chain()
                    .focus()
                    .toggleBulletList()
                    .toggleOrderedList()
                    .run()
            } else {
                // Just toggle ordered list normally (turn on or off)
                editor.chain().focus().toggleOrderedList().run()
            }
        }, [editor])

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
                    <div className="flex items-center gap-1 border-b p-1 bg-card">
                        <button onClick={() => editor?.chain().focus().toggleBold().run()} className={`${editor?.isActive('bold') ? 'bg-accent' : ''} border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150`} title="Bold">
                            <Bold className="h-4 w-4" />
                        </button>
                        <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={`${editor?.isActive('italic') ? 'bg-accent' : ''} border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150`} title="Italic">
                            <Italic className="h-4 w-4" />
                        </button>
                        <button onClick={() => editor?.chain().focus().toggleStrike().run()} className={`${editor?.isActive('strike') ? 'bg-accent' : ''} border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150`} title="Strikethrough">
                            <Strikethrough className="h-4 w-4" />
                        </button>

                        <button onClick={toggleBulletList} className={`${editor?.isActive('bulletList') ? 'bg-accent' : ''} border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150`} title="Bullet list">
                            <List className="h-4 w-4" />
                        </button>
                        <button onClick={toggleOrderedList} className={`${editor?.isActive('orderedList') ? 'bg-accent' : ''} border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150`} title="Numbered list">
                            <ListOrdered className="h-4 w-4" />
                        </button>

                        <button onClick={addLink} className={`${editor?.isActive('link') ? 'bg-accent' : ''} border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150`} title="Add link">
                            <Link className="h-4 w-4" />
                        </button>
                        <button onClick={() => editor?.chain().focus().toggleCodeBlock().run()} className={`${editor?.isActive('codeBlock') ? 'bg-accent' : ''} border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150`} title="Code block">
                            <Code className="h-4 w-4" />
                        </button>

                        <button onClick={() => editor?.chain().focus().toggleBlockquote().run()} className={`${editor?.isActive('blockquote') ? 'bg-accent' : ''} border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150`} title ="Blockquote">
                            <Quote className="h-4 w-4" />
                        </button>

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
                            "[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[44px] [&_.ProseMirror]:whitespace-pre-wrap [&_.ProseMirror]:break-all [&_.ProseMirror]:max-w-full",
                            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
                            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground",
                            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
                            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
                            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
                            // List styling
                            "[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-6 [&_.ProseMirror_ul]:my-2",
                            "[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-6 [&_.ProseMirror_ol]:my-2",
                            "[&_.ProseMirror_li]:my-1 [&_.ProseMirror_li]:break-all [&_.ProseMirror_li]:max-w-full",
                            "[&_.ProseMirror_ul_ul]:list-[circle] [&_.ProseMirror_ul_ul_ul]:list-[square]",
                            "[&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-border [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:ml-0 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:break-all",
                            "[&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_pre]:rounded [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:break-all",
                            "[&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:text-sm [&_.ProseMirror_code]:break-all",
                            "[&_.ProseMirror_p]:break-all [&_.ProseMirror_p]:max-w-full",
                            "[&_.ProseMirror_*]:max-w-full",
                            disabled && 'opacity-50 cursor-not-allowed'
                        )}
                        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
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
                            <Paperclip className="h-4 w-4" />
                        </button>
                        <button
                            className="border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150" onClick={() => setShowToolbar(p => !p)} title="Toggle formatting">
                            <TypeIcon className="h-4 w-4" />
                        </button>

                        {/* Mention button */}
                        <button className="border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150" onClick={openMentionSuggestions} title="Mention someone">
                            <AtSign className="h-4 w-4" />
                        </button>
                        {/* Emoji picker (bottom) */}
                        <div className="relative" ref={emojiPickerRef}>
                            <button className="border-0 p-2 transition-colors duration-150 hover:text-primary hover:[&>svg]:text-primary hover:[&>svg]:scale-110 [&>svg]:transition-all [&>svg]:duration-150" onClick={() => setShowEmojiPicker(s => !s)} title="Add emoji">
                                <Smile className="h-4 w-4" />
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
                            <Send className="h-4 w-4 text-primary" />
                        </button>
                    </div>
                </div>
            </div>
        )
    }
)

RichMessageEditor.displayName = 'RichMessageEditor'

export default RichMessageEditor

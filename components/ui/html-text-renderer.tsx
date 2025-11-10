"use client";

import React from 'react';
import { cn } from '@/lib/utils';

export interface HtmlTextRendererProps {
  content?: string | null;
  maxLength?: number;
  className?: string;
  fallbackText?: string;
  showFallback?: boolean;
  renderAsHtml?: boolean; // New prop to render HTML content vs plain text
  truncateHtml?: boolean; // Whether to truncate HTML content or plain text
  preserveFormatting?: boolean;
}

/**
 * Component to safely render HTML content or convert it to plain text
 * Useful for displaying rich text content in tables or cards
 */
export function HtmlTextRenderer({
  content,
  maxLength = 100,
  className,
  fallbackText = "No description",
  showFallback = true,
  renderAsHtml = true,
  truncateHtml = false,
  preserveFormatting = false,
}: HtmlTextRendererProps) {
  // Helper function to strip HTML tags and decode entities
  const stripHtmlTags = (html: string): string => {
    // Create a temporary DOM element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Get text content which automatically strips HTML tags
    let text = tempDiv.textContent || tempDiv.innerText || '';
    
    // Clean up extra whitespace and newlines
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  };

  // Helper function to truncate text
  const truncateText = (text: string, length: number): string => {
    if (text.length <= length) return text;
    return text.substring(0, length).trim() + '...';
  };

  // Helper function to truncate HTML content
  const truncateHtmlContent = (html: string, maxChars: number): string => {
    const plainText = stripHtmlTags(html);
    if (plainText.length <= maxChars) return html;
    
    // If we need to truncate, we'll do it on the plain text and return plain text
    return truncateText(plainText, maxChars);
  };

  // Helper function to sanitize HTML content
  const sanitizeHtml = (html: string): string => {
    // Basic sanitization - you might want to use a library like DOMPurify in production
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Remove potentially dangerous elements and attributes
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'link', 'meta'];
    dangerousTags.forEach(tag => {
      const elements = tempDiv.querySelectorAll(tag);
      elements.forEach(el => el.remove());
    });
    
    // Remove dangerous attributes
    const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'];
    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach(el => {
      dangerousAttrs.forEach(attr => {
        el.removeAttribute(attr);
      });
      // Remove javascript: links
      if (el.getAttribute('href')?.startsWith('javascript:')) {
        el.removeAttribute('href');
      }
    });
    
    return tempDiv.innerHTML;
  };

  // Process the content
  const processContent = (): { html: string; text: string; isEmpty: boolean } => {
    if (!content || content.trim() === '' || content.trim() === '<p><br></p>') {
      return { html: '', text: '', isEmpty: true };
    }

    const plainText = stripHtmlTags(content);
    
    if (!renderAsHtml) {
      // Return plain text version
      const truncatedText = maxLength ? truncateText(plainText, maxLength) : plainText;
      return { html: '', text: truncatedText, isEmpty: false };
    }

    // Return HTML version
    let processedHtml = sanitizeHtml(content);
    
    if (truncateHtml && maxLength) {
      // If we need to truncate HTML content
      if (plainText.length > maxLength) {
        const truncatedText = truncateText(plainText, maxLength);
        return { html: '', text: truncatedText, isEmpty: false };
      }
    }
    
    return { html: processedHtml, text: plainText, isEmpty: false };
  };

  const { html: processedHtml, text: processedText, isEmpty } = processContent();

  // If no content and fallback is disabled, return null
  if (isEmpty && !showFallback) {
    return null;
  }

  // If no content but fallback is enabled
  if (isEmpty && showFallback) {
    return (
      <span className={cn("text-sm text-muted-foreground italic", className)}>
        {fallbackText}
      </span>
    );
  }

  // Render content based on renderAsHtml flag
  if (renderAsHtml && processedHtml) {
    return (
      <div
        className={cn(
          "text-sm text-muted-foreground",
          "prose prose-sm max-w-none", // Tailwind typography classes for better HTML rendering
          "[&>p]:my-1 [&>ol]:my-1 [&>ul]:my-1", // Reduce spacing in lists and paragraphs
          "[&>ol]:list-decimal [&>ol]:list-inside [&>ol]:pl-4", // Ordered list with numbers
          "[&>ul]:list-disc [&>ul]:list-inside [&>ul]:pl-4", // Unordered list with bullets
          "[&_ol]:list-decimal [&_ol]:list-inside", // Nested ordered lists
          "[&_ul]:list-disc [&_ul]:list-inside", // Nested unordered lists  
          "[&_li]:ml-0", // Reset list item margin
          "[&_strong]:font-semibold [&_em]:italic", // Ensure formatting works
          "[&_p]:inline", // Make paragraphs inside list items inline
          preserveFormatting && "whitespace-pre-wrap",
          className
        )}
        title={maxLength && processedText.length > maxLength ? processedText : undefined}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    );
  }

  // Render as plain text
  return (
    <span 
      className={cn(
        "text-sm text-muted-foreground",
        preserveFormatting && "whitespace-pre-wrap",
        className
      )}
      title={maxLength && processedText.length > maxLength ? processedText : undefined}
    >
      {processedText}
    </span>
  );
}

/**
 * Utility function to extract plain text from HTML content
 * Can be used outside of React components
 */
export const extractTextFromHtml = (html: string, maxLength?: number): string => {
  if (typeof window === 'undefined') {
    // Server-side fallback - basic HTML tag removal
    const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return maxLength ? text.substring(0, maxLength) + (text.length > maxLength ? '...' : '') : text;
  }

  // Client-side - proper HTML parsing
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  let text = tempDiv.textContent || tempDiv.innerText || '';
  text = text.replace(/\s+/g, ' ').trim();
  
  if (maxLength && text.length > maxLength) {
    return text.substring(0, maxLength).trim() + '...';
  }
  
  return text;
};

/**
 * Utility function to safely render HTML with basic sanitization
 * Can be used outside of React components
 */
export const sanitizeAndRenderHtml = (html: string): string => {
  if (typeof window === 'undefined') {
    return html; // Return as-is on server-side
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove potentially dangerous elements
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'link', 'meta'];
  dangerousTags.forEach(tag => {
    const elements = tempDiv.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });
  
  return tempDiv.innerHTML;
};

export default HtmlTextRenderer;
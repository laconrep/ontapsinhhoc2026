/**
 * Bỏ dấu ngoặc kép xung quanh từ hoán đổi (underline quotes) trong content.
 * Ví dụ: 'DNA tạo từ "đa phần" và "bổ sung"' → 'DNA tạo từ đa phần và bổ sung'
 * 
 * Hỗ trợ cú pháp: "từ" hoặc "từ|syn1|syn2"
 */
export function cleanContentDisplay(content: string): string {
  // Thay thế "..."|... bằng ... (bỏ dấu ngoặc kép và synonyms)
  return content.replace(/"([^"]+?)(\|[^"]*)?"/g, '$1')
}

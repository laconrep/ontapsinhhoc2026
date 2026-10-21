import { randomInt } from "crypto"

/**
 * SEC-05: mã mời lớp MỚI dài 8 ký tự, sinh bằng crypto.randomInt (CSPRNG)
 * trên bảng 32 ký tự không gây nhầm lẫn (bỏ 0/O/1/I). Mã cũ 6 ký tự vẫn
 * tồn tại trong DB và vẫn được joinClass chấp nhận (chuyển tiếp).
 */
export const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
export const INVITE_CODE_LENGTH = 8
export const LEGACY_INVITE_CODE_LENGTH = 6

export function generateInviteCode(): string {
  let code = ""
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARS[randomInt(INVITE_CODE_CHARS.length)]
  }
  return code
}

/** Mã hợp lệ về định dạng: 8 ký tự mới hoặc 6 ký tự cũ (chuyển tiếp). */
export function isInviteCodeFormat(code: string): boolean {
  if (code.length !== INVITE_CODE_LENGTH && code.length !== LEGACY_INVITE_CODE_LENGTH) {
    return false
  }
  return [...code].every((ch) => INVITE_CODE_CHARS.includes(ch))
}

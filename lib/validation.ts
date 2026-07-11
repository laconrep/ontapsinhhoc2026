import { z } from "zod"

/** Zod schemas dùng chung cho server actions (thay cho validate middleware của spec). */

export const createClassSchema = z.object({
  name: z.string().trim().min(1, "Tên lớp không được để trống").max(120),
  subject: z.string().trim().min(1, "Môn học không được để trống").max(80),
  schoolYear: z.string().trim().min(1, "Năm học không được để trống").max(20),
})

export const updateClassSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  subject: z.string().trim().min(1).max(80).optional(),
  schoolYear: z.string().trim().min(1).max(20).optional(),
})

export const joinClassSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .length(6, "Mã lớp gồm 6 ký tự"),
})

export type CreateClassInput = z.infer<typeof createClassSchema>
export type UpdateClassInput = z.infer<typeof updateClassSchema>

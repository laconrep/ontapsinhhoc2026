"use client"

import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        role: {
          type: "string",
          required: false,
          defaultValue: "student",
          input: true,
        },
        isOnboarded: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    }),
  ],
})

export const { signIn, signUp, signOut, useSession } = authClient

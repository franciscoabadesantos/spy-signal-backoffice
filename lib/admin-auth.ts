import { auth, currentUser } from '@clerk/nextjs/server'

type AdminContext = {
  userId: string
  email: string
}

function parseAllowlist(): Set<string> {
  const raw = process.env.ADMIN_EMAIL_ALLOWLIST ?? ''
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  )
}

export async function requireAdminUser(): Promise<AdminContext> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error('UNAUTHORIZED')
  }

  const allowlist = parseAllowlist()
  if (allowlist.size === 0) {
    throw new Error('ADMIN_NOT_CONFIGURED')
  }

  const user = await currentUser()
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase().trim()
  if (!email) {
    throw new Error('EMAIL_MISSING')
  }

  if (!allowlist.has(email)) {
    throw new Error('FORBIDDEN')
  }

  return {
    userId,
    email,
  }
}

export function mapAuthErrorStatus(error: unknown): { status: number; message: string } {
  const code = error instanceof Error ? error.message : 'UNKNOWN'
  if (code === 'UNAUTHORIZED') {
    return { status: 401, message: 'Authentication required.' }
  }
  if (code === 'ADMIN_NOT_CONFIGURED') {
    return { status: 500, message: 'Admin allowlist is not configured.' }
  }
  if (code === 'FORBIDDEN') {
    return { status: 403, message: 'Admin access required.' }
  }
  if (code === 'EMAIL_MISSING') {
    return { status: 403, message: 'No verified email found for user.' }
  }
  return { status: 500, message: 'Authorization check failed.' }
}

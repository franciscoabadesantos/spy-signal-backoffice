import { requireAdminUser } from '@/lib/admin-auth'
import SignalsWorkspace from './ui'

export default async function SignalsPage() {
  const admin = await requireAdminUser()
  return <SignalsWorkspace adminEmail={admin.email} />
}

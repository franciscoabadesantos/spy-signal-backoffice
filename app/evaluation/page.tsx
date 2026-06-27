import { requireAdminUser } from '@/lib/admin-auth'
import SignalsWorkspace from '@/app/signals/ui'

export default async function EvaluationPage() {
  const admin = await requireAdminUser()
  return <SignalsWorkspace adminEmail={admin.email} />
}

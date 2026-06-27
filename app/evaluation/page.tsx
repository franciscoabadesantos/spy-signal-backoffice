import { requireAdminUser } from '@/lib/admin-auth'
import EvaluationWorkspace from './ui'

export default async function EvaluationPage() {
  const admin = await requireAdminUser()
  return <EvaluationWorkspace adminEmail={admin.email} />
}

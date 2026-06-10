import { requireAdminUser } from '@/lib/admin-auth'
import OperationsWorkspace from './ui'

export default async function OperationsPage() {
  const admin = await requireAdminUser()
  return <OperationsWorkspace adminEmail={admin.email} />
}

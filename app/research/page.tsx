import { requireAdminUser } from '@/lib/admin-auth'
import ResearchConsole from './ui'

export default async function ResearchPage() {
  const admin = await requireAdminUser()
  return <ResearchConsole adminEmail={admin.email} />
}

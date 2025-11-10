import { CardLoader, TableLoader } from "@/components/ui/loader";
import PageHeader from "@/components/ui/page-header";

export default function Loading() {
  return (
    <div>
      <PageHeader
        title="Users Management"
        subtitle="Loading users..."
      />
      <TableLoader showViewToggle={true} showRowsPerPage={true} />
    </div>
  )
}

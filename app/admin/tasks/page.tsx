import { AdminTasksVerificationPanel } from '@/components/AdminTasksVerificationPanel';

export const dynamic = 'force-dynamic';

export default function AdminTasksPage() {
  return (
    <main className="min-h-screen bg-[#080808] p-4">
      <div className="mx-auto w-full max-w-5xl">
        <AdminTasksVerificationPanel />
      </div>
    </main>
  );
}

import DashboardView from '@/components/Dashboard/DashboardView';

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-zinc-50 px-6 py-16 dark:bg-zinc-950">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Your Learning Path
      </h1>
      <DashboardView />
    </main>
  );
}

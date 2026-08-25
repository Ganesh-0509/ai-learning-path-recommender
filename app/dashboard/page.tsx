import DashboardView from '@/components/Dashboard/DashboardView';

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6 py-8 sm:py-16 dark:bg-zinc-950">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Your Learning Path
      </h1>
      <DashboardView />
    </main>
  );
}

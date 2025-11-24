import PersoneManager from '@/components/settings/PersoneManager';

export default function PersonePage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <PersoneManager />
      </div>
    </div>
  );
}

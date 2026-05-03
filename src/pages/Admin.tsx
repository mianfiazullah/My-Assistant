import { Shield } from 'lucide-react';

export default function Admin() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900">Admin Panel</h1>
          <p className="text-neutral-500">Manage users, access levels, and system settings</p>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-12 text-center">
        <Shield className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-200 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-neutral-900 mb-2">System Administration</h2>
        <p className="text-neutral-500 max-w-md mx-auto">
          Welcome to the administration panel. Use this section to manage system-wide settings and user permissions.
        </p>
      </div>
    </div>
  );
}

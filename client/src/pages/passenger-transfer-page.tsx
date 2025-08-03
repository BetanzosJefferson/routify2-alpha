import { PassengerTransfer } from "@/components/passenger-transfer/passenger-transfer-simple";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function PassengerTransferPage() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar activeTab="passenger-transfer" onTabChange={() => {}} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-6 py-8">
            <PassengerTransfer />
          </div>
        </main>
      </div>
    </div>
  );
}
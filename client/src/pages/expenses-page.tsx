import { DefaultLayout } from "@/components/layout/default-layout";
import { ExpensesPage } from "@/components/expenses/expenses-page";

export default function ExpensesPageRoute() {
  return (
    <DefaultLayout>
      <ExpensesPage />
    </DefaultLayout>
  );
}
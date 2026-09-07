import { redirect } from 'next/navigation';

export default function LegacyTablePage() {
  redirect('/tickets/table');
}

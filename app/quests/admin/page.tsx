import { Metadata } from "next";
import PageNavbar from "@/components/page-navbar";
import QuestsAdmin from "@/components/quests-admin";

export const metadata: Metadata = {
  title: "Season rewards | Ronke Quest",
  // Nothing here is secret, but it is not for players either.
  robots: { index: false, follow: false },
};

export default function QuestsAdminPage() {
  return (
    <main className="min-h-screen">
      <PageNavbar />
      <QuestsAdmin />
    </main>
  );
}

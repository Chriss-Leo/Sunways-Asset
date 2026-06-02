import Head from "next/head";
import { useT } from "@/i18n";
import { AdminConsole } from "@/components/dashboard/AdminConsole";

export default function AdminPage() {
  const { t } = useT();

  return (
    <>
      <Head>
        <title>{t("nav.admin")} — Sunways Asset</title>
      </Head>
      <AdminConsole />
    </>
  );
}

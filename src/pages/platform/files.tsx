import Head from "next/head";
import { useT } from "@/i18n";
import { FileCenter } from "@/components/platform/FileCenter";

export default function FilesPage() {
  const { t } = useT();

  return (
    <>
      <Head>
        <title>{t("nav.files")} — Sunways Asset</title>
      </Head>
      <FileCenter />
    </>
  );
}

import Head from "next/head";
import { useT } from "@/i18n";
import { PlatformWorkspace } from "@/components/platform/PlatformWorkspace";

export default function PlatformPage() {
  const { t } = useT();

  return (
    <>
      <Head>
        <title>{`${t("nav.platform")} — Sunways Asset`}</title>
      </Head>
      <PlatformWorkspace />
    </>
  );
}

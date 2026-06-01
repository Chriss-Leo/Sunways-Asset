import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useT } from "@/i18n";
import {
  checkAssetIssuanceReady,
  createAssetDraft,
  createAssetFile,
  createOrganization,
  createOrganizationMember,
  generateAssetMetadata,
  getAssetDrafts,
  getAssetFiles,
  getOrganizations,
  getPlatformAuditLogs,
  updateAssetDraftStatus,
} from "@/services/dashboard";

const fallbackAccount = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

function submit(event: FormEvent<HTMLFormElement>, action: () => void) {
  event.preventDefault();
  action();
}

function Field({
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-zinc-500">
        {label}
      </span>
      <input
        className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function TextArea({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-zinc-500">
        {label}
      </span>
      <textarea
        className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function StatusMessage({
  error,
  success,
}: {
  error?: Error | null;
  success?: string;
}) {
  if (error) {
    return (
      <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error.message}
      </p>
    );
  }
  if (!success) {
    return null;
  }
  return (
    <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      {success}
    </p>
  );
}

function ActionButton({
  children,
  disabled,
}: {
  children: string;
  disabled?: boolean;
}) {
  return (
    <button
      className="h-10 min-w-28 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
      disabled={disabled}
      type="submit"
    >
      {children}
    </button>
  );
}

function Panel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function shortValue(value: string) {
  if (!value) {
    return "N/A";
  }
  if (value.length <= 16) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-800",
    draft: "bg-zinc-100 text-zinc-700",
    metadata_ready: "bg-blue-100 text-blue-800",
    onchain: "bg-purple-100 text-purple-800",
    rejected: "bg-red-100 text-red-800",
    submitted: "bg-amber-100 text-amber-800",
  };
  const base = colors[status] ?? "bg-zinc-100 text-zinc-700";
  return `rounded-md px-2 py-1 text-xs font-semibold ${base}`;
}

export function PlatformWorkspace() {
  const { t } = useT();
  const { address } = useAccount();
  const account: string = address ?? fallbackAccount;
  const queryClient = useQueryClient();

  const organizations = useQuery({
    queryKey: ["platform-organizations"],
    queryFn: getOrganizations,
  });
  const assets = useQuery({
    queryKey: ["platform-assets"],
    queryFn: () => getAssetDrafts(),
  });
  const files = useQuery({
    queryKey: ["platform-files"],
    queryFn: () => getAssetFiles(),
  });
  const auditLogs = useQuery({
    queryKey: ["platform-audit-logs"],
    queryFn: getPlatformAuditLogs,
  });

  const firstOrgId = organizations.data?.items[0]?.id ?? 0;
  const firstAssetId = assets.data?.items[0]?.id ?? 0;

  const [organization, setOrganization] = useState({
    contactEmail: "ops@sunways.local",
    contactName: "Sunways Operator",
    name: "Sunways Project Company",
    registrationNo: "91320000MA-SUNWAYS",
    type: "project_owner",
    walletAddress: account,
  });
  const [asset, setAsset] = useState({
    address: "Jiangsu Industrial Park",
    assetType: "distributed_solar",
    capacityKw: "5000",
    country: "CN",
    description: "Rooftop solar station with grid-connected generation.",
    expectedAnnualKwh: "6200000",
    expectedRevenue: "3100000",
    name: "Sunways Jiangsu Solar Station",
    organizationId: String(firstOrgId || 1),
    ownerWallet: account,
    region: "Jiangsu, CN",
  });
  const [file, setFile] = useState({
    assetDraftId: String(firstAssetId || 1),
    category: "asset_metadata",
    cid: "",
    gatewayUrl: "",
    organizationId: String(firstOrgId || 1),
    originalName: "station-001.json",
    purpose: "NFT metadata",
  });
  const [checkResult, setCheckResult] = useState<{
    id: number;
    ready: boolean;
    checks: { check: string; passed: boolean; message?: string }[];
  } | null>(null);

  const invalidatePlatform = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["platform-organizations"] }),
      queryClient.invalidateQueries({ queryKey: ["platform-assets"] }),
      queryClient.invalidateQueries({ queryKey: ["platform-files"] }),
      queryClient.invalidateQueries({ queryKey: ["platform-audit-logs"] }),
    ]);
  };

  const organizationMutation = useMutation({
    mutationFn: () => createOrganization(organization),
    onSuccess: async (created) => {
      await createOrganizationMember({
        organizationId: created.id,
        role: "project_admin",
        walletAddress: account,
      });
      await invalidatePlatform();
    },
  });
  const assetMutation = useMutation({
    mutationFn: () =>
      createAssetDraft({
        ...asset,
        organizationId: Number(asset.organizationId || firstOrgId),
        status: "draft",
      }),
    onSuccess: invalidatePlatform,
  });
  const submitMutation = useMutation({
    mutationFn: (id: number) =>
      updateAssetDraftStatus(id, {
        actor: account,
        note: "Submitted for platform review",
        status: "submitted",
      }),
    onSuccess: invalidatePlatform,
  });
  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      updateAssetDraftStatus(id, {
        actor: account,
        note: "Material review approved",
        status: "approved",
      }),
    onSuccess: invalidatePlatform,
  });
  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      updateAssetDraftStatus(id, {
        actor: account,
        note: "Material incomplete or non-compliant",
        status: "rejected",
      }),
    onSuccess: invalidatePlatform,
  });
  const metadataMutation = useMutation({
    mutationFn: (id: number) => generateAssetMetadata(id),
    onSuccess: async (data, id) => {
      if (data.metadataUri) {
        await updateAssetDraftStatus(id, {
          actor: account,
          note: `Metadata uploaded to ${data.metadataUri}`,
          status: "metadata_ready",
        });
      }
      await invalidatePlatform();
    },
  });
  const checkMutation = useMutation({
    mutationFn: (id: number) => checkAssetIssuanceReady(id),
    onSuccess: (data) => {
      setCheckResult({
        id: data.assetId,
        ready: data.ready,
        checks: data.checks,
      });
    },
  });
  const fileMutation = useMutation({
    mutationFn: () =>
      createAssetFile({
        ...file,
        assetDraftId: Number(file.assetDraftId || firstAssetId),
        organizationId: Number(file.organizationId || firstOrgId),
        uploader: account,
      }),
    onSuccess: invalidatePlatform,
  });

  const summary = useMemo(() => {
    const assetItems = assets.data?.items ?? [];
    return {
      approved: assetItems.filter((item) => item.status === "approved").length,
      drafts: assetItems.filter((item) => item.status === "draft").length,
      organizations: organizations.data?.items.length ?? 0,
      submitted: assetItems.filter(
        (item) => item.status === "submitted" || item.status === "metadata_ready",
      ).length,
    };
  }, [assets.data?.items, organizations.data?.items]);

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-zinc-500">
              {t("platform.buildout")}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-zinc-950">
              {t("platform.onboardingWorkspace")}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Metric label={t("platform.organizations")} value={summary.organizations} />
            <Metric label={t("platform.drafts")} value={summary.drafts} />
            <Metric label={t("platform.submitted")} value={summary.submitted} />
            <Metric label={t("platform.approved")} value={summary.approved} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title={t("platform.createOrganization")}>
          <form
            className="space-y-3"
            onSubmit={(event) =>
              submit(event, () => organizationMutation.mutate())
            }
          >
            <Field
              label={t("admin.name")}
              onChange={(name) =>
                setOrganization((value) => ({ ...value, name }))
              }
              value={organization.name}
            />
            <Field
              label={t("admin.type")}
              onChange={(type) =>
                setOrganization((value) => ({ ...value, type }))
              }
              value={organization.type}
            />
            <Field
              label={t("platform.registrationNo")}
              onChange={(registrationNo) =>
                setOrganization((value) => ({ ...value, registrationNo }))
              }
              value={organization.registrationNo}
            />
            <Field
              label={t("platform.wallet")}
              onChange={(walletAddress) =>
                setOrganization((value) => ({ ...value, walletAddress }))
              }
              value={organization.walletAddress}
            />
            <ActionButton disabled={organizationMutation.isPending}>
              {organizationMutation.isPending ? t("platform.creating") : t("platform.create")}
            </ActionButton>
            <StatusMessage
              error={organizationMutation.error}
              success={
                organizationMutation.data
                  ? t("platform.created", { id: organizationMutation.data.id })
                  : undefined
              }
            />
          </form>
        </Panel>

        <Panel title={t("platform.createAssetDraft")}>
          <form
            className="space-y-3"
            onSubmit={(event) => submit(event, () => assetMutation.mutate())}
          >
            <Field
              label={t("platform.organizationId")}
              onChange={(organizationId) =>
                setAsset((value) => ({ ...value, organizationId }))
              }
              value={asset.organizationId}
            />
            <Field
              label={t("platform.assetName")}
              onChange={(name) => setAsset((value) => ({ ...value, name }))}
              value={asset.name}
            />
            <Field
              label={t("platform.assetType")}
              onChange={(assetType) =>
                setAsset((value) => ({ ...value, assetType }))
              }
              value={asset.assetType}
            />
            <Field
              label={t("admin.region")}
              onChange={(region) => setAsset((value) => ({ ...value, region }))}
              value={asset.region}
            />
            <Field
              label={t("admin.capacityKw")}
              onChange={(capacityKw) =>
                setAsset((value) => ({ ...value, capacityKw }))
              }
              value={asset.capacityKw}
            />
            <TextArea
              label={t("platform.description")}
              onChange={(description) =>
                setAsset((value) => ({ ...value, description }))
              }
              value={asset.description}
            />
            <ActionButton disabled={assetMutation.isPending}>
              {assetMutation.isPending ? t("admin.saving") : t("platform.saveDraft")}
            </ActionButton>
            <StatusMessage
              error={assetMutation.error}
              success={
                assetMutation.data ? t("platform.draft", { id: assetMutation.data.id }) : undefined
              }
            />
          </form>
        </Panel>

        <Panel title={t("platform.registerIpfsFile")}>
          <form
            className="space-y-3"
            onSubmit={(event) => submit(event, () => fileMutation.mutate())}
          >
            <Field
              label={t("platform.assetDraftId")}
              onChange={(assetDraftId) =>
                setFile((value) => ({ ...value, assetDraftId }))
              }
              value={file.assetDraftId}
            />
            <Field
              label={t("platform.category")}
              onChange={(category) =>
                setFile((value) => ({ ...value, category }))
              }
              value={file.category}
            />
            <Field
              label={t("platform.originalName")}
              onChange={(originalName) =>
                setFile((value) => ({ ...value, originalName }))
              }
              value={file.originalName}
            />
            <Field
              label={t("platform.cid")}
              onChange={(cid) => setFile((value) => ({ ...value, cid }))}
              placeholder="Qm... or bafy..."
              value={file.cid}
            />
            <Field
              label={t("platform.gatewayUrl")}
              onChange={(gatewayUrl) =>
                setFile((value) => ({ ...value, gatewayUrl }))
              }
              value={file.gatewayUrl}
            />
            <ActionButton disabled={fileMutation.isPending}>
              {fileMutation.isPending ? t("admin.saving") : t("platform.saveFile")}
            </ActionButton>
            <StatusMessage
              error={fileMutation.error}
              success={
                fileMutation.data ? t("platform.file", { id: fileMutation.data.id }) : undefined
              }
            />
          </form>
        </Panel>
      </div>

      {checkResult ? (
        <Panel title={t("platform.preIssuanceCheck", { id: checkResult.id })}>
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold">{t("platform.overall")}</span>{" "}
              <span
                className={
                  checkResult.ready
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-red-700"
                }
              >
                {checkResult.ready ? t("platform.readyForIssuance") : t("platform.notReady")}
              </span>
            </p>
            <div className="space-y-2">
              {checkResult.checks.map((check) => (
                <div
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    check.passed
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-red-200 bg-red-50"
                  }`}
                  key={check.check}
                >
                  <span>{check.passed ? "✅" : "❌"}</span>
                  <span className="font-medium">{check.check}</span>
                  {check.message ? (
                    <span className="text-xs text-zinc-500">
                      — {check.message}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
        <Panel title={t("platform.assetReviewQueue")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-3 pr-3">{t("platform.id")}</th>
                  <th className="py-3 pr-3">{t("platform.asset")}</th>
                  <th className="py-3 pr-3">{t("platform.type")}</th>
                  <th className="py-3 pr-3">{t("platform.region")}</th>
                  <th className="py-3 pr-3">{t("platform.capacity")}</th>
                  <th className="py-3 pr-3">{t("common.status")}</th>
                  <th className="py-3 pr-3">{t("platform.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(assets.data?.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-3 font-mono">#{item.id}</td>
                    <td className="py-3 pr-3 font-medium text-zinc-950">
                      {item.name}
                    </td>
                    <td className="py-3 pr-3">{item.assetType}</td>
                    <td className="py-3 pr-3">{item.region}</td>
                    <td className="py-3 pr-3">{item.capacityKw} kW</td>
                    <td className="py-3 pr-3">
                      <span className={statusBadge(item.status)}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {item.status === "draft" ? (
                          <button
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 transition hover:border-zinc-900"
                            onClick={() => submitMutation.mutate(item.id)}
                            type="button"
                          >
                            {t("platform.submit")}
                          </button>
                        ) : null}
                        {item.status === "submitted" || item.status === "metadata_ready" ? (
                          <button
                            className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-700"
                            onClick={() => approveMutation.mutate(item.id)}
                            type="button"
                          >
                            {t("platform.approve")}
                          </button>
                        ) : null}
                        {item.status === "submitted" || item.status === "metadata_ready" ? (
                          <button
                            className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 transition hover:border-red-700"
                            onClick={() => rejectMutation.mutate(item.id)}
                            type="button"
                          >
                            {t("platform.reject")}
                          </button>
                        ) : null}
                        {item.status === "approved" ? (
                          <button
                            className="rounded-md border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700 transition hover:border-blue-700"
                            onClick={() => metadataMutation.mutate(item.id)}
                            type="button"
                          >
                            {metadataMutation.isPending && metadataMutation.variables === item.id
                              ? t("platform.generating")
                              : t("platform.metadata")}
                          </button>
                        ) : null}
                        {item.status === "approved" || item.status === "metadata_ready" ? (
                          <button
                            className="rounded-md border border-purple-300 px-2 py-1 text-xs font-semibold text-purple-700 transition hover:border-purple-700"
                            onClick={() => checkMutation.mutate(item.id)}
                            type="button"
                          >
                            {t("platform.check")}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {assets.data?.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              {t("platform.noAssetDrafts")}
            </p>
          ) : null}
        </Panel>

        <Panel title={t("platform.recentFilesAudit")}>
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase text-zinc-500">
                {t("platform.files")}
              </p>
              <div className="mt-2 space-y-2">
                {(files.data?.items ?? []).slice(0, 5).map((item) => (
                  <div
                    className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    key={item.id}
                  >
                    <p className="font-medium text-zinc-950">
                      {item.originalName || item.category}
                    </p>
                    <p className="mt-1 font-mono text-xs text-zinc-500">
                      {shortValue(item.cid || item.ipfsUri)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-zinc-500">
                {t("platform.audit")}
              </p>
              <div className="mt-2 space-y-2">
                {(auditLogs.data?.items ?? []).slice(0, 5).map((item) => (
                  <div
                    className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    key={item.id}
                  >
                    <p className="font-medium text-zinc-950">{item.action}</p>
                    <p className="mt-1 text-xs text-zinc-500">{item.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

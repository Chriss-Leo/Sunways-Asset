import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useT } from "@/i18n";
import {
  checkAssetIssuanceReady,
  createAssetDraft,
  createAssetFile,
  createOrganization,
  createOrganizationMember,
  deleteAssetDraft,
  generateAssetMetadata,
  getAssetDrafts,
  getAssetFiles,
  getOrganizations,
  getPlatformAuditLogs,
  issueAssetDraft,
  updateAssetDraft,
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

function statusBadge(status: string, label: string) {
  const colors: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-800",
    draft: "bg-zinc-100 text-zinc-700",
    metadata_ready: "bg-blue-100 text-blue-800",
    onchain: "bg-purple-100 text-purple-800",
    rejected: "bg-red-100 text-red-800",
    submitted: "bg-amber-100 text-amber-800",
  };
  const base = colors[status] ?? "bg-zinc-100 text-zinc-700";
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${base}`}>
      {label}
    </span>
  );
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

  useEffect(() => {
    if (firstAssetId > 0) {
      setFile((prev) => ({ ...prev, assetDraftId: String(firstAssetId) }));
    }
  }, [firstAssetId]);
  const [pipelineError, setPipelineError] = useState<{ message: string } | null>(null);
  const [showCheckDetails, setShowCheckDetails] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    id: number;
    ready: boolean;
    checks: { check: string; passed: boolean; message?: string }[];
  } | null>(null);
  const [issueResult, setIssueResult] = useState<{
    assetId: number;
    stationId: number;
    txHash: string;
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
  const resubmitMutation = useMutation({
    mutationFn: (id: number) =>
      updateAssetDraftStatus(id, {
        actor: account,
        note: "Resubmitted for review after revision",
        status: "draft",
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
      setShowCheckDetails(false);
      setCheckResult({
        id: data.assetId,
        ready: data.ready,
        checks: data.checks,
      });
    },
  });
  const issueMutation = useMutation({
    mutationFn: (id: number) => issueAssetDraft(id, { actor: account }),
    onSuccess: async (data) => {
      setIssueResult({
        assetId: data.asset.id,
        stationId: data.stationId,
        txHash: data.txHash,
      });
      await Promise.all([
        invalidatePlatform(),
        queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["stations"] }),
        queryClient.invalidateQueries({ queryKey: ["indexer-status"] }),
      ]);
    },
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", region: "", capacityKw: "", country: "",
    description: "", address: "", expectedAnnualKwh: "", expectedRevenue: "",
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAssetDraft(id),
    onSuccess: () => {
      setConfirmDeleteId(null);
      invalidatePlatform();
    },
    onError: () => {
      setConfirmDeleteId(null);
    },
  });
  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, string> }) =>
      updateAssetDraft(id, data),
    onSuccess: () => {
      setEditingId(null);
      invalidatePlatform();
    },
    onError: () => {
      setEditingId(null);
    },
  });

  useEffect(() => {
    const sources = [
      submitMutation.error, approveMutation.error, rejectMutation.error,
      resubmitMutation.error, metadataMutation.error, checkMutation.error,
      issueMutation.error, editMutation.error, deleteMutation.error,
    ];
    const first = sources.find(Boolean);
    setPipelineError(first ? { message: first.message } : null);
  }, [
    submitMutation.error, approveMutation.error, rejectMutation.error,
    resubmitMutation.error, metadataMutation.error, checkMutation.error,
    issueMutation.error, editMutation.error, deleteMutation.error,
  ]);

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
      draftCount: assetItems.filter(
        (item) => item.status === "draft" || item.status === "rejected",
      ).length,
      inReviewCount: assetItems.filter(
        (item) => item.status === "submitted",
      ).length,
      orgCount: organizations.data?.items.length ?? 0,
      onChainCount: assetItems.filter(
        (item) => item.status === "onchain",
      ).length,
      readyCount: assetItems.filter(
        (item) => item.status === "approved" || item.status === "metadata_ready",
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
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <Metric label={t("platform.organizations")} value={summary.orgCount} />
            <Metric label={t("platform.drafts")} value={summary.draftCount} />
            <Metric label={t("platform.inReview")} value={summary.inReviewCount} />
            <Metric label={t("platform.ready")} value={summary.readyCount} />
            <Metric label={t("platform.issued")} value={summary.onChainCount} />
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

      <div className="grid gap-5 xl:grid-cols-[5fr_2fr]">
        <Panel title={t("platform.assetPipeline")}>
          {checkResult ? (
            <div
              className={`mb-4 rounded-md border px-4 py-3 ${
                checkResult.ready
                  ? "border-emerald-200 bg-emerald-50/70"
                  : "border-red-200 bg-red-50/70"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">
                    {t("platform.preIssuanceCheck", { id: checkResult.id })}
                  </span>
                  <span className="text-zinc-400">·</span>
                  <span
                    className={
                      checkResult.ready
                        ? "font-semibold text-emerald-700"
                        : "font-semibold text-red-700"
                    }
                  >
                    {checkResult.ready ? t("platform.readyForIssuance") : t("platform.notReady")}
                  </span>
                  <span className="text-zinc-400">·</span>
                  <span className="text-xs text-zinc-500">
                    {checkResult.checks.filter((c) => c.passed).length}/{checkResult.checks.length} {t("platform.passed").toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition"
                    onClick={() => setShowCheckDetails((prev) => !prev)}
                    type="button"
                  >
                    {showCheckDetails ? t("platform.collapse") : t("platform.details")}
                  </button>
                  <button
                    className="text-xs text-zinc-400 hover:text-zinc-700 transition"
                    onClick={() => { setCheckResult(null); setShowCheckDetails(false); }}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              </div>
              {showCheckDetails ? (
                <div className="mt-3 space-y-1.5">
                  {checkResult.checks.map((check) => (
                    <div key={check.check}>
                      <div
                        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${
                          check.passed
                            ? "border-emerald-200 bg-white"
                            : "border-red-200 bg-white"
                        }`}
                      >
                        <span className={`font-semibold ${check.passed ? "text-emerald-700" : "text-red-700"}`}>
                          {check.passed ? "✓" : "✗"} {check.check}
                        </span>
                        {check.message ? (
                          <span className="text-zinc-500">— {check.message}</span>
                        ) : null}
                      </div>
                      {!check.passed && check.check === "has_files" ? (
                        <p className="mt-1 ml-4 text-xs text-zinc-400">
                          {t("platform.hasFilesHint")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {issueResult ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50/70 px-4 py-3">
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="font-semibold text-emerald-800">
                  {t("platform.issuanceResult", { id: issueResult.assetId })}
                </span>
                <span className="text-zinc-400">·</span>
                <span className="font-mono text-xs text-emerald-700">
                  {t("platform.stationMinted")}: #{issueResult.stationId}
                </span>
                <span className="text-zinc-400 hidden sm:inline">·</span>
                <span className="font-mono text-xs text-zinc-500 truncate hidden sm:inline">
                  {issueResult.txHash.slice(0, 18)}...
                </span>
              </div>
              <button
                className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700 transition"
                onClick={() => setIssueResult(null)}
                type="button"
              >
                ×
              </button>
            </div>
          ) : null}

          {pipelineError ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50/70 px-4 py-2.5">
              <p className="text-sm text-red-700 truncate min-w-0">
                {pipelineError.message}
              </p>
              <button
                className="shrink-0 text-xs text-red-400 hover:text-red-700 transition"
                onClick={() => setPipelineError(null)}
                type="button"
              >
                ×
              </button>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-3 pr-3">{t("platform.id")}</th>
                  <th className="py-3 pr-3">{t("platform.asset")}</th>
                  <th className="py-3 pr-3">{t("platform.type")}</th>
                  <th className="py-3 pr-3">{t("platform.region")}</th>
                  <th className="py-3 pr-3">{t("platform.capacity")}</th>
                  <th className="py-3 pr-3">{t("common.status")}</th>
                  <th className="w-36 py-3 pr-3">{t("platform.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(assets.data?.items ?? []).map((item) => {
                  const canGenerateMetadata =
                    item.status === "approved" && !item.metadataUri;
                  const canCheck =
                    item.status === "approved" || item.status === "metadata_ready";
                  const canIssue =
                    canCheck && Boolean(item.metadataUri) && !item.stationId;

                  return (
                    <>
                    <tr key={item.id}>
                      <td className="py-3 pr-3 font-mono">#{item.id}</td>
                      <td className="py-3 pr-3 font-medium text-zinc-950">
                        <p>{item.name}</p>
                        {item.stationId ? (
                          <p className="mt-1 font-mono text-xs text-emerald-700">
                            {t("platform.stationIssued", { id: item.stationId })}
                          </p>
                        ) : item.metadataUri ? (
                          <p className="mt-1 font-mono text-xs text-zinc-500">
                            {shortValue(item.metadataUri)}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3">{item.assetType}</td>
                      <td className="py-3 pr-3">{item.region}</td>
                      <td className="py-3 pr-3">{item.capacityKw} kW</td>
                      <td className="py-3 pr-3">
                        {statusBadge(item.status, t(`platform.status.${item.status}`))}
                      </td>
                      <td className="w-36 py-3 pr-3">
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
                          {item.status === "rejected" ? (
                            <button
                              className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 transition hover:border-amber-700"
                              onClick={() => resubmitMutation.mutate(item.id)}
                              type="button"
                            >
                              {resubmitMutation.isPending && resubmitMutation.variables === item.id
                                ? t("platform.resubmitting")
                                : t("platform.resubmit")}
                            </button>
                          ) : null}
                          {item.status === "submitted" ? (
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
                          {canGenerateMetadata ? (
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
                          {canCheck ? (
                            <button
                              className="rounded-md border border-purple-300 px-2 py-1 text-xs font-semibold text-purple-700 transition hover:border-purple-700"
                              onClick={() => checkMutation.mutate(item.id)}
                              type="button"
                            >
                              {t("platform.check")}
                            </button>
                          ) : null}
                          {canIssue ? (
                            <button
                              className="rounded-md border border-zinc-900 bg-zinc-950 px-2 py-1 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-300"
                              disabled={
                                issueMutation.isPending &&
                                issueMutation.variables === item.id
                              }
                              onClick={() => issueMutation.mutate(item.id)}
                              type="button"
                            >
                              {issueMutation.isPending &&
                              issueMutation.variables === item.id
                                ? t("platform.issuing")
                                : t("platform.issue")}
                            </button>
                          ) : null}
                          {item.status !== "onchain" ? (
                            <button
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-600 transition hover:border-zinc-900 hover:text-zinc-900"
                              onClick={() => {
                                setConfirmDeleteId(null);
                                setEditingId(item.id);
                                setEditForm({
                                  name: item.name, region: item.region,
                                  capacityKw: item.capacityKw, country: item.country,
                                  description: item.description, address: item.address,
                                  expectedAnnualKwh: item.expectedAnnualKwh,
                                  expectedRevenue: item.expectedRevenue,
                                });
                              }}
                              type="button"
                            >
                              {editMutation.isPending && editMutation.variables?.id === item.id
                                ? t("admin.saving")
                                : t("platform.edit")}
                            </button>
                          ) : null}
                          {item.status !== "onchain" ? (
                            confirmDeleteId === item.id ? (
                              <button
                                className="rounded-md border border-red-500 bg-red-500 px-2 py-1 text-xs font-semibold text-white transition hover:bg-red-600"
                                onClick={() => { setEditingId(null); deleteMutation.mutate(item.id); }}
                                type="button"
                              >
                                {t("platform.confirmDelete")}
                              </button>
                            ) : (
                              <button
                                className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-400 transition hover:border-red-400 hover:text-red-600"
                                onClick={() => { setEditingId(null); setConfirmDeleteId(item.id); }}
                                type="button"
                              >
                                {t("platform.delete")}
                              </button>
                            )
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {editingId === item.id ? (
                      <tr key={`edit-${item.id}`}>
                        <td className="bg-zinc-50 py-4" colSpan={7}>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Field
                              label={t("platform.assetName")}
                              onChange={(v) => setEditForm((p) => ({ ...p, name: v }))}
                              value={editForm.name}
                            />
                            <Field
                              label={t("platform.description")}
                              onChange={(v) => setEditForm((p) => ({ ...p, description: v }))}
                              value={editForm.description}
                            />
                            <Field
                              label={t("platform.country")}
                              onChange={(v) => setEditForm((p) => ({ ...p, country: v }))}
                              value={editForm.country}
                            />
                            <Field
                              label={t("admin.region")}
                              onChange={(v) => setEditForm((p) => ({ ...p, region: v }))}
                              value={editForm.region}
                            />
                            <Field
                              label={t("platform.address")}
                              onChange={(v) => setEditForm((p) => ({ ...p, address: v }))}
                              value={editForm.address}
                            />
                            <Field
                              label={t("admin.capacityKw")}
                              onChange={(v) => setEditForm((p) => ({ ...p, capacityKw: v }))}
                              value={editForm.capacityKw}
                            />
                            <Field
                              label={t("platform.expectedAnnualKwh")}
                              onChange={(v) => setEditForm((p) => ({ ...p, expectedAnnualKwh: v }))}
                              value={editForm.expectedAnnualKwh}
                            />
                            <Field
                              label={t("platform.expectedRevenue")}
                              onChange={(v) => setEditForm((p) => ({ ...p, expectedRevenue: v }))}
                              value={editForm.expectedRevenue}
                            />
                            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                              <button
                                className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:bg-zinc-400"
                                disabled={editMutation.isPending}
                                onClick={() => editMutation.mutate({ id: item.id, data: editForm })}
                                type="button"
                              >
                                {editMutation.isPending ? t("admin.saving") : t("platform.save")}
                              </button>
                              <button
                                className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-600 hover:border-zinc-900"
                                onClick={() => setEditingId(null)}
                                type="button"
                              >
                                {t("platform.cancel")}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
          {assets.data?.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              {t("platform.noAssetDrafts")}
            </p>
          ) : null}
        </Panel>

        <div className="space-y-5">
          <Panel title={t("platform.files")}>
            <div className="space-y-2">
              {(files.data?.items ?? []).slice(0, 6).map((item) => (
                <div
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  key={item.id}
                >
                  <p className="font-medium text-zinc-950 truncate">
                    {item.originalName || item.category}
                  </p>
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    {shortValue(item.cid || item.ipfsUri)}
                  </p>
                </div>
              ))}
              {(files.data?.items ?? []).length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-400">
                  {t("platform.noFiles")}
                </p>
              ) : null}
            </div>
          </Panel>
          <Panel title={t("platform.audit")}>
            <div className="space-y-2">
              {(auditLogs.data?.items ?? []).slice(0, 6).map((item) => (
                <div
                  className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  key={item.id}
                >
                  <p className="font-medium text-zinc-950 truncate">{item.action}</p>
                  <p className="mt-1 text-xs text-zinc-500 truncate">{item.summary}</p>
                </div>
              ))}
              {(auditLogs.data?.items ?? []).length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-400">
                  {t("platform.noAuditLogs")}
                </p>
              ) : null}
            </div>
          </Panel>
        </div>
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

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { useT } from "@/i18n";
import {
  burnCarbonCredits,
  burnGreenCertificate,
  depositRevenue,
  getCertificateIssuances,
  getStations,
  issueGreenCertificate,
  mintCarbonCredits,
  updateStationChainStatus,
  updateStationOperationStatus,
  updateStationReview,
} from "@/services/dashboard";

const fallbackAccount = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function TxResult({
  error,
  value,
}: {
  error?: Error | null;
  value?: string;
}) {
  const { t } = useT();
  if (error) {
    return (
      <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error.message}
      </p>
    );
  }
  if (!value) {
    return null;
  }
  return (
    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        {t("admin.submitted")}
      </p>
      <p className="mt-1 truncate font-mono text-xs text-emerald-800">{value}</p>
    </div>
  );
}

function Field({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <input
        className="mt-1 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function SelectField({
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      <select
        className="mt-1 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 disabled:opacity-50"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{options.length === 0 ? "—" : placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PrimaryButton({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      className="h-10 min-w-32 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
      disabled={disabled}
      type="submit"
    >
      {children}
    </button>
  );
}

function ActionCard({
  accent,
  children,
  detail,
  eyebrow,
  title,
}: {
  accent: "emerald" | "amber" | "sky" | "lime";
  children: ReactNode;
  detail: string;
  eyebrow: string;
  title: string;
}) {
  const accents = {
    amber: "border-t-amber-400",
    emerald: "border-t-emerald-500",
    lime: "border-t-lime-500",
    sky: "border-t-sky-500",
  };

  return (
    <article
      className={`rounded-lg border border-zinc-200 border-t-4 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow-md ${accents[accent]}`}
    >
      <div className="border-b border-zinc-100 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-lg font-semibold text-zinc-950">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600 min-h-[2.5rem]">{detail}</p>
      </div>
      <div className="p-5">{children}</div>
    </article>
  );
}

export function AdminConsole() {
  const { t } = useT();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const account: string = address ?? fallbackAccount;

  const [revenue, setRevenue] = useState({ amountEth: "0.25", stationId: "1" });
  const [carbon, setCarbon] = useState({
    account,
    amount: "100",
    evidenceUri: "ipfs://sunways/carbon/evidence",
    stationId: "1",
  });
  const [certificate, setCertificate] = useState({
    account,
    amount: "10",
    certificateType: "I-REC",
    evidenceUri: "ipfs://sunways/certificates/batch",
    period: "2026-Q2",
    stationId: "1",
  });
  const [review, setReview] = useState({
    note: "Initial review completed",
    stationId: "1",
    status: "approved",
  });
  const [operation, setOperation] = useState({
    note: "Running within expected range",
    stationId: "1",
    status: "normal",
    updatedBy: account,
    utilization: "86.4%",
  });
  const [burnCarbon, setBurnCarbon] = useState({ amount: "100" });
  const [chainStatus, setChainStatus] = useState({
    stationId: "1",
    status: "1",
  });
  const [burnCert, setBurnCert] = useState({
    amount: "1",
    certificateId: "",
  });

  const stationsQuery = useQuery({
    queryKey: ["stations"],
    queryFn: getStations,
    retry: false,
    refetchInterval: 10_000,
  });

  const stationIds = [
    ...new Set(
      (stationsQuery.data?.items ?? []).map((item) => item.stationId),
    ),
  ].sort((a, b) => a - b);

  const certIssuances = useQuery({
    queryKey: ["certificate-issuances"],
    queryFn: getCertificateIssuances,
    retry: false,
    refetchInterval: 10_000,
  });

  const certIds = [
    ...new Set(
      (certIssuances.data?.items ?? []).map((item) => item.certificateId),
    ),
  ].sort((a, b) => a - b);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["stations"] }),
      queryClient.invalidateQueries({ queryKey: ["station", 1] }),
      queryClient.invalidateQueries({ queryKey: ["revenue-deposits"] }),
      queryClient.invalidateQueries({ queryKey: ["carbon-issuances"] }),
      queryClient.invalidateQueries({ queryKey: ["certificate-issuances"] }),
      queryClient.invalidateQueries({ queryKey: ["indexer-status"] }),
      queryClient.invalidateQueries({ queryKey: ["station-operation-statuses"] }),
    ]);
  };

  const revenueMutation = useMutation({
    mutationFn: () =>
      depositRevenue({
        amountWei: parseEther(revenue.amountEth).toString(),
        stationId: Number(revenue.stationId),
      }),
    onSuccess: invalidate,
  });
  const carbonMutation = useMutation({
    mutationFn: () =>
      mintCarbonCredits({
        ...carbon,
        amount: parseEther(carbon.amount).toString(),
        stationId: Number(carbon.stationId),
      }),
    onSuccess: invalidate,
  });
  const certificateMutation = useMutation({
    mutationFn: () =>
      issueGreenCertificate({
        ...certificate,
        stationId: Number(certificate.stationId),
      }),
    onSuccess: invalidate,
  });
  const reviewMutation = useMutation({
    mutationFn: () =>
      updateStationReview(Number(review.stationId), {
        note: review.note,
        status: review.status,
      }),
    onSuccess: invalidate,
  });
  const operationMutation = useMutation({
    mutationFn: () =>
      updateStationOperationStatus(Number(operation.stationId), {
        note: operation.note,
        status: operation.status,
        updatedBy: operation.updatedBy,
        utilization: operation.utilization,
      }),
    onSuccess: invalidate,
  });
  const burnCarbonMutation = useMutation({
    mutationFn: () =>
      burnCarbonCredits({
        amount: parseEther(burnCarbon.amount).toString(),
      }),
    onSuccess: invalidate,
  });
  const chainStatusMutation = useMutation({
    mutationFn: () =>
      updateStationChainStatus(Number(chainStatus.stationId), {
        status: Number(chainStatus.status),
      }),
    onSuccess: invalidate,
  });
  const burnCertMutation = useMutation({
    mutationFn: () =>
      burnGreenCertificate({
        amount: burnCert.amount,
        certificateId: Number(burnCert.certificateId),
      }),
    onSuccess: invalidate,
  });

  const submit = (event: FormEvent<HTMLFormElement>, action: () => void) => {
    event.preventDefault();
    action();
  };

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 bg-zinc-950 px-5 py-5 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {t("admin.title")}
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{t("admin.heading")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300 min-h-[2.5rem]">
              {t("admin.description")}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {t("admin.operator")}
            </p>
            <p className="mt-1 font-mono text-sm text-white">
              {shortAddress(account)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 bg-zinc-50 p-5 xl:grid-cols-2">
        <ActionCard
          accent="sky"
          detail={t("admin.depositRevenueDetail")}
          eyebrow={t("admin.revenue")}
          title={t("admin.depositRevenue")}
        >
          <form
            onSubmit={(event) => submit(event, () => revenueMutation.mutate())}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label={t("admin.stationId")}
                onChange={(stationId) =>
                  setRevenue((value) => ({ ...value, stationId }))
                }
                options={stationIds.map((id) => ({ label: `#${id}`, value: String(id) }))}
                placeholder={t("admin.selectStation")}
                value={revenue.stationId}
              />
              <Field
                label={t("admin.amountEth")}
                onChange={(amountEth) =>
                  setRevenue((value) => ({ ...value, amountEth }))
                }
                value={revenue.amountEth}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">{t("admin.createsVaultTx")}</p>
              <PrimaryButton disabled={revenueMutation.isPending}>
                {revenueMutation.isPending ? t("admin.submitting") : t("admin.deposit")}
              </PrimaryButton>
            </div>
            <TxResult
              error={revenueMutation.error}
              value={revenueMutation.data?.txHash}
            />
          </form>
        </ActionCard>

        <ActionCard
          accent="lime"
          detail={t("admin.mintCarbonCreditsDetail")}
          eyebrow={t("admin.carbon")}
          title={t("admin.mintCarbonCredits")}
        >
          <form onSubmit={(event) => submit(event, () => carbonMutation.mutate())}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={t("wallet.account")}
                onChange={(next) =>
                  setCarbon((value) => ({ ...value, account: next }))
                }
                value={carbon.account}
              />
              <SelectField
                label={t("admin.stationId")}
                onChange={(stationId) =>
                  setCarbon((value) => ({ ...value, stationId }))
                }
                options={stationIds.map((id) => ({ label: `#${id}`, value: String(id) }))}
                placeholder={t("admin.selectStation")}
                value={carbon.stationId}
              />
              <Field
                label={t("admin.amountSwc")}
                onChange={(amount) =>
                  setCarbon((value) => ({ ...value, amount }))
                }
                value={carbon.amount}
              />
              <Field
                label={t("admin.evidenceUri")}
                onChange={(evidenceUri) =>
                  setCarbon((value) => ({ ...value, evidenceUri }))
                }
                value={carbon.evidenceUri}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">{t("admin.mintsErc20")}</p>
              <PrimaryButton disabled={carbonMutation.isPending}>
                {carbonMutation.isPending ? t("admin.submitting") : t("admin.mint")}
              </PrimaryButton>
            </div>
            <TxResult
              error={carbonMutation.error}
              value={carbonMutation.data?.txHash}
            />
          </form>
        </ActionCard>

        <ActionCard
          accent="amber"
          detail={t("admin.issueGreenCertificateDetail")}
          eyebrow={t("admin.certificates")}
          title={t("admin.issueGreenCertificate")}
        >
          <form
            onSubmit={(event) =>
              submit(event, () => certificateMutation.mutate())
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={t("wallet.account")}
                onChange={(next) =>
                  setCertificate((value) => ({ ...value, account: next }))
                }
                value={certificate.account}
              />
              <SelectField
                label={t("admin.stationId")}
                onChange={(stationId) =>
                  setCertificate((value) => ({ ...value, stationId }))
                }
                options={stationIds.map((id) => ({ label: `#${id}`, value: String(id) }))}
                placeholder={t("admin.selectStation")}
                value={certificate.stationId}
              />
              <Field
                label={t("admin.amount")}
                onChange={(amount) =>
                  setCertificate((value) => ({ ...value, amount }))
                }
                value={certificate.amount}
              />
              <Field
                label={t("admin.type")}
                onChange={(certificateType) =>
                  setCertificate((value) => ({ ...value, certificateType }))
                }
                value={certificate.certificateType}
              />
              <Field
                label={t("admin.period")}
                onChange={(period) =>
                  setCertificate((value) => ({ ...value, period }))
                }
                value={certificate.period}
              />
              <Field
                label={t("admin.evidenceUri")}
                onChange={(evidenceUri) =>
                  setCertificate((value) => ({ ...value, evidenceUri }))
                }
                value={certificate.evidenceUri}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">{t("admin.issuesErc1155")}</p>
              <PrimaryButton disabled={certificateMutation.isPending}>
                {certificateMutation.isPending ? t("admin.submitting") : t("admin.issue")}
              </PrimaryButton>
            </div>
            <TxResult
              error={certificateMutation.error}
              value={certificateMutation.data?.txHash}
            />
          </form>
        </ActionCard>

        <ActionCard
          accent="sky"
          detail={t("admin.reviewStationDetail")}
          eyebrow={t("admin.review")}
          title={t("admin.reviewStation")}
        >
          <form onSubmit={(event) => submit(event, () => reviewMutation.mutate())}>
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField
                label={t("admin.stationId")}
                onChange={(stationId) =>
                  setReview((value) => ({ ...value, stationId }))
                }
                options={stationIds.map((id) => ({ label: `#${id}`, value: String(id) }))}
                placeholder={t("admin.selectStation")}
                value={review.stationId}
              />
              <Field
                label={t("common.status")}
                onChange={(status) =>
                  setReview((value) => ({ ...value, status }))
                }
                value={review.status}
              />
              <Field
                label={t("admin.note")}
                onChange={(note) => setReview((value) => ({ ...value, note }))}
                value={review.note}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">{t("admin.noChainTx")}</p>
              <PrimaryButton disabled={reviewMutation.isPending}>
                {reviewMutation.isPending ? t("admin.saving") : t("admin.saveReview")}
              </PrimaryButton>
            </div>
            <TxResult error={reviewMutation.error} />
          </form>
        </ActionCard>

        <ActionCard
          accent="amber"
          detail={t("admin.burnCarbonCreditsDetail")}
          eyebrow={t("admin.carbon")}
          title={t("admin.burnCarbonCredits")}
        >
          <form
            onSubmit={(event) =>
              submit(event, () => burnCarbonMutation.mutate())
            }
          >
            <div className="grid gap-3">
              <Field
                label={t("admin.amountSwc")}
                onChange={(amount) =>
                  setBurnCarbon((value) => ({ ...value, amount }))
                }
                value={burnCarbon.amount}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">
                {t("admin.mintsErc20")}
              </p>
              <PrimaryButton disabled={burnCarbonMutation.isPending}>
                {burnCarbonMutation.isPending ? t("admin.submitting") : t("admin.burn")}
              </PrimaryButton>
            </div>
            <TxResult
              error={burnCarbonMutation.error}
              value={burnCarbonMutation.data?.txHash}
            />
          </form>
        </ActionCard>

        <ActionCard
          accent="amber"
          detail={t("admin.burnGreenCertificateDetail")}
          eyebrow={t("admin.certificates")}
          title={t("admin.burnGreenCertificate")}
        >
          <form
            onSubmit={(event) =>
              submit(event, () => burnCertMutation.mutate())
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("admin.certificateId")}
                </span>
                <select
                  className="mt-1 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                  onChange={(event) =>
                    setBurnCert((value) => ({
                      ...value,
                      certificateId: event.target.value,
                    }))
                  }
                  value={burnCert.certificateId}
                >
                  <option value="">{certIds.length === 0 ? "—" : "Select..."}</option>
                  {certIds.map((id) => (
                    <option key={id} value={String(id)}>
                      #{id}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label={t("admin.amount")}
                onChange={(amount) =>
                  setBurnCert((value) => ({ ...value, amount }))
                }
                value={burnCert.amount}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">{t("admin.burnsErc1155")}</p>
              <PrimaryButton disabled={burnCertMutation.isPending || !burnCert.certificateId}>
                {burnCertMutation.isPending ? t("admin.submitting") : t("admin.burn")}
              </PrimaryButton>
            </div>
            <TxResult
              error={burnCertMutation.error}
              value={burnCertMutation.data?.txHash}
            />
          </form>
        </ActionCard>

        <ActionCard
          accent="emerald"
          detail={t("admin.updateStationChainStatusDetail")}
          eyebrow={t("admin.asset")}
          title={t("admin.updateStationChainStatus")}
        >
          <form
            onSubmit={(event) =>
              submit(event, () => chainStatusMutation.mutate())
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label={t("admin.stationId")}
                onChange={(stationId) =>
                  setChainStatus((value) => ({ ...value, stationId }))
                }
                options={stationIds.map((id) => ({ label: `#${id}`, value: String(id) }))}
                placeholder={t("admin.selectStation")}
                value={chainStatus.stationId}
              />
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("admin.chainStatus")}
                </span>
                <select
                  className="mt-1 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-950 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                  onChange={(event) =>
                    setChainStatus((value) => ({
                      ...value,
                      status: event.target.value,
                    }))
                  }
                  value={chainStatus.status}
                >
                  <option value="0">{t("admin.statusPending")} (0)</option>
                  <option value="1">{t("admin.statusActive")} (1)</option>
                  <option value="2">{t("admin.statusSuspended")} (2)</option>
                  <option value="3">{t("admin.statusRetired")} (3)</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">{t("admin.refreshesHealth")}</p>
              <PrimaryButton disabled={chainStatusMutation.isPending}>
                {chainStatusMutation.isPending
                  ? t("admin.submitting")
                  : t("admin.updateStatus")}
              </PrimaryButton>
            </div>
            <TxResult
              error={chainStatusMutation.error}
              value={chainStatusMutation.data?.txHash}
            />
          </form>
        </ActionCard>

        <ActionCard
          accent="emerald"
          detail={t("admin.updateOperationStatusDetail")}
          eyebrow={t("admin.operations")}
          title={t("admin.updateOperationStatus")}
        >
          <form
            onSubmit={(event) => submit(event, () => operationMutation.mutate())}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label={t("admin.stationId")}
                onChange={(stationId) =>
                  setOperation((value) => ({ ...value, stationId }))
                }
                options={stationIds.map((id) => ({ label: `#${id}`, value: String(id) }))}
                placeholder={t("admin.selectStation")}
                value={operation.stationId}
              />
              <Field
                label={t("common.status")}
                onChange={(status) =>
                  setOperation((value) => ({ ...value, status }))
                }
                value={operation.status}
              />
              <Field
                label={t("admin.utilization")}
                onChange={(utilization) =>
                  setOperation((value) => ({ ...value, utilization }))
                }
                value={operation.utilization}
              />
              <Field
                label={t("admin.updatedBy")}
                onChange={(updatedBy) =>
                  setOperation((value) => ({ ...value, updatedBy }))
                }
                value={operation.updatedBy}
              />
              <div className="sm:col-span-2">
                <Field
                  label={t("admin.note")}
                  onChange={(note) =>
                    setOperation((value) => ({ ...value, note }))
                  }
                  value={operation.note}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">{t("admin.refreshesHealth")}</p>
              <PrimaryButton disabled={operationMutation.isPending}>
                {operationMutation.isPending ? t("admin.saving") : t("admin.saveStatus")}
              </PrimaryButton>
            </div>
            <TxResult error={operationMutation.error} />
          </form>
        </ActionCard>
      </div>
    </section>
  );
}

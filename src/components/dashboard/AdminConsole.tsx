import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import {
  depositRevenue,
  issueGreenCertificate,
  mintCarbonCredits,
  registerStation,
  updateStationOperationStatus,
  updateStationReview,
} from "@/services/dashboard";

const fallbackAccount = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

function toUnixDate(value: string) {
  return Math.floor(new Date(`${value}T00:00:00Z`).getTime() / 1000);
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function TxResult({ error, value }: { error?: Error | null; value?: string }) {
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
        Submitted
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
        <p className="mt-2 text-sm leading-6 text-zinc-600">{detail}</p>
      </div>
      <div className="p-5">{children}</div>
    </article>
  );
}

export function AdminConsole() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const account: string = address ?? fallbackAccount;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [station, setStation] = useState({
    capacityKw: "3000",
    commissionedAt: today,
    metadataUri: "ipfs://sunways/stations/new",
    name: "Sunways New Solar Station",
    owner: account,
    region: "Jiangsu, CN",
  });
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

  const stationMutation = useMutation({
    mutationFn: () =>
      registerStation({
        ...station,
        commissionedAt: toUnixDate(station.commissionedAt),
      }),
    onSuccess: invalidate,
  });
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
              Admin Console
            </p>
            <h2 className="mt-1 text-2xl font-semibold">Chain Operations</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
              Submit station, revenue, carbon, and certificate actions to the
              local chain, then let the indexer synchronize them back into the
              dashboard.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Operator
            </p>
            <p className="mt-1 font-mono text-sm text-white">
              {shortAddress(account)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 bg-zinc-50 p-5 xl:grid-cols-2">
        <ActionCard
          accent="emerald"
          detail="Create a new ERC-721 station identity with owner, capacity, and metadata."
          eyebrow="Asset"
          title="Register Station"
        >
          <form
            onSubmit={(event) => submit(event, () => stationMutation.mutate())}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Owner"
                onChange={(owner) =>
                  setStation((value) => ({ ...value, owner }))
                }
                value={station.owner}
              />
              <Field
                label="Name"
                onChange={(name) => setStation((value) => ({ ...value, name }))}
                value={station.name}
              />
              <Field
                label="Region"
                onChange={(region) =>
                  setStation((value) => ({ ...value, region }))
                }
                value={station.region}
              />
              <Field
                label="Capacity kW"
                onChange={(capacityKw) =>
                  setStation((value) => ({ ...value, capacityKw }))
                }
                value={station.capacityKw}
              />
              <Field
                label="Commissioned"
                onChange={(commissionedAt) =>
                  setStation((value) => ({ ...value, commissionedAt }))
                }
                type="date"
                value={station.commissionedAt}
              />
              <Field
                label="Metadata URI"
                onChange={(metadataUri) =>
                  setStation((value) => ({ ...value, metadataUri }))
                }
                value={station.metadataUri}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">Mints a new station NFT.</p>
              <PrimaryButton disabled={stationMutation.isPending}>
                {stationMutation.isPending ? "Submitting" : "Register"}
              </PrimaryButton>
            </div>
            <TxResult
              error={stationMutation.error}
              value={stationMutation.data?.txHash}
            />
          </form>
        </ActionCard>

        <ActionCard
          accent="sky"
          detail="Send native token revenue into the station vault and expose it to the indexed activity feed."
          eyebrow="Revenue"
          title="Deposit Revenue"
        >
          <form
            onSubmit={(event) => submit(event, () => revenueMutation.mutate())}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Station ID"
                onChange={(stationId) =>
                  setRevenue((value) => ({ ...value, stationId }))
                }
                value={revenue.stationId}
              />
              <Field
                label="Amount ETH"
                onChange={(amountEth) =>
                  setRevenue((value) => ({ ...value, amountEth }))
                }
                value={revenue.amountEth}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">Creates a payable vault tx.</p>
              <PrimaryButton disabled={revenueMutation.isPending}>
                {revenueMutation.isPending ? "Submitting" : "Deposit"}
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
          detail="Mint carbon credits to an account with station evidence for later verification."
          eyebrow="Carbon"
          title="Mint Carbon Credits"
        >
          <form onSubmit={(event) => submit(event, () => carbonMutation.mutate())}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Account"
                onChange={(next) =>
                  setCarbon((value) => ({ ...value, account: next }))
                }
                value={carbon.account}
              />
              <Field
                label="Station ID"
                onChange={(stationId) =>
                  setCarbon((value) => ({ ...value, stationId }))
                }
                value={carbon.stationId}
              />
              <Field
                label="Amount SWC"
                onChange={(amount) =>
                  setCarbon((value) => ({ ...value, amount }))
                }
                value={carbon.amount}
              />
              <Field
                label="Evidence URI"
                onChange={(evidenceUri) =>
                  setCarbon((value) => ({ ...value, evidenceUri }))
                }
                value={carbon.evidenceUri}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">Mints ERC-20 credits.</p>
              <PrimaryButton disabled={carbonMutation.isPending}>
                {carbonMutation.isPending ? "Submitting" : "Mint"}
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
          detail="Issue a green certificate batch for a station period and recipient."
          eyebrow="Certificates"
          title="Issue Green Certificate"
        >
          <form
            onSubmit={(event) =>
              submit(event, () => certificateMutation.mutate())
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Account"
                onChange={(next) =>
                  setCertificate((value) => ({ ...value, account: next }))
                }
                value={certificate.account}
              />
              <Field
                label="Station ID"
                onChange={(stationId) =>
                  setCertificate((value) => ({ ...value, stationId }))
                }
                value={certificate.stationId}
              />
              <Field
                label="Amount"
                onChange={(amount) =>
                  setCertificate((value) => ({ ...value, amount }))
                }
                value={certificate.amount}
              />
              <Field
                label="Type"
                onChange={(certificateType) =>
                  setCertificate((value) => ({ ...value, certificateType }))
                }
                value={certificate.certificateType}
              />
              <Field
                label="Period"
                onChange={(period) =>
                  setCertificate((value) => ({ ...value, period }))
                }
                value={certificate.period}
              />
              <Field
                label="Evidence URI"
                onChange={(evidenceUri) =>
                  setCertificate((value) => ({ ...value, evidenceUri }))
                }
                value={certificate.evidenceUri}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">Issues ERC-1155 supply.</p>
              <PrimaryButton disabled={certificateMutation.isPending}>
                {certificateMutation.isPending ? "Submitting" : "Issue"}
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
          detail="Update database-side review state for operational workflows."
          eyebrow="Review"
          title="Review Station"
        >
          <form onSubmit={(event) => submit(event, () => reviewMutation.mutate())}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="Station ID"
                onChange={(stationId) =>
                  setReview((value) => ({ ...value, stationId }))
                }
                value={review.stationId}
              />
              <Field
                label="Status"
                onChange={(status) =>
                  setReview((value) => ({ ...value, status }))
                }
                value={review.status}
              />
              <Field
                label="Note"
                onChange={(note) => setReview((value) => ({ ...value, note }))}
                value={review.note}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">No chain tx required.</p>
              <PrimaryButton disabled={reviewMutation.isPending}>
                {reviewMutation.isPending ? "Saving" : "Save Review"}
              </PrimaryButton>
            </div>
            <TxResult error={reviewMutation.error} />
          </form>
        </ActionCard>

        <ActionCard
          accent="emerald"
          detail="Record live operating state such as normal, warning, utilization, and operator note."
          eyebrow="Operations"
          title="Update Operation Status"
        >
          <form
            onSubmit={(event) => submit(event, () => operationMutation.mutate())}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Station ID"
                onChange={(stationId) =>
                  setOperation((value) => ({ ...value, stationId }))
                }
                value={operation.stationId}
              />
              <Field
                label="Status"
                onChange={(status) =>
                  setOperation((value) => ({ ...value, status }))
                }
                value={operation.status}
              />
              <Field
                label="Utilization"
                onChange={(utilization) =>
                  setOperation((value) => ({ ...value, utilization }))
                }
                value={operation.utilization}
              />
              <Field
                label="Updated By"
                onChange={(updatedBy) =>
                  setOperation((value) => ({ ...value, updatedBy }))
                }
                value={operation.updatedBy}
              />
              <div className="sm:col-span-2">
                <Field
                  label="Note"
                  onChange={(note) =>
                    setOperation((value) => ({ ...value, note }))
                  }
                  value={operation.note}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">Refreshes station health.</p>
              <PrimaryButton disabled={operationMutation.isPending}>
                {operationMutation.isPending ? "Saving" : "Save Status"}
              </PrimaryButton>
            </div>
            <TxResult error={operationMutation.error} />
          </form>
        </ActionCard>
      </div>
    </section>
  );
}

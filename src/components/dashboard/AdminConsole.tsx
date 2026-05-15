import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import {
  depositRevenue,
  issueGreenCertificate,
  mintCarbonCredits,
  updateStationOperationStatus,
  registerStation,
  updateStationReview,
} from "@/services/dashboard";

const fallbackAccount = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

function toUnixDate(value: string) {
  return Math.floor(new Date(`${value}T00:00:00Z`).getTime() / 1000);
}

function TxResult({ value }: { value?: string }) {
  if (!value) {
    return null;
  }
  return (
    <p className="mt-3 truncate rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono text-xs text-emerald-700">
      {value}
    </p>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-600">{label}</span>
      <input
        className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-900"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

export function AdminConsole() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const account: string = address ?? fallbackAccount;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [station, setStation] = useState({
    owner: account,
    name: "Sunways New Solar Station",
    region: "Jiangsu, CN",
    capacityKw: "3000",
    commissionedAt: today,
    metadataUri: "ipfs://sunways/stations/new",
  });
  const [revenue, setRevenue] = useState({ stationId: "1", amountEth: "0.25" });
  const [carbon, setCarbon] = useState({
    account,
    stationId: "1",
    amount: "100",
    evidenceUri: "ipfs://sunways/carbon/evidence",
  });
  const [certificate, setCertificate] = useState({
    account,
    stationId: "1",
    amount: "10",
    certificateType: "I-REC",
    period: "2026-Q2",
    evidenceUri: "ipfs://sunways/certificates/batch",
  });
  const [review, setReview] = useState({
    stationId: "1",
    status: "approved",
    note: "Initial review completed",
  });
  const [operation, setOperation] = useState({
    stationId: "1",
    status: "normal",
    utilization: "86.4%",
    note: "Running within expected range",
    updatedBy: account,
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
        stationId: Number(revenue.stationId),
        amountWei: parseEther(revenue.amountEth).toString(),
      }),
    onSuccess: invalidate,
  });
  const carbonMutation = useMutation({
    mutationFn: () =>
      mintCarbonCredits({
        ...carbon,
        stationId: Number(carbon.stationId),
        amount: parseEther(carbon.amount).toString(),
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
        status: review.status,
        note: review.note,
      }),
    onSuccess: invalidate,
  });
  const operationMutation = useMutation({
    mutationFn: () =>
      updateStationOperationStatus(Number(operation.stationId), {
        status: operation.status,
        utilization: operation.utilization,
        note: operation.note,
        updatedBy: operation.updatedBy,
      }),
    onSuccess: invalidate,
  });

  const submit = (
    event: FormEvent<HTMLFormElement>,
    action: () => void,
  ) => {
    event.preventDefault();
    action();
  };

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Admin
        </p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-950">
          Chain Operations
        </h2>
      </div>

      <div className="grid gap-6 p-5 xl:grid-cols-2">
        <form
          className="rounded-lg border border-zinc-200 p-4"
          onSubmit={(event) => submit(event, () => stationMutation.mutate())}
        >
          <h3 className="text-base font-semibold text-zinc-950">
            Register Station
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label="Owner"
              onChange={(owner) => setStation((value) => ({ ...value, owner }))}
              value={station.owner}
            />
            <Field
              label="Name"
              onChange={(name) => setStation((value) => ({ ...value, name }))}
              value={station.name}
            />
            <Field
              label="Region"
              onChange={(region) => setStation((value) => ({ ...value, region }))}
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
          <button
            className="mt-4 h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={stationMutation.isPending}
            type="submit"
          >
            {stationMutation.isPending ? "Submitting" : "Register"}
          </button>
          <TxResult value={stationMutation.data?.txHash} />
        </form>

        <form
          className="rounded-lg border border-zinc-200 p-4"
          onSubmit={(event) => submit(event, () => revenueMutation.mutate())}
        >
          <h3 className="text-base font-semibold text-zinc-950">
            Deposit Revenue
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          <button
            className="mt-4 h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={revenueMutation.isPending}
            type="submit"
          >
            {revenueMutation.isPending ? "Submitting" : "Deposit"}
          </button>
          <TxResult value={revenueMutation.data?.txHash} />
        </form>

        <form
          className="rounded-lg border border-zinc-200 p-4"
          onSubmit={(event) => submit(event, () => carbonMutation.mutate())}
        >
          <h3 className="text-base font-semibold text-zinc-950">
            Mint Carbon Credits
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label="Account"
              onChange={(next) => setCarbon((value) => ({ ...value, account: next }))}
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
              onChange={(amount) => setCarbon((value) => ({ ...value, amount }))}
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
          <button
            className="mt-4 h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={carbonMutation.isPending}
            type="submit"
          >
            {carbonMutation.isPending ? "Submitting" : "Mint"}
          </button>
          <TxResult value={carbonMutation.data?.txHash} />
        </form>

        <form
          className="rounded-lg border border-zinc-200 p-4"
          onSubmit={(event) => submit(event, () => certificateMutation.mutate())}
        >
          <h3 className="text-base font-semibold text-zinc-950">
            Issue Green Certificate
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
          <button
            className="mt-4 h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={certificateMutation.isPending}
            type="submit"
          >
            {certificateMutation.isPending ? "Submitting" : "Issue"}
          </button>
          <TxResult value={certificateMutation.data?.txHash} />
        </form>

        <form
          className="rounded-lg border border-zinc-200 p-4"
          onSubmit={(event) => submit(event, () => reviewMutation.mutate())}
        >
          <h3 className="text-base font-semibold text-zinc-950">
            Review Station
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field
              label="Station ID"
              onChange={(stationId) => setReview((value) => ({ ...value, stationId }))}
              value={review.stationId}
            />
            <Field
              label="Status"
              onChange={(status) => setReview((value) => ({ ...value, status }))}
              value={review.status}
            />
            <Field
              label="Note"
              onChange={(note) => setReview((value) => ({ ...value, note }))}
              value={review.note}
            />
          </div>
          <button
            className="mt-4 h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={reviewMutation.isPending}
            type="submit"
          >
            {reviewMutation.isPending ? "Saving" : "Save Review"}
          </button>
        </form>

        <form
          className="rounded-lg border border-zinc-200 p-4"
          onSubmit={(event) => submit(event, () => operationMutation.mutate())}
        >
          <h3 className="text-base font-semibold text-zinc-950">
            Update Operation Status
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
            <Field
              label="Note"
              onChange={(note) => setOperation((value) => ({ ...value, note }))}
              value={operation.note}
            />
          </div>
          <button
            className="mt-4 h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={operationMutation.isPending}
            type="submit"
          >
            {operationMutation.isPending ? "Saving" : "Save Status"}
          </button>
        </form>
      </div>
    </section>
  );
}

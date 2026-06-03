import { type ChangeEvent, type DragEvent, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useT } from "@/i18n";
import {
  generateAssetMetadata,
  getAssetDrafts,
  getAssetFiles,
  updateAssetDraftStatus,
  uploadFileToFilebase,
} from "@/services/dashboard";

const FILE_CATEGORIES = [
  { value: "asset_image", label: "Asset Image" },
  { value: "business_license", label: "Business License" },
  { value: "property_proof", label: "Property Proof" },
  { value: "grid_connection", label: "Grid Connection" },
  { value: "equipment_list", label: "Equipment List" },
  { value: "generation_data", label: "Generation Data" },
  { value: "revenue_proof", label: "Revenue Proof" },
  { value: "audit_report", label: "Audit Report" },
  { value: "green_cert_proof", label: "Green Cert Proof" },
  { value: "carbon_proof", label: "Carbon Proof" },
  { value: "general", label: "General" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortCid(cid: string): string {
  if (!cid || cid.length <= 16) return cid || "N/A";
  return `${cid.slice(0, 8)}...${cid.slice(-6)}`;
}

export function FileCenter() {
  const { t } = useT();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploadNote, setUploadNote] = useState("");

  const { data: drafts } = useQuery({
    queryKey: ["platform-assets"],
    queryFn: () => getAssetDrafts(),
  });

  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ["platform-files", selectedDraftId],
    queryFn: () => getAssetFiles(selectedDraftId || undefined),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", selectedCategory || "general");
      formData.append("assetDraftId", String(selectedDraftId || ""));
      formData.append("organizationId", "1");
      formData.append("uploader", "console");
      return uploadFileToFilebase(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-files"] });
      setUploadNote(t("platform.fileCenter.uploadSuccess"));
    },
    onError: (err: Error) => {
      setUploadNote(t("platform.fileCenter.uploadFailed", { message: err.message }));
    },
  });

  const handleFile = (file: File) => {
    setUploadNote(`${t("platform.fileCenter.uploading")} ${file.name} (${formatSize(file.size)})...`);
    uploadMutation.mutate(file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    if (event.target) event.target.value = "";
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const filteredFiles = useMemo(() => {
    const fileItems = files?.items ?? [];
    if (!selectedCategory) return fileItems;
    return fileItems.filter((f) => f.category === selectedCategory);
  }, [files?.items, selectedCategory]);

  const metadataMutation = useMutation({
    mutationFn: async (draftId: number) => {
      const data = await generateAssetMetadata(draftId);
      if (data.metadataUri) {
        await updateAssetDraftStatus(draftId, {
          actor: "console",
          note: `Metadata uploaded to ${data.metadataUri}`,
          status: "metadata_ready",
        });
      }
      return data;
    },
    onSuccess: (data) => {
      setUploadNote(
        t("platform.fileCenter.metadataGenerated", { uri: data.metadataUri || "local only" }),
      );
      queryClient.invalidateQueries({ queryKey: ["platform-assets"] });
    },
    onError: (err: Error) => {
      setUploadNote(t("platform.fileCenter.metadataError", { message: err.message }));
    },
  });

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-zinc-500">
            {t("platform.fileCenter.assetDraft")}
          </label>
          <select
            className="mt-1 h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950"
            onChange={(event) =>
              setSelectedDraftId(Number(event.target.value))
            }
            value={selectedDraftId}
          >
            <option value={0}>{t("platform.fileCenter.allDrafts")}</option>
            {(drafts?.items ?? []).map((draft) => (
              <option key={draft.id} value={draft.id}>
                #{draft.id} {draft.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-zinc-500">
            {t("platform.fileCenter.category")}
          </label>
          <select
            className="mt-1 h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950"
            onChange={(event) => setSelectedCategory(event.target.value)}
            value={selectedCategory}
          >
            <option value="">{t("platform.fileCenter.allCategories")}</option>
            {FILE_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        {selectedDraftId > 0 ? (
          <button
            className="mt-5 h-10 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-zinc-400"
            disabled={metadataMutation.isPending}
            onClick={() => metadataMutation.mutate(selectedDraftId)}
            type="button"
          >
            {metadataMutation.isPending ? t("platform.fileCenter.generating") : t("platform.fileCenter.generateMetadata")}
          </button>
        ) : null}
      </div>

      <div
        className={`relative rounded-lg border-2 border-dashed p-10 text-center transition ${
          dragOver
            ? "border-zinc-950 bg-zinc-100"
            : "border-zinc-300 bg-zinc-50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          accept="*"
          aria-label="Upload file"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />
        <p className="text-sm font-medium text-zinc-600">
          {uploadMutation.isPending
            ? t("platform.fileCenter.uploading")
            : `${t("platform.fileCenter.dropHere")}${
                selectedDraftId ? t("platform.fileCenter.forDraft", { id: selectedDraftId }) : ""
              }`}
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          {t("platform.fileCenter.ipfsNote")}
        </p>
        {uploadNote ? (
          <p className="mt-3 text-sm font-medium text-zinc-700">
            {uploadNote}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">{t("platform.fileCenter.file")}</th>
              <th className="px-4 py-3">{t("platform.fileCenter.category")}</th>
              <th className="px-4 py-3">{t("platform.fileCenter.draft")}</th>
              <th className="px-4 py-3">{t("platform.fileCenter.size")}</th>
              <th className="px-4 py-3">{t("platform.fileCenter.cid")}</th>
              <th className="px-4 py-3">{t("platform.fileCenter.uploaded")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filesLoading ? (
              <tr>
                <td className="px-4 py-6 text-center text-zinc-400" colSpan={6}>
                  {t("platform.fileCenter.loadingFiles")}
                </td>
              </tr>
            ) : filteredFiles.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-zinc-400" colSpan={6}>
                  {selectedDraftId
                    ? t("platform.fileCenter.noFilesDraft")
                    : t("platform.fileCenter.noFiles")}
                </td>
              </tr>
            ) : (
              filteredFiles.map((file) => (
                <tr key={file.id}>
                  <td className="px-4 py-3 font-medium text-zinc-950">
                    {file.originalName}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                      {file.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    #{file.assetDraftId}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatSize(file.sizeBytes)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                    {file.gatewayUrl ? (
                      <a
                        className="text-zinc-950 underline"
                        href={file.gatewayUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {shortCid(file.cid)}
                      </a>
                    ) : (
                      shortCid(file.cid)
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(file.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

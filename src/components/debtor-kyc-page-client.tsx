"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  FileBadge2,
  LoaderCircle,
  PenSquare,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import type { MobileDebtorKycPayload } from "@/lib/mobile-debtor-kyc";

type UploadResponse = {
  ok: boolean;
  debtor: {
    id: string;
    name: string;
    detailHref: string;
  };
  kyc: {
    idFrontUrl: string;
    photoUrl: string;
    signatureUrl: string;
    idFront: boolean;
    photo: boolean;
    signature: boolean;
    isVerified: boolean;
  };
};

type BannerState = { tone: "success" | "warning" | "danger" | "info"; text: string } | null;

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function previewSrc(src: string | null | undefined, fallback = "/man-placeholder.svg") {
  return src || fallback;
}

export function DebtorKycPageClient({ initialPayload }: { initialPayload: MobileDebtorKycPayload }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);
  const [payload, setPayload] = useState<MobileDebtorKycPayload>(initialPayload);
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [idFrontPreview, setIdFrontPreview] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  const idFrontInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const debtor = payload.debtor;

  const uploadedCount =
    Number(Boolean(idFrontFile || debtor.kyc.idFront)) +
    Number(Boolean(photoFile || debtor.kyc.photo)) +
    Number(Boolean(signatureFile || debtor.kyc.signature));

  const onFileSelected = (type: "idFront" | "photo" | "signature", file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setBanner({ tone: "warning", text: "Each file must be 10MB or smaller." });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const nextPreview = typeof reader.result === "string" ? reader.result : null;
      if (type === "idFront") {
        setIdFrontFile(file);
        setIdFrontPreview(nextPreview);
      }
      if (type === "photo") {
        setPhotoFile(file);
        setPhotoPreview(nextPreview);
      }
      if (type === "signature") {
        setSignatureFile(file);
        setSignaturePreview(nextPreview);
      }
    };
    reader.readAsDataURL(file);
  };

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!idFrontFile && !photoFile && !signatureFile) {
      setBanner({ tone: "warning", text: "Choose at least one KYC file before uploading." });
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      if (idFrontFile) form.append("idFront", idFrontFile);
      if (photoFile) form.append("photo", photoFile);
      if (signatureFile) form.append("signature", signatureFile);

      const response = await fetch(`/api/mobile/debtors/${debtor.id}/kyc`, {
        method: "POST",
        body: form,
      });
      const body = (await response.json().catch(() => null)) as UploadResponse | { error?: string } | null;
      if (!response.ok) {
        throw new Error((body && "error" in body && body.error) || "Failed to upload KYC");
      }

      const next = body as UploadResponse;
      setPayload({
        debtor: {
          id: next.debtor.id,
          name: next.debtor.name,
          detailHref: next.debtor.detailHref || debtor.detailHref,
          approvalStatus: debtor.approvalStatus,
          kyc: next.kyc,
        },
      });
      setIdFrontFile(null);
      setPhotoFile(null);
      setSignatureFile(null);
      setIdFrontPreview(null);
      setPhotoPreview(null);
      setSignaturePreview(null);
      setBanner({
        tone: "success",
        text: `${next.debtor.name}'s KYC pack was updated successfully.`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to upload KYC";
      setBanner({ tone: "danger", text: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 pb-4">
      <input ref={idFrontInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFileSelected("idFront", e.target.files?.[0] || null)} />
      <input ref={photoInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onFileSelected("photo", e.target.files?.[0] || null)} />
      <input ref={signatureInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFileSelected("signature", e.target.files?.[0] || null)} />

      <section className="mobile-panel px-4 py-4">
        <Link href={debtor.detailHref} className="mobile-text-secondary inline-flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft size={16} />
          Back to debtor detail
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mobile-section-label">KYC management</p>
            <h2 className="mobile-text-primary mt-1 text-[1.3rem] font-semibold">{debtor.name}</h2>
            <p className="mobile-text-secondary mt-1.5 text-sm">Debtor approval: {statusLabel(debtor.approvalStatus)}</p>
          </div>
          <div className="mobile-inline-surface min-w-[92px] px-3 py-2 text-right">
            <p className="mobile-text-tertiary text-[10px] uppercase tracking-[0.16em]">KYC readiness</p>
            <p className="mobile-text-primary mt-1 text-xl font-semibold">{uploadedCount}/3</p>
          </div>
        </div>

        <div className="mobile-inline-surface mt-4 px-4 py-4">
          <p className="mobile-text-secondary text-sm leading-relaxed">
            Capture or replace missing proof directly from the field. Once all three items exist, the debtor is automatically marked as verified.
          </p>
        </div>
      </section>

      {banner ? (
        <section className={`mobile-panel px-4 py-4 ${
          banner.tone === "success"
            ? "border-emerald-700/12 bg-emerald-500/8"
            : banner.tone === "warning"
              ? "border-amber-700/12 bg-amber-500/10"
              : banner.tone === "danger"
                ? "border-rose-700/14 bg-rose-500/10"
                : "mobile-surface-subtle"
        }`}>
          <p className="mobile-text-primary text-sm leading-relaxed">{banner.text}</p>
        </section>
      ) : null}

      <form onSubmit={upload} className="space-y-3">
        <section className="mobile-panel px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mobile-section-label">Capture board</p>
              <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">Identity pack</h3>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${debtor.kyc.isVerified ? "bg-emerald-500/12 text-emerald-900 dark:text-emerald-200" : "bg-amber-500/12 text-amber-900 dark:text-amber-200"}`}>
              {debtor.kyc.isVerified ? "Verified" : "Incomplete"}
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            <KycCard
              label="ID Front"
              description="National ID front or equivalent proof"
              status={idFrontFile ? "Ready to upload" : debtor.kyc.idFront ? "Uploaded" : "Missing"}
              preview={idFrontPreview}
              existing={debtor.kyc.idFrontUrl}
              fallbackIcon={<FileBadge2 size={30} className="mobile-text-tertiary" />}
              buttonLabel={idFrontFile || debtor.kyc.idFront ? "Replace ID Front" : "Upload ID Front"}
              onClick={() => idFrontInputRef.current?.click()}
            />

            <KycCard
              label="Photo"
              description="Live borrower portrait from the field"
              status={photoFile ? "Ready to upload" : debtor.kyc.photo ? "Uploaded" : "Missing"}
              preview={photoPreview}
              existing={debtor.kyc.photoUrl}
              fallbackIcon={<Camera size={30} className="mobile-text-tertiary" />}
              buttonLabel={photoFile || debtor.kyc.photo ? "Replace Photo" : "Capture Photo"}
              onClick={() => photoInputRef.current?.click()}
            />

            <KycCard
              label="Signature"
              description="Borrower signature capture or signed proof"
              status={signatureFile ? "Ready to upload" : debtor.kyc.signature ? "Uploaded" : "Missing"}
              preview={signaturePreview}
              existing={debtor.kyc.signatureUrl}
              fallbackIcon={<PenSquare size={30} className="mobile-text-tertiary" />}
              buttonLabel={signatureFile || debtor.kyc.signature ? "Replace Signature" : "Upload Signature"}
              onClick={() => signatureInputRef.current?.click()}
            />
          </div>
        </section>

        <section className="mobile-panel-strong px-4 py-4">
          <p className="mobile-section-label">Readiness summary</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MiniState label="ID Front" ready={Boolean(idFrontFile || debtor.kyc.idFront)} />
            <MiniState label="Photo" ready={Boolean(photoFile || debtor.kyc.photo)} />
            <MiniState label="Signature" ready={Boolean(signatureFile || debtor.kyc.signature)} />
          </div>
          <p className="mobile-text-secondary mt-4 text-sm leading-relaxed">
            {uploadedCount === 3
              ? "All required KYC items are present. Uploading now will keep the debtor ready for standard loan review."
              : "Any missing item can be added now. The debtor will automatically move into verified status once all three are available."}
          </p>
        </section>

        <section className="mobile-panel px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mobile-section-label">Sync to Daily+</p>
              <h3 className="mobile-text-primary mt-1 text-[1rem] font-semibold">Update debtor KYC</h3>
              <p className="mobile-text-secondary mt-2 text-sm leading-relaxed">
                This writes directly into the shared Daily+ backend and refreshes the verification state for the debtor record.
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/14 dark:text-emerald-300">
              <ShieldCheck size={18} />
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="mobile-inline-action flex-1 justify-center disabled:opacity-45"
            >
              {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Upload KYC
            </button>
            <button
              type="button"
              onClick={() => router.push(debtor.detailHref)}
              className="mobile-inline-action-secondary"
            >
              Done
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}

function KycCard({
  label,
  description,
  status,
  preview,
  existing,
  fallbackIcon,
  buttonLabel,
  onClick,
}: {
  label: string;
  description: string;
  status: string;
  preview: string | null;
  existing: string | null;
  fallbackIcon: React.ReactNode;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="mobile-panel-strong px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mobile-text-primary text-sm font-semibold">{label}</p>
          <p className="mobile-text-secondary mt-1 text-xs leading-relaxed">{description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${status === "Missing" ? "bg-amber-500/12 text-amber-900 dark:text-amber-200" : "bg-emerald-500/12 text-emerald-900 dark:text-emerald-200"}`}>
          {status}
        </span>
      </div>

      <div className="mobile-inline-surface mt-4 overflow-hidden rounded-[20px] border">
        {preview || existing ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc(preview || existing)} alt={label} className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center">{fallbackIcon}</div>
        )}
      </div>

      <button
        type="button"
        onClick={onClick}
        className="mobile-inline-action mt-4 w-full justify-center"
      >
        <UploadCloud size={16} />
        {buttonLabel}
      </button>
    </div>
  );
}

function MiniState({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className={`rounded-[18px] px-3 py-4 text-center ${ready ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200" : "bg-stone-900/6 text-stone-600 dark:bg-white/5 dark:text-white/68"}`}>
      <p className="text-[10px] uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-2 text-sm font-semibold">{ready ? "Ready" : "Missing"}</p>
    </div>
  );
}

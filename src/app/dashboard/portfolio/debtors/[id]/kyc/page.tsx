"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  FileBadge2,
  LoaderCircle,
  PenSquare,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

type KycResponse = {
  debtor?: {
    id: string;
    name: string;
    approvalStatus: string;
    kyc: {
      idFrontUrl: string | null;
      photoUrl: string | null;
      signatureUrl: string | null;
      idFront: boolean;
      photo: boolean;
      signature: boolean;
      isVerified: boolean;
    };
  } | null;
};

type UploadResponse = {
  ok: boolean;
  debtor: {
    id: string;
    name: string;
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

export default function DebtorKycPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const debtorId = params?.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);
  const [payload, setPayload] = useState<KycResponse | null>(null);
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [idFrontPreview, setIdFrontPreview] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  const idFrontInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!debtorId) return;
      setLoading(true);
      try {
        const nextPayload = await fetchJson<KycResponse>(`/api/mobile/debtors/${debtorId}/kyc`);
        if (!mounted) return;
        setPayload(nextPayload);
        setBanner(null);
      } catch (error: unknown) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "Failed to load debtor KYC";
        setPayload(null);
        setBanner({ tone: "danger", text: message });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [debtorId]);

  const debtor = payload?.debtor;

  const uploadedCount =
    Number(Boolean(idFrontFile || debtor?.kyc.idFront)) +
    Number(Boolean(photoFile || debtor?.kyc.photo)) +
    Number(Boolean(signatureFile || debtor?.kyc.signature));

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
    if (!debtorId) return;
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

      const response = await fetch(`/api/mobile/debtors/${debtorId}/kyc`, {
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
          approvalStatus: debtor?.approvalStatus || "approved",
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

  if (loading) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <LoaderCircle size={22} className="mx-auto animate-spin text-emerald-700" />
          <p className="mt-3 text-sm text-stone-600">Loading KYC workspace...</p>
        </section>
      </div>
    );
  }

  if (!debtor) {
    return (
      <div className="space-y-4 pb-4">
        <section className="mobile-panel px-5 py-6 text-center">
          <p className="text-base font-semibold text-[#14213d]">KYC workspace is unavailable.</p>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{banner?.text || "This debtor could not be prepared for KYC capture."}</p>
          <Link href="/dashboard/portfolio" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#14213d] px-4 py-3 text-sm font-semibold text-white">
            <ArrowLeft size={16} />
            Back to portfolio
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <input ref={idFrontInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFileSelected("idFront", e.target.files?.[0] || null)} />
      <input ref={photoInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onFileSelected("photo", e.target.files?.[0] || null)} />
      <input ref={signatureInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFileSelected("signature", e.target.files?.[0] || null)} />

      <section className="mobile-panel-ink px-5 py-5 text-white">
        <Link href={`/dashboard/portfolio/debtors/${debtor.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-white/72">
          <ArrowLeft size={16} />
          Back to debtor detail
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Collector field verification</p>
            <h2 className="mt-1 text-[1.9rem] font-semibold">{debtor.name}</h2>
            <p className="mt-2 text-sm text-white/72">Debtor approval: {statusLabel(debtor.approvalStatus)}</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/8 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/58">KYC readiness</p>
            <p className="mt-1 text-xl font-semibold">{uploadedCount}/3</p>
          </div>
        </div>

        <div className="mt-5 rounded-[22px] bg-white/10 px-4 py-4 text-sm text-white/78">
          Capture or replace missing proof directly from the field. Once all three items exist, the debtor is automatically marked as verified.
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
                : "border-stone-900/8 bg-white/72"
        }`}>
          <p className="text-sm leading-relaxed text-stone-800">{banner.text}</p>
        </section>
      ) : null}

      <form onSubmit={upload} className="space-y-4">
        <section className="mobile-panel px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Capture board</p>
              <h3 className="mt-1 text-lg font-semibold text-[#14213d]">Identity pack</h3>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${debtor.kyc.isVerified ? "bg-emerald-500/12 text-emerald-900" : "bg-amber-500/12 text-amber-900"}`}>
              {debtor.kyc.isVerified ? "Verified" : "Incomplete"}
            </span>
          </div>

          <div className="mt-4 grid gap-4">
            <KycCard
              label="ID Front"
              description="National ID front or equivalent proof"
              status={idFrontFile ? "Ready to upload" : debtor.kyc.idFront ? "Uploaded" : "Missing"}
              preview={idFrontPreview}
              existing={debtor.kyc.idFrontUrl}
              fallbackIcon={<FileBadge2 size={30} className="text-stone-400" />}
              buttonLabel={idFrontFile || debtor.kyc.idFront ? "Replace ID Front" : "Upload ID Front"}
              onClick={() => idFrontInputRef.current?.click()}
            />

            <KycCard
              label="Photo"
              description="Live borrower portrait from the field"
              status={photoFile ? "Ready to upload" : debtor.kyc.photo ? "Uploaded" : "Missing"}
              preview={photoPreview}
              existing={debtor.kyc.photoUrl}
              fallbackIcon={<Camera size={30} className="text-stone-400" />}
              buttonLabel={photoFile || debtor.kyc.photo ? "Replace Photo" : "Capture Photo"}
              onClick={() => photoInputRef.current?.click()}
            />

            <KycCard
              label="Signature"
              description="Borrower signature capture or signed proof"
              status={signatureFile ? "Ready to upload" : debtor.kyc.signature ? "Uploaded" : "Missing"}
              preview={signaturePreview}
              existing={debtor.kyc.signatureUrl}
              fallbackIcon={<PenSquare size={30} className="text-stone-400" />}
              buttonLabel={signatureFile || debtor.kyc.signature ? "Replace Signature" : "Upload Signature"}
              onClick={() => signatureInputRef.current?.click()}
            />
          </div>
        </section>

        <section className="mobile-panel-strong px-5 py-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">Readiness summary</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MiniState label="ID Front" ready={Boolean(idFrontFile || debtor.kyc.idFront)} />
            <MiniState label="Photo" ready={Boolean(photoFile || debtor.kyc.photo)} />
            <MiniState label="Signature" ready={Boolean(signatureFile || debtor.kyc.signature)} />
          </div>
          <p className="mt-4 text-sm text-stone-600">
            {uploadedCount === 3
              ? "All required KYC items are present. Uploading now will keep the debtor ready for standard loan review."
              : "Any missing item can be added now. The debtor will automatically move into verified status once all three are available."}
          </p>
        </section>

        <section className="mobile-panel-ink px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/80">Sync to Daily+</p>
              <h3 className="mt-1 text-lg font-semibold">Update debtor KYC</h3>
              <p className="mt-2 text-sm text-white/72">
                This writes directly into the shared Daily+ backend and refreshes the verification state for the debtor record.
              </p>
            </div>
            <ShieldCheck size={18} className="text-white/70" />
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#fff7eb] px-5 py-3 text-sm font-semibold text-[#14213d] disabled:opacity-45"
            >
              {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Upload KYC
            </button>
            <button
              type="button"
              onClick={() => router.push(`/dashboard/portfolio/debtors/${debtor.id}`)}
              className="inline-flex items-center justify-center rounded-full border border-white/12 px-5 py-3 text-sm font-semibold text-white/88"
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
    <div className="rounded-[26px] border border-stone-900/8 bg-white/72 px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#14213d]">{label}</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">{description}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${status === "Missing" ? "bg-amber-500/12 text-amber-900" : "bg-emerald-500/12 text-emerald-900"}`}>
          {status}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-[22px] border border-stone-900/8 bg-stone-100">
        {preview || existing ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc(preview || existing)} alt={label} className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center bg-stone-100">{fallbackIcon}</div>
        )}
      </div>

      <button
        type="button"
        onClick={onClick}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#14213d] px-4 py-3 text-sm font-semibold text-white"
      >
        <UploadCloud size={16} />
        {buttonLabel}
      </button>
    </div>
  );
}

function MiniState({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className={`rounded-[20px] px-3 py-4 text-center ${ready ? "bg-emerald-500/10 text-emerald-900" : "bg-stone-900/6 text-stone-600"}`}>
      <p className="text-[10px] uppercase tracking-[0.16em]">{label}</p>
      <p className="mt-2 text-sm font-semibold">{ready ? "Ready" : "Missing"}</p>
    </div>
  );
}

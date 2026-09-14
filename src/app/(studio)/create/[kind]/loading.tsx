export default function CreateGenerationLoading() {
  return <div className="flex min-h-[calc(100vh-220px)] items-center justify-center rounded-3xl border border-[#eaded6] bg-[#fffdfb] p-8" aria-busy="true" role="status">
    <div className="flex items-center gap-3 text-sm font-semibold text-[#6f625b]">
      <span className="size-4 animate-spin rounded-full border-2 border-[#f26b38] border-r-transparent" />
      กำลังเปิดเครื่องมือสร้าง…
    </div>
  </div>;
}

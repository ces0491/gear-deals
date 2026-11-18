import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <h1 className="narrow text-4xl font-extrabold">Not here</h1>
      <p className="mt-3 text-lg text-ink-muted">
        There&rsquo;s no page at this address. A product drops off when its store stops listing it.
      </p>
      <p className="mt-6">
        <Link href="/" className="rounded bg-ink px-4 py-2 font-semibold text-surface">
          See today&rsquo;s deals
        </Link>
      </p>
    </div>
  );
}

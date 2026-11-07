import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        The page you requested could not be found.
      </p>
      <Link href="/" className="font-medium underline underline-offset-4">
        Go home
      </Link>
    </main>
  );
}

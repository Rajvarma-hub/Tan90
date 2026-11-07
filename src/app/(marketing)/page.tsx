import { siteConfig } from "@/config/site";

export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">
        {siteConfig.name}
      </h1>
      <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        {siteConfig.description}
      </p>
    </section>
  );
}

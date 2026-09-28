import { createFileRoute } from "@tanstack/react-router";
import { seoHead } from "@/lib/seo";
import Homepage from "./-home";

export const Route = createFileRoute("/")({
  head: () => {
    const head = seoHead({
      title: "lawn — video review for creative teams",
      description:
        "Self-hosted video review for your team. Frame-accurate comments, version stacks and share links on Laravel Cloud.",
      path: "/",
    });

    return {
      ...head,
      links: [
        ...head.links,
        {
          rel: "preload",
          href: "/grassy-bg.avif",
          as: "image",
          type: "image/avif",
          fetchPriority: "high" as const,
        },
      ],
    };
  },
  component: Homepage,
});

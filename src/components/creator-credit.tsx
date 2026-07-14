import Image from "next/image";
import { ExternalLink } from "lucide-react";

const CREATOR_URL = "https://github.com/GenichiMaruo";

export function CreatorCredit() {
  return (
    <footer className="mt-10 flex justify-end border-t border-border/70 pt-5">
      <a
        aria-label="制作者 GenichiMaruo のGitHubプロフィールを開く"
        className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card/75 py-2 pr-3.5 pl-2 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        href={CREATOR_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Image
          alt="GenichiMaruoのアイコン"
          className="size-11 rounded-xl border border-border/70 bg-white object-cover"
          height={88}
          src="/creator-genichi-maruo.png"
          width={88}
        />
        <span className="min-w-0">
          <span className="block text-[0.62rem] font-black tracking-[0.16em] text-muted-foreground uppercase">
            Created by
          </span>
          <span className="mt-0.5 block text-sm font-extrabold tracking-tight text-foreground group-hover:text-primary">
            GenichiMaruo
          </span>
        </span>
        <ExternalLink
          aria-hidden="true"
          className="ml-1 size-4 text-muted-foreground group-hover:text-primary"
        />
      </a>
    </footer>
  );
}

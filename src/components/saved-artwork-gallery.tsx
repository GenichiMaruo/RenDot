"use client";

import { ImagePlus, Images, Pencil, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getColor, getColorModeDefinition, type SavedArtwork } from "@/lib";

type SavedArtworkGalleryProps = {
  artworks: readonly SavedArtwork[];
  currentSavedId: string | null;
  onSave: () => void;
  onLoad: (artwork: SavedArtwork) => void;
  onDelete: (id: string) => void;
};

function ArtworkPreview({ artwork }: { artwork: SavedArtwork }) {
  return (
    <div className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-xl border-2 border-border bg-white shadow-sm">
      {artwork.grid.flat().map((color, index) => (
        <span
          key={index}
          aria-hidden="true"
          style={{ backgroundColor: getColor(color, artwork.colorMode).hex }}
        />
      ))}
    </div>
  );
}

export function SavedArtworkGallery({
  artworks,
  currentSavedId,
  onSave,
  onLoad,
  onDelete,
}: SavedArtworkGalleryProps) {
  const atLimit = artworks.length >= 8;
  const alreadySaved = currentSavedId !== null;
  const saveLabel = alreadySaved ? "この絵は保存済み" : atLimit ? "保存は8枚まで" : "現在の絵を保存";

  return (
    <Card className="mt-4">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Images className="size-5 text-primary" aria-hidden="true" />
            <CardTitle>保存した作品</CardTitle>
            <Badge variant="secondary">{artworks.length} / 8</Badge>
          </div>
          <Button
            type="button"
            onClick={onSave}
            disabled={alreadySaved || atLimit}
            aria-label={saveLabel}
            title={saveLabel}
          >
            <ImagePlus aria-hidden="true" />
            {saveLabel}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {artworks.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-background/50 px-4 py-6 text-center text-sm font-bold text-muted-foreground">
            保存した作品はまだありません。
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {artworks.map((artwork, index) => {
              const title = `保存作品 ${index + 1}`;
              const isCurrent = artwork.id === currentSavedId;
              return (
                <article key={artwork.id} className="rounded-2xl border bg-background/60 p-3">
                  <ArtworkPreview artwork={artwork} />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{title}</p>
                      <p className="truncate text-xs font-bold text-muted-foreground">
                        {getColorModeDefinition(artwork.colorMode).name}
                      </p>
                      {isCurrent ? <Badge variant="success" className="mt-1">編集中</Badge> : null}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" size="icon" variant="ghost" aria-label={`${title}を削除`} title={`${title}を削除`}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{title}を削除しますか？</AlertDialogTitle>
                          <AlertDialogDescription>
                            保存作品から削除します。現在編集中の絵は変更されません。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>残す</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDelete(artwork.id)}>削除する</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <Button type="button" variant="secondary" className="mt-3 w-full" onClick={() => onLoad(artwork)} disabled={isCurrent}>
                    <Pencil aria-hidden="true" />
                    {isCurrent ? "編集中" : "この絵を編集"}
                  </Button>
                </article>
              );
            })}
          </div>
        )}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          保存作品はこの端末に残り、「最初からやり直す」では削除されません。
        </p>
      </CardContent>
    </Card>
  );
}

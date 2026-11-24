import type { useRouter } from "expo-router";

type PushRouter = Pick<ReturnType<typeof useRouter>, "push">;

// Opening a member's profile card (src/app/community/profile/[userId].tsx) from a tapped name.
//
// From a plain screen it is one navigation. From a sheet or modal (comments) it must NOT close the modal and navigate in the same burst: two native
// transitions at once has crashed this app before. So close first, then navigate once the modal has finished dismissing.

const MODAL_DISMISS_MS = 350;

export function openProfile(router: PushRouter, userId: string): void {
  if (!userId) return;
  router.push({ pathname: "/community/profile/[userId]", params: { userId } });
}

export function openProfileFromModal(router: PushRouter, userId: string, closeModal: () => void, delayMs: number = MODAL_DISMISS_MS): void {
  if (!userId) return;
  closeModal();
  setTimeout(() => openProfile(router, userId), delayMs);
}

/** Cross-page navigation without threading callbacks through the tree */
export const NAV_PAGE_EVENT = 'sharp-inventory:nav-page';

export function navigateAppPage(page: string): void {
  window.dispatchEvent(new CustomEvent(NAV_PAGE_EVENT, { detail: { page } }));
}

export type SceneHostResolution = {
  backHost: HTMLElement | null;
  backBefore: HTMLElement | null;
  frontHost: HTMLElement | null;
  frontBefore: HTMLElement | null;
};

function asHTMLElement(element: Element | null): HTMLElement | null {
  return element instanceof HTMLElement ? element : null;
}

/** Match a class or CSS-module name without mistaking chatColumnInner for chatColumn. */
function closestByClassName(start: Element | null, name: string): HTMLElement | null {
  const pattern = new RegExp(`(?:^|[^a-zA-Z0-9])${name}(?:$|[^a-zA-Z0-9])`);
  for (let element = start; element; element = element.parentElement) {
    if ([...element.classList].some((className) => pattern.test(className))) return asHTMLElement(element);
  }
  return null;
}

export function resolveSceneHosts(root: Pick<Document, "querySelector"> = document): SceneHostResolution {
  const scrollRegion = asHTMLElement(root.querySelector('[data-chat-scroll="true"]'));
  const chatView = asHTMLElement(scrollRegion?.closest('[data-component="ChatView"]') ?? null);
  const sceneScope = chatView ?? root;
  const backgroundLayer = asHTMLElement(sceneScope.querySelector('[class*="sceneBackgroundLayer"]'));
  const sceneTextLayer = asHTMLElement(sceneScope.querySelector('[class*="sceneTextContextLayer"]'));
  const sceneHost = backgroundLayer?.parentElement ?? chatView;
  const chatColumnInner =
    asHTMLElement(scrollRegion?.closest('[data-lumiverse-surface="chat-column-inner"]') ?? null) ??
    closestByClassName(scrollRegion, "chatColumnInner");
  const chatColumn =
    asHTMLElement(scrollRegion?.closest('[data-lumiverse-surface="chat-column"]') ?? null) ??
    closestByClassName(scrollRegion, "chatColumn");
  const chatBody =
    asHTMLElement(scrollRegion?.closest('[data-lumiverse-surface="chat-body"]') ?? null) ??
    chatColumn?.parentElement ?? null;

  return {
    // A background image layer can be transparent; mount beside it, below the scrim.
    backHost: sceneHost ?? backgroundLayer,
    backBefore: sceneTextLayer?.parentElement === sceneHost ? sceneTextLayer : null,
    // The body includes portrait tabs/panels and spans the entire scene. Both
    // columns can be narrower, leaving a hard cutoff at the message area's edge.
    frontHost: chatBody ?? chatColumn ?? chatColumnInner ?? scrollRegion,
    frontBefore: null,
  };
}

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { resolveSceneHosts, type SceneHostResolution } from "./scene-hosts";

// A small element tree supplies the DOM traversal APIs used by host selection.
// Actual coverage dimensions are verified separately in a browser fixture.
class TestElement {
  parentElement: TestElement | null = null;
  children: TestElement[] = [];
  constructor(readonly className = "", readonly attrs: Record<string, string> = {}) {}
  get classList() { return this.className.split(/\s+/).filter(Boolean); }
  append(...children: TestElement[]) {
    children.forEach((child) => { child.parentElement = this; this.children.push(child); });
  }
  matches(selector: string): boolean {
    const attribute = selector.match(/^\[([^=\]]+?)(\*?)="([^"]*)"\]$/);
    if (!attribute) throw new Error(`Unsupported test selector: ${selector}`);
    const value = attribute[1] === "class" ? this.className : this.attrs[attribute[1]];
    return value !== undefined && (attribute[2] ? value.includes(attribute[3]) : value === attribute[3]);
  }
  closest(selector: string): TestElement | null {
    for (let element: TestElement | null = this; element; element = element.parentElement) {
      if (element.matches(selector)) return element;
    }
    return null;
  }
  querySelector(selector: string): TestElement | null {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

const previousHTMLElement = globalThis.HTMLElement;
beforeAll(() => { globalThis.HTMLElement = TestElement as unknown as typeof HTMLElement; });
afterAll(() => { globalThis.HTMLElement = previousHTMLElement; });

function resolve(root: TestElement) {
  return resolveSceneHosts(root as unknown as Document) as unknown as {
    [Key in keyof SceneHostResolution]: TestElement | null;
  };
}

function fixture(stableSurfaces = true, scopedClasses = true) {
  const name = (value: string) => scopedClasses ? `_ChatView_${value}_abc123` : value;
  const surface = (value: string): Record<string, string> => stableSurfaces ? { "data-lumiverse-surface": value } : {};
  const documentRoot = new TestElement();
  const view = new TestElement(name("container"), { "data-component": "ChatView" });
  const background = new TestElement(name("sceneBackgroundLayer"));
  const scrim = new TestElement(name("sceneTextContextLayer"));
  const body = new TestElement(name("body"), surface("chat-body"));
  const column = new TestElement(name("chatColumn"), surface("chat-column"));
  const inner = new TestElement(name("chatColumnInner"), surface("chat-column-inner"));
  const scroll = new TestElement("scroll", { "data-chat-scroll": "true" });
  const portrait = new TestElement(name("portraitSideRight"));
  documentRoot.append(view); view.append(background, scrim, body);
  body.append(column, portrait); column.append(inner); inner.append(scroll);
  return { documentRoot, view, background, scrim, body, column, inner, scroll, portrait, resolve: () => resolve(documentRoot) };
}

describe("weather scene hosts", () => {
  test("front effects cover the body including the right portrait gutter", () => {
    const layout = fixture();
    expect(layout.resolve()).toEqual({
      backHost: layout.view, backBefore: layout.scrim,
      frontHost: layout.body, frontBefore: null,
    });
  });

  test("front effects stay full width with a left portrait panel and constrained messages", () => {
    const layout = fixture();
    layout.body.children.reverse();
    layout.body.attrs["data-chat-constrained"] = "";
    expect(layout.resolve().frontHost).toBe(layout.body);
    expect(layout.resolve().frontHost).not.toBe(layout.inner);
  });

  test.each([true, false])("legacy surfaces distinguish outer and inner columns (scoped classes: %s)", (scoped) => {
    const layout = fixture(false, scoped);
    expect(layout.resolve().frontHost).toBe(layout.body);
  });

  test("background lookup stays within the chat view when another panel has a scene layer", () => {
    const layout = fixture();
    const unrelated = new TestElement();
    unrelated.append(new TestElement("sceneBackgroundLayer"), new TestElement("sceneTextContextLayer"));
    layout.documentRoot.children.unshift(unrelated);
    expect(layout.resolve().backHost).toBe(layout.view);
    expect(layout.resolve().backBefore).toBe(layout.scrim);
  });

  test("missing scene hosts safely fall back to the message scroll region", () => {
    const root = new TestElement();
    const scroll = new TestElement("scroll", { "data-chat-scroll": "true" });
    root.append(scroll);
    expect(resolve(root)).toEqual({
      backHost: null, backBefore: null, frontHost: scroll, frontBefore: null,
    });
  });
});

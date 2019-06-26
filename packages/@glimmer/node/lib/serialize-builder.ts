import {
  NewElementBuilder,
  ElementBuilder,
  Bounds,
  ConcreteBounds,
  Environment,
  Cursor,
  ModifierManager,
} from '@glimmer/runtime';

import { Simple, Option, Opaque } from '@glimmer/interfaces';

const TEXT_NODE = 3;

function currentNode(
  cursor: ElementBuilder | { element: Simple.Element; nextSibling: Simple.Node }
): Option<Simple.Node> {
  let { element, nextSibling } = cursor;

  if (nextSibling === null) {
    return element.lastChild;
  } else {
    return nextSibling.previousSibling;
  }
}

class SerializeBuilder extends NewElementBuilder implements ElementBuilder {
  private serializeBlockDepth = 0;

  __openBlock(): void {
    if (this.element.tagName !== 'TITLE') {
      let depth = this.serializeBlockDepth++;
      this.__appendComment(`%+b:${depth}%`);
    }

    super.__openBlock();
  }

  __closeBlock(): void {
    super.__closeBlock();

    if (this.element.tagName !== 'TITLE') {
      let depth = --this.serializeBlockDepth;
      this.__appendComment(`%-b:${depth}%`);
    }
  }

  __appendHTML(html: string): Bounds {
    // Do we need to run the html tokenizer here?
    let first = this.__appendComment('%glmr%');
    if (this.element.tagName === 'TABLE') {
      let openIndex = html.indexOf('<');
      if (openIndex > -1) {
        let tr = html.slice(openIndex + 1, openIndex + 3);
        if (tr === 'tr') {
          html = `<tbody>${html}</tbody>`;
        }
      }
    }
    if (html === '') {
      this.__appendComment('% %');
    } else {
      super.__appendHTML(html);
    }

    let last = this.__appendComment('%glmr%');
    return new ConcreteBounds(this.element, first, last);
  }

  __appendText(string: string): Simple.Text {
    let current = currentNode(this);

    if (string === '') {
      return (this.__appendComment('% %') as any) as Simple.Text;
    } else if (current && current.nodeType === TEXT_NODE) {
      this.__appendComment('%|%');
    }

    return super.__appendText(string);
  }

  closeElement(): Option<[ModifierManager<Opaque, Opaque>, Opaque][]> {
    if (this.element['needsExtraClose'] === true) {
      this.element['needsExtraClose'] = false;
      super.closeElement();
    }

    return super.closeElement();
  }

  openElement(tag: string) {
    if (tag === 'tr') {
      if (
        this.element.tagName !== 'TBODY' &&
        this.element.tagName !== 'THEAD' &&
        this.element.tagName !== 'TFOOT'
      ) {
        this.openElement('tbody');
        // This prevents the closeBlock comment from being re-parented
        // under the auto inserted tbody. Rehydration builder needs to
        // account for the insertion since it is injected here and not
        // really in the template.
        this.constructing!['needsExtraClose'] = true;
        this.flushElement(null);
      }
    }

    return super.openElement(tag);
  }

  pushRemoteElement(
    element: Simple.Element,
    cursorId: string,
    nextSibling: Option<Simple.Node> = null
  ) {
    let { dom } = this;
    let script = dom.createElement('script');
    script.setAttribute('glmr', cursorId);
    dom.insertBefore(element, script, nextSibling);
    super.pushRemoteElement(element, cursorId, nextSibling);
  }
}

export function serializeBuilder(env: Environment, cursor: Cursor): ElementBuilder {
  return SerializeBuilder.forInitialRender(env, cursor);
}

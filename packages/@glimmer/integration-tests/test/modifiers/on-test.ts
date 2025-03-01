import { castToBrowser, expect, HAS_NATIVE_PROXY } from '@glimmer/util';
import { getInternalModifierManager } from '@glimmer/manager';
import { on } from '@glimmer/runtime';

import { jitSuite, RenderTest, test } from '../..';

// check if window exists and actually is the global
const hasDom =
  typeof self === 'object' &&
  self !== null &&
  (self as Window['self']).Object === Object &&
  typeof Window !== 'undefined' &&
  self.constructor === Window &&
  typeof document === 'object' &&
  document !== null &&
  self.document === document &&
  typeof location === 'object' &&
  location !== null &&
  self.location === location &&
  typeof history === 'object' &&
  history !== null &&
  self.history === history &&
  typeof navigator === 'object' &&
  navigator !== null &&
  self.navigator === navigator &&
  typeof navigator.userAgent === 'string';

// do this to get around type issues for these values
let global = window as any;
const isChrome = hasDom
  ? typeof global.chrome === 'object' && !(typeof global.opera === 'object')
  : false;
const isFirefox = hasDom ? typeof global.InstallTrigger !== 'undefined' : false;
const isIE11 = !global.ActiveXObject && 'ActiveXObject' in window;

interface Counters {
  adds: number;
  removes: number;
}

interface OnManager {
  counters: Counters;
  SUPPORTS_EVENT_OPTIONS: boolean;
}

function getOnManager() {
  return (getInternalModifierManager(on) as unknown) as OnManager;
}

if (hasDom) {
  class OnTest extends RenderTest {
    static suiteName = '{{on}} Modifier';

    startingCounters: Counters = { adds: 0, removes: 0 };

    findButton(selector = 'button'): HTMLButtonElement {
      return expect(
        castToBrowser(this.element, 'div').querySelector(selector) as HTMLButtonElement,
        `BUG: expected to find ${selector}`
      );
    }

    beforeEach() {
      // might error if getOnManagerInstance fails
      this.startingCounters = getOnManager().counters;
    }

    assertCounts(expected: Counters) {
      this.assert.deepEqual(
        getOnManager().counters,
        {
          adds: expected.adds + this.startingCounters.adds,
          removes: expected.removes + this.startingCounters.removes,
        },
        `counters have incremented by ${JSON.stringify(expected)}`
      );
    }

    @test
    'SUPPORTS_EVENT_OPTIONS is correct (private API usage)'(assert: Assert) {
      let { SUPPORTS_EVENT_OPTIONS } = getOnManager();

      if (isChrome || isFirefox) {
        assert.strictEqual(SUPPORTS_EVENT_OPTIONS, true, 'is true in chrome and firefox');
      } else if (isIE11) {
        assert.strictEqual(SUPPORTS_EVENT_OPTIONS, false, 'is false in IE11');
      }
    }

    @test
    'it adds an event listener'(assert: Assert) {
      let count = 0;

      this.render('<button {{on "click" this.callback}}>Click Me</button>', {
        callback() {
          count++;
        },
      });

      assert.equal(count, 0, 'not called on initial render');

      this.assertStableRerender();
      this.assertCounts({ adds: 1, removes: 0 });
      assert.equal(count, 0, 'not called on a rerender');

      this.findButton().click();

      assert.equal(count, 1, 'has been called 1 time');

      this.findButton().click();

      assert.equal(count, 2, 'has been called 2 times');

      this.assertCounts({ adds: 1, removes: 0 });
    }

    @test
    'passes the event to the listener'(assert: Assert) {
      let event: UIEvent;

      this.render('<button {{on "click" this.callback}}>Click Me</button>', {
        callback(evt: UIEvent) {
          event = evt;
        },
      });

      let button = this.findButton();

      button.click();

      assert.strictEqual(event!.target, button, 'has a valid event with a target');

      this.assertCounts({ adds: 1, removes: 0 });
    }

    @test
    'the listener callback is bound'(assert: Assert) {
      let first = 0;
      let second = 0;
      let firstCallback = () => first++;
      let secondCallback = () => second++;

      this.render('<button {{on "click" this.callback}}>Click Me</button>', {
        callback: firstCallback,
      });

      let button = this.findButton();

      assert.equal(first, 0, 'precond - first not called on initial render');
      assert.equal(second, 0, 'precond - second not called on initial render');

      button.click();

      assert.equal(first, 1, 'first has been called 1 time');
      assert.equal(second, 0, 'second not called on initial render');

      this.rerender({ callback: secondCallback });

      button.click();

      assert.equal(first, 1, 'first has been called 1 time');
      assert.equal(second, 1, 'second has been called 1 times');

      this.assertCounts({ adds: 2, removes: 1 });
    }

    @test
    'setting once named argument ensures the callback is only called once'(assert: Assert) {
      let count = 0;

      this.render('<button {{on "click" this.callback once=true}}>Click Me</button>', {
        callback() {
          count++;
        },
      });

      let button = this.findButton();

      assert.equal(count, 0, 'not called on initial render');

      this.assertStableRerender();
      assert.equal(count, 0, 'not called on a rerender');

      button.click();

      assert.equal(count, 1, 'has been called 1 time');

      button.click();

      assert.equal(count, 1, 'has been called 1 times');

      if (isIE11) {
        this.assertCounts({ adds: 1, removes: 1 });
      } else {
        this.assertCounts({ adds: 1, removes: 0 });
      }
    }

    @test
    'changing from `once=false` to `once=true` ensures the callback can only be called once'(
      assert: Assert
    ) {
      let count = 0;

      this.render('<button {{on "click" this.callback once=this.once}}>Click Me</button>', {
        callback() {
          count++;
        },

        once: false,
      });

      let button = this.findButton();

      button.click();
      assert.equal(count, 1, 'has been called 1 time');

      button.click();
      assert.equal(count, 2, 'has been called 2 times');

      this.rerender({ once: true });

      button.click();
      assert.equal(count, 3, 'has been called 3 time');

      button.click();
      assert.equal(count, 3, 'is not called again');

      if (isIE11) {
        this.assertCounts({ adds: 2, removes: 2 });
      } else {
        this.assertCounts({ adds: 2, removes: 1 });
      }
    }

    @test
    'setting passive named argument prevents calling preventDefault'(assert: Assert) {
      let matcher = /You marked this listener as 'passive', meaning that you must not call 'event.preventDefault\(\)'/;

      this.render('<button {{on "click" this.callback passive=true}}>Click Me</button>', {
        callback(event: UIEvent) {
          assert.throws(() => {
            event.preventDefault();
          }, matcher);
        },
      });

      this.findButton().click();
    }

    @test
    'by default bubbling is used (capture: false)'(assert: Assert) {
      this.render(
        `
          <button class="outer" {{on 'click' this.handleOuterClick}}>
            <button class="inner" {{on 'click' this.handleInnerClick}}></button>
          </button>
        `,
        {
          handleOuterClick() {
            assert.step('outer clicked');
          },
          handleInnerClick() {
            assert.step('inner clicked');
          },
        }
      );

      this.findButton('.inner').click();

      assert.verifySteps(['inner clicked', 'outer clicked'], 'uses capture: false by default');
    }

    @test
    'specifying capture named argument uses capture semantics'(assert: Assert) {
      this.render(
        `
          <button class="outer" {{on 'click' this.handleOuterClick capture=true}}>
            <button class="inner" {{on 'click' this.handleInnerClick}}></button>
          </button>
        `,
        {
          handleOuterClick() {
            assert.step('outer clicked');
          },
          handleInnerClick() {
            assert.step('inner clicked');
          },
        }
      );

      this.findButton('.inner').click();

      assert.verifySteps(['outer clicked', 'inner clicked'], 'capture works');
    }

    @test
    'can use capture and once together'(assert: Assert) {
      this.render(
        `
          <button class="outer" {{on 'click' this.handleOuterClick once=true capture=true}}>
            <button class="inner" {{on 'click' this.handleInnerClick}}></button>
          </button>
        `,
        {
          handleOuterClick() {
            assert.step('outer clicked');
          },
          handleInnerClick() {
            assert.step('inner clicked');
          },
        }
      );

      this.findButton('.inner').click();

      assert.verifySteps(['outer clicked', 'inner clicked'], 'capture works');

      this.findButton('.inner').click();

      assert.verifySteps(['inner clicked'], 'once works');
    }

    @test
    'unrelated updates to `this` context does not result in removing + re-adding'(assert: Assert) {
      let called = false;

      this.render('<button {{on "click" this.callback}}>Click Me</button>', {
        callback() {
          called = true;
        },
        otherThing: 0,
      });

      this.assertCounts({ adds: 1, removes: 0 });

      this.findButton().click();

      assert.equal(called, 1, 'callback is being invoked');

      this.rerender({ otherThing: 1 });
      this.assertCounts({ adds: 1, removes: 0 });
    }

    @test
    'asserts when eventName is missing'(assert: Assert) {
      assert.throws(() => {
        this.render(`<button {{on undefined this.callback}}>Click Me</button>`, {
          callback() {},
        });
      }, /You must pass a valid DOM event name as the first argument to the `on` modifier/);
    }

    @test
    'asserts when eventName is a bound undefined value'(assert: Assert) {
      assert.throws(() => {
        this.render(`<button {{on this.someUndefinedThing this.callback}}>Click Me</button>`, {
          callback() {},
        });
      }, /You must pass a valid DOM event name as the first argument to the `on` modifier/);
    }

    @test
    'asserts when eventName is a function'(assert: Assert) {
      assert.throws(() => {
        this.render(`<button {{on this.callback}}>Click Me</button>`, {
          callback() {},
        });
      }, /You must pass a valid DOM event name as the first argument to the `on` modifier/);
    }

    @test
    'asserts when callback is missing'(assert: Assert) {
      assert.throws(() => {
        this.render(`<button {{on 'click'}}>Click Me</button>`);
      }, /You must pass a function as the second argument to the `on` modifier/);
    }

    @test
    'asserts when callback is undefined'(assert: Assert) {
      assert.throws(() => {
        this.render(`<button {{on 'click' this.foo}}>Click Me</button>`);
      }, /You must pass a function as the second argument to the `on` modifier; you passed undefined. While rendering:\n\nthis.foo/);
    }

    @test
    'asserts when callback is null'(assert: Assert) {
      assert.throws(() => {
        this.render(`<button {{on 'click' this.foo}}>Click Me</button>`, { foo: null });
      }, /You must pass a function as the second argument to the `on` modifier; you passed null. While rendering:\n\nthis.foo/);
    }

    @test
    'asserts if the provided callback accesses `this` without being bound prior to passing to on'(
      assert: Assert
    ) {
      this.render(`<button {{on 'click' this.myFunc}}>Click Me</button>`, {
        myFunc(this: any) {
          if (HAS_NATIVE_PROXY) {
            assert.throws(() => {
              // eslint-disable-next-line no-unused-expressions
              this.arg1;
            }, /You accessed `this.arg1` from a function passed to the `on` modifier, but the function itself was not bound to a valid `this` context. Consider updating to use a bound function/);
          } else {
            // IE11
            assert.strictEqual(this, null, 'this is null on browsers without native proxy support');
          }
        },

        arg1: 'foo',
      });

      this.findButton().click();
    }

    @test
    'asserts if more than 2 positional parameters are provided'(assert: Assert) {
      assert.throws(() => {
        this.render(`<button {{on 'click' this.callback this.someArg}}>Click Me</button>`, {
          callback() {},
          someArg: 'foo',
        });
      }, /You can only pass two positional arguments \(event name and callback\) to the `on` modifier, but you provided 3. Consider using the `fn` helper to provide additional arguments to the `on` callback./);
    }

    @test
    'it removes the modifier when the element is removed'(assert: Assert) {
      let count = 0;

      this.render(
        '{{#if this.showButton}}<button {{on "click" this.callback}}>Click Me</button>{{/if}}',
        {
          callback() {
            count++;
          },
          showButton: true,
        }
      );

      this.assertCounts({ adds: 1, removes: 0 });

      this.findButton().click();

      assert.equal(count, 1, 'has been called 1 time');

      this.rerender({ showButton: false });
      this.assertCounts({ adds: 1, removes: 1 });
    }
  }

  jitSuite(OnTest);
}

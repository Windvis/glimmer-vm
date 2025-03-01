import { helperCapabilities, setHelperManager, setModifierManager } from '@glimmer/manager';
import {
  RenderTest,
  test,
  jitSuite,
  tracked,
  defineComponent,
  trackedObj,
  TestHelper,
  TestHelperManager,
} from '../..';
import { Arguments, Owner } from '@glimmer/interfaces';
import { FEATURE_DEFAULT_HELPER_MANAGER } from '@glimmer/global-context';

const SKIP_DEFAULT_HELPER_MANAGER_TESTS = !FEATURE_DEFAULT_HELPER_MANAGER;

class HelperManagerTest extends RenderTest {
  static suiteName = 'Helper Managers';

  @test 'it works'() {
    class Hello extends TestHelper {
      value() {
        return 'hello';
      }
    }

    const Main = defineComponent({ hello: Hello }, '{{hello}}');

    this.renderComponent(Main);

    this.assertHTML('hello');

    this.rerender();

    this.assertHTML('hello');
  }

  @test({ skip: SKIP_DEFAULT_HELPER_MANAGER_TESTS })
  '(Default Helper Manager) plain functions work as helpers'(assert: Assert) {
    let count = 0;

    const hello = () => {
      count++;
      return 'plain function';
    };

    const Main = defineComponent({ hello }, '{{hello}}');

    this.renderComponent(Main);

    assert.equal(count, 1, 'rendered once');
    this.assertHTML('plain function');

    this.rerender();

    assert.equal(count, 1, 'rendered once');
    this.assertHTML('plain function');
  }

  @test({ skip: SKIP_DEFAULT_HELPER_MANAGER_TESTS })
  '(Default Helper Manager) plain functions track positional args'(assert: Assert) {
    let count = 0;

    let obj = (x: string) => {
      count++;
      return x;
    };
    let args = trackedObj({ value: 'hello', unused: 'unused' });

    this.renderComponent(defineComponent({ obj }, '{{obj @value @unused}}'), args);

    assert.equal(count, 1, 'rendered once');
    this.assertHTML('hello');

    args.value = 'there';
    this.rerender();

    assert.equal(count, 2, 'rendered twice');
    this.assertHTML('there');

    args.unused = 'unused2';
    this.rerender();

    assert.equal(count, 3, 'rendered thrice');
    this.assertHTML('there');
  }

  @test({ skip: SKIP_DEFAULT_HELPER_MANAGER_TESTS })
  '(Default Helper Manager) plain functions entangle with any tracked data'(assert: Assert) {
    let count = 0;
    let trackedState = trackedObj({ value: 'hello' });

    let obj = () => {
      count++;
      return trackedState.value;
    };

    this.renderComponent(defineComponent({ obj }, '{{obj}}'));

    assert.equal(count, 1, 'rendered once');
    this.assertHTML('hello');

    trackedState.value = 'there';
    this.rerender();
    this.assertHTML('there');
    assert.equal(count, 2, 'rendered twice');
  }

  @test({ skip: SKIP_DEFAULT_HELPER_MANAGER_TESTS })
  '(Default Helper Manager) plain functions do not track unused named args'(assert: Assert) {
    let count = 0;

    let obj = (x: string, _options: Record<string, unknown>) => {
      count++;
      return x;
    };
    let args = trackedObj({ value: 'hello', unused: 'unused' });

    this.renderComponent(defineComponent({ obj }, '{{obj @value namedOpt=@unused}}'), args);
    assert.equal(count, 1, 'rendered once');
    this.assertHTML('hello');

    args.unused = 'unused2';
    this.rerender();

    assert.equal(count, 1, 'rendered once');
    this.assertHTML('hello');
  }

  @test({ skip: SKIP_DEFAULT_HELPER_MANAGER_TESTS })
  '(Default Helper Manager) plain functions tracked used named args'(assert: Assert) {
    let count = 0;

    let obj = (_x: string, options: Record<string, unknown>) => {
      count++;
      return options.namedOpt;
    };

    let args = trackedObj({ value: 'hello', used: 'used' });

    this.renderComponent(defineComponent({ obj }, '{{obj @value namedOpt=@used}}'), args);
    assert.equal(count, 1, 'rendered once');
    this.assertHTML('used');

    args.used = 'there';
    this.rerender();

    assert.equal(count, 2, 'rendered twice');
    this.assertHTML('there');
  }

  @test({ skip: SKIP_DEFAULT_HELPER_MANAGER_TESTS })
  '(Default Helper Manager) plain function helpers can have default values (missing data)'(
    assert: Assert
  ) {
    let count = 0;
    let obj = (x = 'default value') => {
      count++;
      return x;
    };

    let args = trackedObj({});

    this.renderComponent(defineComponent({ obj }, 'result: {{obj}}'), args);
    this.assertHTML('result: default value');
    assert.equal(count, 1, 'rendered once');
  }

  @test({ skip: SKIP_DEFAULT_HELPER_MANAGER_TESTS })
  '(Default Helper Manager) plain function helpers can have overwritten default values'(
    assert: Assert
  ) {
    let count = 0;
    let obj = (x = 'default value') => {
      count++;
      return x;
    };

    let args = trackedObj({ value: undefined });

    this.renderComponent(defineComponent({ obj }, 'result: {{obj @value}}'), args);
    this.assertHTML('result: default value');
    assert.equal(count, 1, 'rendered once');

    args.value = 'value';
    this.rerender();

    this.assertHTML('result: value');
    assert.equal(count, 2, 'rendered twice');
  }

  @test 'tracks changes to named arguments'(assert: Assert) {
    let count = 0;

    class Hello extends TestHelper {
      value() {
        count++;
        return this.args.named.foo;
      }
    }

    let args = trackedObj({ foo: 123 });

    this.renderComponent(defineComponent({ hello: Hello }, '{{hello foo=@foo}}'), args);

    assert.equal(count, 1, 'rendered once');
    this.assertHTML('123');

    this.rerender();

    assert.equal(count, 1, 'rendered once');
    this.assertHTML('123');

    args.foo = 456;
    this.rerender();

    assert.equal(count, 2, 'rendered twice');
    this.assertHTML('456');
  }

  @test 'tracks changes to positional arguments'(assert: Assert) {
    let count = 0;

    class Hello extends TestHelper {
      value() {
        count++;
        return this.args.positional[0];
      }
    }

    let args = trackedObj({ foo: 123 });

    this.renderComponent(defineComponent({ hello: Hello }, '{{hello @foo}}'), args);

    assert.equal(count, 1, 'rendered once');
    this.assertHTML('123');

    this.rerender();

    assert.equal(count, 1, 'rendered once');
    this.assertHTML('123');

    args.foo = 456;
    this.rerender();

    assert.equal(count, 2, 'rendered twice');
    this.assertHTML('456');
  }

  @test 'tracks changes to tracked properties'(assert: Assert) {
    let count = 0;
    let instance: Hello;

    class Hello extends TestHelper {
      @tracked foo = 123;

      constructor(owner: Owner, args: Arguments) {
        super(owner, args);
        instance = this;
      }

      value() {
        count++;
        return this.foo;
      }
    }
    this.renderComponent(defineComponent({ hello: Hello }, '{{hello}}'));

    assert.equal(count, 1, 'rendered once');
    this.assertHTML('123');

    this.rerender();

    assert.equal(count, 1, 'rendered once');
    this.assertHTML('123');

    instance!.foo = 456;
    this.rerender();

    assert.equal(count, 2, 'rendered twice');
    this.assertHTML('456');
  }

  @test 'destroyable is associated correctly'(assert: Assert) {
    class Hello extends TestHelper {
      value() {
        return 'hello';
      }

      willDestroy() {
        assert.ok(true, 'destructor called');
      }
    }

    this.renderComponent(defineComponent({ hello: Hello }, '{{hello}}'));

    this.assertHTML('hello');
  }

  @test 'debug name is used for backtracking message'(assert: Assert) {
    class Hello extends TestHelper {
      @tracked foo = 123;

      value() {
        // eslint-disable-next-line no-unused-expressions
        this.foo;
        this.foo = 456;
      }
    }

    assert.throws(() => {
      this.renderComponent(defineComponent({ hello: Hello }, '{{hello}}'));
    }, /You attempted to update `foo` on/);
  }

  @test 'asserts against using both `hasValue` and `hasScheduledEffect`'(assert: Assert) {
    assert.throws(() => {
      helperCapabilities('3.23', {
        hasValue: true,
        hasScheduledEffect: true,
      });
    }, /You must pass either the `hasValue` OR the `hasScheduledEffect` capability when defining a helper manager. Passing neither, or both, is not permitted./);
  }

  @test 'asserts requiring either `hasValue` or `hasScheduledEffect`'(assert: Assert) {
    assert.throws(() => {
      helperCapabilities('3.23', {});
    }, /You must pass either the `hasValue` OR the `hasScheduledEffect` capability when defining a helper manager. Passing neither, or both, is not permitted./);
  }

  @test 'asserts against using `hasScheduledEffect`'(assert: Assert) {
    assert.throws(() => {
      helperCapabilities('3.23', {
        hasScheduledEffect: true,
      });
    }, /The `hasScheduledEffect` capability has not yet been implemented for helper managers. Please pass `hasValue` instead/);
  }

  @test 'asserts against using incorrect version for capabilities'(assert: Assert) {
    assert.throws(() => {
      helperCapabilities('aoeu' as any, {
        hasScheduledEffect: true,
      });
    }, /Invalid helper manager compatibility specified/);
  }

  @test 'helper manager and modifier manager can be associated with the same value'() {
    abstract class TestModifierHelper extends TestHelper {}

    setModifierManager(() => ({} as any), TestHelper);

    class Hello extends TestModifierHelper {
      value() {
        return 'hello';
      }
    }

    this.renderComponent(defineComponent({ hello: Hello }, '{{hello}}'));

    this.assertHTML('hello');

    this.rerender();

    this.assertHTML('hello');
  }

  @test 'capabilities helper function must be used to generate capabilities'(assert: Assert) {
    class OverrideTestHelperManager extends TestHelperManager {
      capabilities = {
        hasValue: true,
        hasDestroyable: true,
        hasScheduledEffect: false,
      } as any;
    }

    class TestHelper {}

    setHelperManager((owner) => new OverrideTestHelperManager(owner), TestHelper);

    class Hello extends TestHelper {
      value() {
        return 'hello';
      }
    }

    assert.throws(() => {
      this.renderComponent(defineComponent({ hello: Hello }, '{{hello}}'));
    }, /Custom helper managers must have a `capabilities` property that is the result of calling the `capabilities\('3.23'\)` \(imported via `import \{ capabilities \} from '@ember\/helper';`\). /);
  }

  @test
  'custom helpers gives helpful assertion when reading then mutating a tracked value within constructor'(
    assert: Assert
  ) {
    class Hello extends TestHelper {
      @tracked foo = 123;

      constructor(owner: Owner, args: Arguments) {
        super(owner, args);

        // first read the tracked property
        // eslint-disable-next-line no-unused-expressions
        this.foo;

        // then attempt to update the tracked property
        this.foo = 456;
      }

      value() {
        return this.foo;
      }
    }

    assert.throws(() => {
      this.renderComponent(defineComponent({ hello: Hello }, '{{hello}}'));
    }, /You attempted to update `foo` on /);
  }

  @test
  'custom helpers gives helpful assertion when reading then mutating a tracked value within value'(
    assert: Assert
  ) {
    class Hello extends TestHelper {
      @tracked foo = 123;

      value() {
        // first read the tracked property
        // eslint-disable-next-line no-unused-expressions
        this.foo;

        // then attempt to update the tracked property
        this.foo = 456;
      }
    }

    assert.throws(() => {
      this.renderComponent(defineComponent({ hello: Hello }, '{{hello}}'));
    }, /You attempted to update `foo` on /);
  }
}

jitSuite(HelperManagerTest);

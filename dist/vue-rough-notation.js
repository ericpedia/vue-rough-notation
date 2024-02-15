(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.VueRoughNotation = factory());
}(this, (function () { 'use strict';

  const defaultOptions = {
    // Turn on/off animation when annotating.
    animate: true,
    // Duration of the animation in milliseconds.
    animationDuration: 800,
    // Representing the color of the annotation sketch.
    color: 'currentColor',
    // Width of the annotation strokes.
    strokeWidth: 1,
    // Padding between the element and roughly where the annotation is drawn.
    // If you wish to specify different top, left, right, bottom paddings,
    // you can set the value to an array akin to CSS style padding [top, right, bottom, left] or just [top & bottom, left & right].
    padding: 5,
    // This property only applies to inline text.
    // To annotate multiline text (each line separately), set this property to true.
    multiline: false,
    // By default annotations are drawn in two iterations,
    // e.g.when underlining, drawing from left to right and then back from right to left.
    // Setting this property can let you configure the number of iterations.
    iterations: 2,
    // Value could be a string or an array of strings,
    // each string being one of these values: left, right, top, bottom.
    // When drawing a bracket, this configures which side(s) of the element to bracket.
    brackets: 'left'
  };

  /**
   * Make a map and return a function for checking if a key
   * is in that map.
   * IMPORTANT: all calls of this function must be prefixed with
   * \/\*#\_\_PURE\_\_\*\/
   * So that rollup can tree-shake them if necessary.
   */
  function makeMap(str, expectsLowerCase) {
    const map = Object.create(null);
    const list = str.split(',');

    for (let i = 0; i < list.length; i++) {
      map[list[i]] = true;
    }

    return expectsLowerCase ? val => !!map[val.toLowerCase()] : val => !!map[val];
  }

  function normalizeStyle(value) {
    if (isArray(value)) {
      const res = {};

      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        const normalized = isString(item) ? parseStringStyle(item) : normalizeStyle(item);

        if (normalized) {
          for (const key in normalized) {
            res[key] = normalized[key];
          }
        }
      }

      return res;
    } else if (isString(value)) {
      return value;
    } else if (isObject(value)) {
      return value;
    }
  }

  const listDelimiterRE = /;(?![^(]*\))/g;
  const propertyDelimiterRE = /:(.+)/;

  function parseStringStyle(cssText) {
    const ret = {};
    cssText.split(listDelimiterRE).forEach(item => {
      if (item) {
        const tmp = item.split(propertyDelimiterRE);
        tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
      }
    });
    return ret;
  }

  function normalizeClass(value) {
    let res = '';

    if (isString(value)) {
      res = value;
    } else if (isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const normalized = normalizeClass(value[i]);

        if (normalized) {
          res += normalized + ' ';
        }
      }
    } else if (isObject(value)) {
      for (const name in value) {
        if (value[name]) {
          res += name + ' ';
        }
      }
    }

    return res.trim();
  }

  const EMPTY_OBJ = process.env.NODE_ENV !== 'production' ? Object.freeze({}) : {};
  const EMPTY_ARR = process.env.NODE_ENV !== 'production' ? Object.freeze([]) : [];

  const NOOP = () => {};

  const onRE = /^on[^a-z]/;

  const isOn = key => onRE.test(key);

  const extend = Object.assign;

  const remove = (arr, el) => {
    const i = arr.indexOf(el);

    if (i > -1) {
      arr.splice(i, 1);
    }
  };

  const hasOwnProperty = Object.prototype.hasOwnProperty;

  const hasOwn = (val, key) => hasOwnProperty.call(val, key);

  const isArray = Array.isArray;

  const isMap = val => toTypeString(val) === '[object Map]';

  const isSet = val => toTypeString(val) === '[object Set]';

  const isFunction = val => typeof val === 'function';

  const isString = val => typeof val === 'string';

  const isSymbol = val => typeof val === 'symbol';

  const isObject = val => val !== null && typeof val === 'object';

  const isPromise = val => {
    return isObject(val) && isFunction(val.then) && isFunction(val.catch);
  };

  const objectToString = Object.prototype.toString;

  const toTypeString = value => objectToString.call(value);

  const toRawType = value => {
    // extract "RawType" from strings like "[object RawType]"
    return toTypeString(value).slice(8, -1);
  };

  const isPlainObject = val => toTypeString(val) === '[object Object]';

  const isIntegerKey = key => isString(key) && key !== 'NaN' && key[0] !== '-' && '' + parseInt(key, 10) === key;

  const cacheStringFunction = fn => {
    const cache = Object.create(null);
    return str => {
      const hit = cache[str];
      return hit || (cache[str] = fn(str));
    };
  };
  /**
   * @private
   */

  const capitalize = cacheStringFunction(str => str.charAt(0).toUpperCase() + str.slice(1));

  const hasChanged = (value, oldValue) => !Object.is(value, oldValue);

  const def = (obj, key, value) => {
    Object.defineProperty(obj, key, {
      configurable: true,
      enumerable: false,
      value
    });
  };

  let _globalThis;

  const getGlobalThis = () => {
    return _globalThis || (_globalThis = typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : {});
  };

  let activeEffectScope;

  function recordEffectScope(effect, scope) {
    scope = scope || activeEffectScope;

    if (scope && scope.active) {
      scope.effects.push(effect);
    }
  }

  const createDep = effects => {
    const dep = new Set(effects);
    dep.w = 0;
    dep.n = 0;
    return dep;
  };

  const wasTracked = dep => (dep.w & trackOpBit) > 0;

  const newTracked = dep => (dep.n & trackOpBit) > 0;

  const initDepMarkers = ({
    deps
  }) => {
    if (deps.length) {
      for (let i = 0; i < deps.length; i++) {
        deps[i].w |= trackOpBit; // set was tracked
      }
    }
  };

  const finalizeDepMarkers = effect => {
    const {
      deps
    } = effect;

    if (deps.length) {
      let ptr = 0;

      for (let i = 0; i < deps.length; i++) {
        const dep = deps[i];

        if (wasTracked(dep) && !newTracked(dep)) {
          dep.delete(effect);
        } else {
          deps[ptr++] = dep;
        } // clear bits


        dep.w &= ~trackOpBit;
        dep.n &= ~trackOpBit;
      }

      deps.length = ptr;
    }
  };

  const targetMap = new WeakMap(); // The number of effects currently being tracked recursively.

  let effectTrackDepth = 0;
  let trackOpBit = 1;
  /**
   * The bitwise track markers support at most 30 levels of recursion.
   * This value is chosen to enable modern JS engines to use a SMI on all platforms.
   * When recursion depth is greater, fall back to using a full cleanup.
   */

  const maxMarkerBits = 30;
  const effectStack = [];
  let activeEffect;
  const ITERATE_KEY = Symbol(process.env.NODE_ENV !== 'production' ? 'iterate' : '');
  const MAP_KEY_ITERATE_KEY = Symbol(process.env.NODE_ENV !== 'production' ? 'Map key iterate' : '');

  class ReactiveEffect {
    constructor(fn, scheduler = null, scope) {
      this.fn = fn;
      this.scheduler = scheduler;
      this.active = true;
      this.deps = [];
      recordEffectScope(this, scope);
    }

    run() {
      if (!this.active) {
        return this.fn();
      }

      if (!effectStack.length || !effectStack.includes(this)) {
        try {
          effectStack.push(activeEffect = this);
          enableTracking();
          trackOpBit = 1 << ++effectTrackDepth;

          if (effectTrackDepth <= maxMarkerBits) {
            initDepMarkers(this);
          } else {
            cleanupEffect(this);
          }

          return this.fn();
        } finally {
          if (effectTrackDepth <= maxMarkerBits) {
            finalizeDepMarkers(this);
          }

          trackOpBit = 1 << --effectTrackDepth;
          resetTracking();
          effectStack.pop();
          const n = effectStack.length;
          activeEffect = n > 0 ? effectStack[n - 1] : undefined;
        }
      }
    }

    stop() {
      if (this.active) {
        cleanupEffect(this);

        if (this.onStop) {
          this.onStop();
        }

        this.active = false;
      }
    }

  }

  function cleanupEffect(effect) {
    const {
      deps
    } = effect;

    if (deps.length) {
      for (let i = 0; i < deps.length; i++) {
        deps[i].delete(effect);
      }

      deps.length = 0;
    }
  }

  let shouldTrack = true;
  const trackStack = [];

  function pauseTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = false;
  }

  function enableTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = true;
  }

  function resetTracking() {
    const last = trackStack.pop();
    shouldTrack = last === undefined ? true : last;
  }

  function track(target, type, key) {
    if (!isTracking()) {
      return;
    }

    let depsMap = targetMap.get(target);

    if (!depsMap) {
      targetMap.set(target, depsMap = new Map());
    }

    let dep = depsMap.get(key);

    if (!dep) {
      depsMap.set(key, dep = createDep());
    }

    const eventInfo = process.env.NODE_ENV !== 'production' ? {
      effect: activeEffect,
      target,
      type,
      key
    } : undefined;
    trackEffects(dep, eventInfo);
  }

  function isTracking() {
    return shouldTrack && activeEffect !== undefined;
  }

  function trackEffects(dep, debuggerEventExtraInfo) {
    let shouldTrack = false;

    if (effectTrackDepth <= maxMarkerBits) {
      if (!newTracked(dep)) {
        dep.n |= trackOpBit; // set newly tracked

        shouldTrack = !wasTracked(dep);
      }
    } else {
      // Full cleanup mode.
      shouldTrack = !dep.has(activeEffect);
    }

    if (shouldTrack) {
      dep.add(activeEffect);
      activeEffect.deps.push(dep);

      if (process.env.NODE_ENV !== 'production' && activeEffect.onTrack) {
        activeEffect.onTrack(Object.assign({
          effect: activeEffect
        }, debuggerEventExtraInfo));
      }
    }
  }

  function trigger(target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap.get(target);

    if (!depsMap) {
      // never been tracked
      return;
    }

    let deps = [];

    if (type === "clear"
    /* CLEAR */
    ) {
        // collection being cleared
        // trigger all effects for target
        deps = [...depsMap.values()];
      } else if (key === 'length' && isArray(target)) {
      depsMap.forEach((dep, key) => {
        if (key === 'length' || key >= newValue) {
          deps.push(dep);
        }
      });
    } else {
      // schedule runs for SET | ADD | DELETE
      if (key !== void 0) {
        deps.push(depsMap.get(key));
      } // also run for iteration key on ADD | DELETE | Map.SET


      switch (type) {
        case "add"
        /* ADD */
        :
          if (!isArray(target)) {
            deps.push(depsMap.get(ITERATE_KEY));

            if (isMap(target)) {
              deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
            }
          } else if (isIntegerKey(key)) {
            // new index added to array -> length changes
            deps.push(depsMap.get('length'));
          }

          break;

        case "delete"
        /* DELETE */
        :
          if (!isArray(target)) {
            deps.push(depsMap.get(ITERATE_KEY));

            if (isMap(target)) {
              deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
            }
          }

          break;

        case "set"
        /* SET */
        :
          if (isMap(target)) {
            deps.push(depsMap.get(ITERATE_KEY));
          }

          break;
      }
    }

    const eventInfo = process.env.NODE_ENV !== 'production' ? {
      target,
      type,
      key,
      newValue,
      oldValue,
      oldTarget
    } : undefined;

    if (deps.length === 1) {
      if (deps[0]) {
        if (process.env.NODE_ENV !== 'production') {
          triggerEffects(deps[0], eventInfo);
        } else {
          triggerEffects(deps[0]);
        }
      }
    } else {
      const effects = [];

      for (const dep of deps) {
        if (dep) {
          effects.push(...dep);
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        triggerEffects(createDep(effects), eventInfo);
      } else {
        triggerEffects(createDep(effects));
      }
    }
  }

  function triggerEffects(dep, debuggerEventExtraInfo) {
    // spread into array for stabilization
    for (const effect of isArray(dep) ? dep : [...dep]) {
      if (effect !== activeEffect || effect.allowRecurse) {
        if (process.env.NODE_ENV !== 'production' && effect.onTrigger) {
          effect.onTrigger(extend({
            effect
          }, debuggerEventExtraInfo));
        }

        if (effect.scheduler) {
          effect.scheduler();
        } else {
          effect.run();
        }
      }
    }
  }

  const isNonTrackableKeys = /*#__PURE__*/makeMap(`__proto__,__v_isRef,__isVue`);
  const builtInSymbols = new Set(Object.getOwnPropertyNames(Symbol).map(key => Symbol[key]).filter(isSymbol));
  const get = /*#__PURE__*/createGetter();
  const readonlyGet = /*#__PURE__*/createGetter(true);
  const shallowReadonlyGet = /*#__PURE__*/createGetter(true, true);
  const arrayInstrumentations = /*#__PURE__*/createArrayInstrumentations();

  function createArrayInstrumentations() {
    const instrumentations = {};
    ['includes', 'indexOf', 'lastIndexOf'].forEach(key => {
      instrumentations[key] = function (...args) {
        const arr = toRaw(this);

        for (let i = 0, l = this.length; i < l; i++) {
          track(arr, "get"
          /* GET */
          , i + '');
        } // we run the method using the original args first (which may be reactive)


        const res = arr[key](...args);

        if (res === -1 || res === false) {
          // if that didn't work, run it again using raw values.
          return arr[key](...args.map(toRaw));
        } else {
          return res;
        }
      };
    });
    ['push', 'pop', 'shift', 'unshift', 'splice'].forEach(key => {
      instrumentations[key] = function (...args) {
        pauseTracking();
        const res = toRaw(this)[key].apply(this, args);
        resetTracking();
        return res;
      };
    });
    return instrumentations;
  }

  function createGetter(isReadonly = false, shallow = false) {
    return function get(target, key, receiver) {
      if (key === "__v_isReactive"
      /* IS_REACTIVE */
      ) {
          return !isReadonly;
        } else if (key === "__v_isReadonly"
      /* IS_READONLY */
      ) {
          return isReadonly;
        } else if (key === "__v_isShallow"
      /* IS_SHALLOW */
      ) {
          return shallow;
        } else if (key === "__v_raw"
      /* RAW */
      && receiver === (isReadonly ? shallow ? shallowReadonlyMap : readonlyMap : shallow ? shallowReactiveMap : reactiveMap).get(target)) {
        return target;
      }

      const targetIsArray = isArray(target);

      if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }

      const res = Reflect.get(target, key, receiver);

      if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
        return res;
      }

      if (!isReadonly) {
        track(target, "get"
        /* GET */
        , key);
      }

      if (shallow) {
        return res;
      }

      if (isRef(res)) {
        // ref unwrapping - does not apply for Array + integer key.
        const shouldUnwrap = !targetIsArray || !isIntegerKey(key);
        return shouldUnwrap ? res.value : res;
      }

      if (isObject(res)) {
        // Convert returned value into a proxy as well. we do the isObject check
        // here to avoid invalid value warning. Also need to lazy access readonly
        // and reactive here to avoid circular dependency.
        return isReadonly ? readonly(res) : reactive(res);
      }

      return res;
    };
  }

  const set = /*#__PURE__*/createSetter();

  function createSetter(shallow = false) {
    return function set(target, key, value, receiver) {
      let oldValue = target[key];

      if (isReadonly(oldValue) && isRef(oldValue) && !isRef(value)) {
        return false;
      }

      if (!shallow && !isReadonly(value)) {
        if (!isShallow(value)) {
          value = toRaw(value);
          oldValue = toRaw(oldValue);
        }

        if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
          oldValue.value = value;
          return true;
        }
      }

      const hadKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key);
      const result = Reflect.set(target, key, value, receiver); // don't trigger if target is something up in the prototype chain of original

      if (target === toRaw(receiver)) {
        if (!hadKey) {
          trigger(target, "add"
          /* ADD */
          , key, value);
        } else if (hasChanged(value, oldValue)) {
          trigger(target, "set"
          /* SET */
          , key, value, oldValue);
        }
      }

      return result;
    };
  }

  function deleteProperty(target, key) {
    const hadKey = hasOwn(target, key);
    const oldValue = target[key];
    const result = Reflect.deleteProperty(target, key);

    if (result && hadKey) {
      trigger(target, "delete"
      /* DELETE */
      , key, undefined, oldValue);
    }

    return result;
  }

  function has(target, key) {
    const result = Reflect.has(target, key);

    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, "has"
      /* HAS */
      , key);
    }

    return result;
  }

  function ownKeys(target) {
    track(target, "iterate"
    /* ITERATE */
    , isArray(target) ? 'length' : ITERATE_KEY);
    return Reflect.ownKeys(target);
  }

  const mutableHandlers = {
    get,
    set,
    deleteProperty,
    has,
    ownKeys
  };
  const readonlyHandlers = {
    get: readonlyGet,

    set(target, key) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target);
      }

      return true;
    },

    deleteProperty(target, key) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`Delete operation on key "${String(key)}" failed: target is readonly.`, target);
      }

      return true;
    }

  };
  // refs (in order to allow refs to be explicitly passed down), but should
  // retain the reactivity of the normal readonly object.

  const shallowReadonlyHandlers = /*#__PURE__*/extend({}, readonlyHandlers, {
    get: shallowReadonlyGet
  });

  const toShallow = value => value;

  const getProto = v => Reflect.getPrototypeOf(v);

  function get$1(target, key, isReadonly = false, isShallow = false) {
    // #1772: readonly(reactive(Map)) should return readonly + reactive version
    // of the value
    target = target["__v_raw"
    /* RAW */
    ];
    const rawTarget = toRaw(target);
    const rawKey = toRaw(key);

    if (key !== rawKey) {
      !isReadonly && track(rawTarget, "get"
      /* GET */
      , key);
    }

    !isReadonly && track(rawTarget, "get"
    /* GET */
    , rawKey);
    const {
      has
    } = getProto(rawTarget);
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;

    if (has.call(rawTarget, key)) {
      return wrap(target.get(key));
    } else if (has.call(rawTarget, rawKey)) {
      return wrap(target.get(rawKey));
    } else if (target !== rawTarget) {
      // #3602 readonly(reactive(Map))
      // ensure that the nested reactive `Map` can do tracking for itself
      target.get(key);
    }
  }

  function has$1(key, isReadonly = false) {
    const target = this["__v_raw"
    /* RAW */
    ];
    const rawTarget = toRaw(target);
    const rawKey = toRaw(key);

    if (key !== rawKey) {
      !isReadonly && track(rawTarget, "has"
      /* HAS */
      , key);
    }

    !isReadonly && track(rawTarget, "has"
    /* HAS */
    , rawKey);
    return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
  }

  function size(target, isReadonly = false) {
    target = target["__v_raw"
    /* RAW */
    ];
    !isReadonly && track(toRaw(target), "iterate"
    /* ITERATE */
    , ITERATE_KEY);
    return Reflect.get(target, 'size', target);
  }

  function add(value) {
    value = toRaw(value);
    const target = toRaw(this);
    const proto = getProto(target);
    const hadKey = proto.has.call(target, value);

    if (!hadKey) {
      target.add(value);
      trigger(target, "add"
      /* ADD */
      , value, value);
    }

    return this;
  }

  function set$1(key, value) {
    value = toRaw(value);
    const target = toRaw(this);
    const {
      has,
      get
    } = getProto(target);
    let hadKey = has.call(target, key);

    if (!hadKey) {
      key = toRaw(key);
      hadKey = has.call(target, key);
    } else if (process.env.NODE_ENV !== 'production') {
      checkIdentityKeys(target, has, key);
    }

    const oldValue = get.call(target, key);
    target.set(key, value);

    if (!hadKey) {
      trigger(target, "add"
      /* ADD */
      , key, value);
    } else if (hasChanged(value, oldValue)) {
      trigger(target, "set"
      /* SET */
      , key, value, oldValue);
    }

    return this;
  }

  function deleteEntry(key) {
    const target = toRaw(this);
    const {
      has,
      get
    } = getProto(target);
    let hadKey = has.call(target, key);

    if (!hadKey) {
      key = toRaw(key);
      hadKey = has.call(target, key);
    } else if (process.env.NODE_ENV !== 'production') {
      checkIdentityKeys(target, has, key);
    }

    const oldValue = get ? get.call(target, key) : undefined; // forward the operation before queueing reactions

    const result = target.delete(key);

    if (hadKey) {
      trigger(target, "delete"
      /* DELETE */
      , key, undefined, oldValue);
    }

    return result;
  }

  function clear() {
    const target = toRaw(this);
    const hadItems = target.size !== 0;
    const oldTarget = process.env.NODE_ENV !== 'production' ? isMap(target) ? new Map(target) : new Set(target) : undefined; // forward the operation before queueing reactions

    const result = target.clear();

    if (hadItems) {
      trigger(target, "clear"
      /* CLEAR */
      , undefined, undefined, oldTarget);
    }

    return result;
  }

  function createForEach(isReadonly, isShallow) {
    return function forEach(callback, thisArg) {
      const observed = this;
      const target = observed["__v_raw"
      /* RAW */
      ];
      const rawTarget = toRaw(target);
      const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
      !isReadonly && track(rawTarget, "iterate"
      /* ITERATE */
      , ITERATE_KEY);
      return target.forEach((value, key) => {
        // important: make sure the callback is
        // 1. invoked with the reactive map as `this` and 3rd arg
        // 2. the value received should be a corresponding reactive/readonly.
        return callback.call(thisArg, wrap(value), wrap(key), observed);
      });
    };
  }

  function createIterableMethod(method, isReadonly, isShallow) {
    return function (...args) {
      const target = this["__v_raw"
      /* RAW */
      ];
      const rawTarget = toRaw(target);
      const targetIsMap = isMap(rawTarget);
      const isPair = method === 'entries' || method === Symbol.iterator && targetIsMap;
      const isKeyOnly = method === 'keys' && targetIsMap;
      const innerIterator = target[method](...args);
      const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
      !isReadonly && track(rawTarget, "iterate"
      /* ITERATE */
      , isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY); // return a wrapped iterator which returns observed versions of the
      // values emitted from the real iterator

      return {
        // iterator protocol
        next() {
          const {
            value,
            done
          } = innerIterator.next();
          return done ? {
            value,
            done
          } : {
            value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
            done
          };
        },

        // iterable protocol
        [Symbol.iterator]() {
          return this;
        }

      };
    };
  }

  function createReadonlyMethod(type) {
    return function (...args) {
      if (process.env.NODE_ENV !== 'production') {
        const key = args[0] ? `on key "${args[0]}" ` : ``;
        console.warn(`${capitalize(type)} operation ${key}failed: target is readonly.`, toRaw(this));
      }

      return type === "delete"
      /* DELETE */
      ? false : this;
    };
  }

  function createInstrumentations() {
    const mutableInstrumentations = {
      get(key) {
        return get$1(this, key);
      },

      get size() {
        return size(this);
      },

      has: has$1,
      add,
      set: set$1,
      delete: deleteEntry,
      clear,
      forEach: createForEach(false, false)
    };
    const shallowInstrumentations = {
      get(key) {
        return get$1(this, key, false, true);
      },

      get size() {
        return size(this);
      },

      has: has$1,
      add,
      set: set$1,
      delete: deleteEntry,
      clear,
      forEach: createForEach(false, true)
    };
    const readonlyInstrumentations = {
      get(key) {
        return get$1(this, key, true);
      },

      get size() {
        return size(this, true);
      },

      has(key) {
        return has$1.call(this, key, true);
      },

      add: createReadonlyMethod("add"
      /* ADD */
      ),
      set: createReadonlyMethod("set"
      /* SET */
      ),
      delete: createReadonlyMethod("delete"
      /* DELETE */
      ),
      clear: createReadonlyMethod("clear"
      /* CLEAR */
      ),
      forEach: createForEach(true, false)
    };
    const shallowReadonlyInstrumentations = {
      get(key) {
        return get$1(this, key, true, true);
      },

      get size() {
        return size(this, true);
      },

      has(key) {
        return has$1.call(this, key, true);
      },

      add: createReadonlyMethod("add"
      /* ADD */
      ),
      set: createReadonlyMethod("set"
      /* SET */
      ),
      delete: createReadonlyMethod("delete"
      /* DELETE */
      ),
      clear: createReadonlyMethod("clear"
      /* CLEAR */
      ),
      forEach: createForEach(true, true)
    };
    const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator];
    iteratorMethods.forEach(method => {
      mutableInstrumentations[method] = createIterableMethod(method, false, false);
      readonlyInstrumentations[method] = createIterableMethod(method, true, false);
      shallowInstrumentations[method] = createIterableMethod(method, false, true);
      shallowReadonlyInstrumentations[method] = createIterableMethod(method, true, true);
    });
    return [mutableInstrumentations, readonlyInstrumentations, shallowInstrumentations, shallowReadonlyInstrumentations];
  }

  const [mutableInstrumentations, readonlyInstrumentations, shallowInstrumentations, shallowReadonlyInstrumentations] = /* #__PURE__*/createInstrumentations();

  function createInstrumentationGetter(isReadonly, shallow) {
    const instrumentations = shallow ? isReadonly ? shallowReadonlyInstrumentations : shallowInstrumentations : isReadonly ? readonlyInstrumentations : mutableInstrumentations;
    return (target, key, receiver) => {
      if (key === "__v_isReactive"
      /* IS_REACTIVE */
      ) {
          return !isReadonly;
        } else if (key === "__v_isReadonly"
      /* IS_READONLY */
      ) {
          return isReadonly;
        } else if (key === "__v_raw"
      /* RAW */
      ) {
          return target;
        }

      return Reflect.get(hasOwn(instrumentations, key) && key in target ? instrumentations : target, key, receiver);
    };
  }

  const mutableCollectionHandlers = {
    get: /*#__PURE__*/createInstrumentationGetter(false, false)
  };
  const readonlyCollectionHandlers = {
    get: /*#__PURE__*/createInstrumentationGetter(true, false)
  };
  const shallowReadonlyCollectionHandlers = {
    get: /*#__PURE__*/createInstrumentationGetter(true, true)
  };

  function checkIdentityKeys(target, has, key) {
    const rawKey = toRaw(key);

    if (rawKey !== key && has.call(target, rawKey)) {
      const type = toRawType(target);
      console.warn(`Reactive ${type} contains both the raw and reactive ` + `versions of the same object${type === `Map` ? ` as keys` : ``}, ` + `which can lead to inconsistencies. ` + `Avoid differentiating between the raw and reactive versions ` + `of an object and only use the reactive version if possible.`);
    }
  }

  const reactiveMap = new WeakMap();
  const shallowReactiveMap = new WeakMap();
  const readonlyMap = new WeakMap();
  const shallowReadonlyMap = new WeakMap();

  function targetTypeMap(rawType) {
    switch (rawType) {
      case 'Object':
      case 'Array':
        return 1
        /* COMMON */
        ;

      case 'Map':
      case 'Set':
      case 'WeakMap':
      case 'WeakSet':
        return 2
        /* COLLECTION */
        ;

      default:
        return 0
        /* INVALID */
        ;
    }
  }

  function getTargetType(value) {
    return value["__v_skip"
    /* SKIP */
    ] || !Object.isExtensible(value) ? 0
    /* INVALID */
    : targetTypeMap(toRawType(value));
  }

  function reactive(target) {
    // if trying to observe a readonly proxy, return the readonly version.
    if (isReadonly(target)) {
      return target;
    }

    return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers, reactiveMap);
  }
  /**
   * Creates a readonly copy of the original object. Note the returned copy is not
   * made reactive, but `readonly` can be called on an already reactive object.
   */


  function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers, readonlyCollectionHandlers, readonlyMap);
  }
  /**
   * Returns a reactive-copy of the original object, where only the root level
   * properties are readonly, and does NOT unwrap refs nor recursively convert
   * returned properties.
   * This is used for creating the props proxy object for stateful components.
   */


  function shallowReadonly(target) {
    return createReactiveObject(target, true, shallowReadonlyHandlers, shallowReadonlyCollectionHandlers, shallowReadonlyMap);
  }

  function createReactiveObject(target, isReadonly, baseHandlers, collectionHandlers, proxyMap) {
    if (!isObject(target)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`value cannot be made reactive: ${String(target)}`);
      }

      return target;
    } // target is already a Proxy, return it.
    // exception: calling readonly() on a reactive object


    if (target["__v_raw"
    /* RAW */
    ] && !(isReadonly && target["__v_isReactive"
    /* IS_REACTIVE */
    ])) {
      return target;
    } // target already has corresponding Proxy


    const existingProxy = proxyMap.get(target);

    if (existingProxy) {
      return existingProxy;
    } // only a whitelist of value types can be observed.


    const targetType = getTargetType(target);

    if (targetType === 0
    /* INVALID */
    ) {
        return target;
      }

    const proxy = new Proxy(target, targetType === 2
    /* COLLECTION */
    ? collectionHandlers : baseHandlers);
    proxyMap.set(target, proxy);
    return proxy;
  }

  function isReactive(value) {
    if (isReadonly(value)) {
      return isReactive(value["__v_raw"
      /* RAW */
      ]);
    }

    return !!(value && value["__v_isReactive"
    /* IS_REACTIVE */
    ]);
  }

  function isReadonly(value) {
    return !!(value && value["__v_isReadonly"
    /* IS_READONLY */
    ]);
  }

  function isShallow(value) {
    return !!(value && value["__v_isShallow"
    /* IS_SHALLOW */
    ]);
  }

  function isProxy(value) {
    return isReactive(value) || isReadonly(value);
  }

  function toRaw(observed) {
    const raw = observed && observed["__v_raw"
    /* RAW */
    ];
    return raw ? toRaw(raw) : observed;
  }

  function markRaw(value) {
    def(value, "__v_skip"
    /* SKIP */
    , true);
    return value;
  }

  const toReactive = value => isObject(value) ? reactive(value) : value;

  const toReadonly = value => isObject(value) ? readonly(value) : value;

  function isRef(r) {
    return Boolean(r && r.__v_isRef === true);
  }

  function unref(ref) {
    return isRef(ref) ? ref.value : ref;
  }

  const shallowUnwrapHandlers = {
    get: (target, key, receiver) => unref(Reflect.get(target, key, receiver)),
    set: (target, key, value, receiver) => {
      const oldValue = target[key];

      if (isRef(oldValue) && !isRef(value)) {
        oldValue.value = value;
        return true;
      } else {
        return Reflect.set(target, key, value, receiver);
      }
    }
  };

  function proxyRefs(objectWithRefs) {
    return isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers);
  }

  const stack = [];

  function pushWarningContext(vnode) {
    stack.push(vnode);
  }

  function popWarningContext() {
    stack.pop();
  }

  function warn(msg, ...args) {
    // avoid props formatting or warn handler tracking deps that might be mutated
    // during patch, leading to infinite recursion.
    pauseTracking();
    const instance = stack.length ? stack[stack.length - 1].component : null;
    const appWarnHandler = instance && instance.appContext.config.warnHandler;
    const trace = getComponentTrace();

    if (appWarnHandler) {
      callWithErrorHandling(appWarnHandler, instance, 11
      /* APP_WARN_HANDLER */
      , [msg + args.join(''), instance && instance.proxy, trace.map(({
        vnode
      }) => `at <${formatComponentName(instance, vnode.type)}>`).join('\n'), trace]);
    } else {
      const warnArgs = [`[Vue warn]: ${msg}`, ...args];
      /* istanbul ignore if */

      if (trace.length && // avoid spamming console during tests
      !false) {
        warnArgs.push(`\n`, ...formatTrace(trace));
      }

      console.warn(...warnArgs);
    }

    resetTracking();
  }

  function getComponentTrace() {
    let currentVNode = stack[stack.length - 1];

    if (!currentVNode) {
      return [];
    } // we can't just use the stack because it will be incomplete during updates
    // that did not start from the root. Re-construct the parent chain using
    // instance parent pointers.


    const normalizedStack = [];

    while (currentVNode) {
      const last = normalizedStack[0];

      if (last && last.vnode === currentVNode) {
        last.recurseCount++;
      } else {
        normalizedStack.push({
          vnode: currentVNode,
          recurseCount: 0
        });
      }

      const parentInstance = currentVNode.component && currentVNode.component.parent;
      currentVNode = parentInstance && parentInstance.vnode;
    }

    return normalizedStack;
  }
  /* istanbul ignore next */


  function formatTrace(trace) {
    const logs = [];
    trace.forEach((entry, i) => {
      logs.push(...(i === 0 ? [] : [`\n`]), ...formatTraceEntry(entry));
    });
    return logs;
  }

  function formatTraceEntry({
    vnode,
    recurseCount
  }) {
    const postfix = recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``;
    const isRoot = vnode.component ? vnode.component.parent == null : false;
    const open = ` at <${formatComponentName(vnode.component, vnode.type, isRoot)}`;
    const close = `>` + postfix;
    return vnode.props ? [open, ...formatProps(vnode.props), close] : [open + close];
  }
  /* istanbul ignore next */


  function formatProps(props) {
    const res = [];
    const keys = Object.keys(props);
    keys.slice(0, 3).forEach(key => {
      res.push(...formatProp(key, props[key]));
    });

    if (keys.length > 3) {
      res.push(` ...`);
    }

    return res;
  }
  /* istanbul ignore next */


  function formatProp(key, value, raw) {
    if (isString(value)) {
      value = JSON.stringify(value);
      return raw ? value : [`${key}=${value}`];
    } else if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
      return raw ? value : [`${key}=${value}`];
    } else if (isRef(value)) {
      value = formatProp(key, toRaw(value.value), true);
      return raw ? value : [`${key}=Ref<`, value, `>`];
    } else if (isFunction(value)) {
      return [`${key}=fn${value.name ? `<${value.name}>` : ``}`];
    } else {
      value = toRaw(value);
      return raw ? value : [`${key}=`, value];
    }
  }

  const ErrorTypeStrings = {
    ["sp"
    /* SERVER_PREFETCH */
    ]: 'serverPrefetch hook',
    ["bc"
    /* BEFORE_CREATE */
    ]: 'beforeCreate hook',
    ["c"
    /* CREATED */
    ]: 'created hook',
    ["bm"
    /* BEFORE_MOUNT */
    ]: 'beforeMount hook',
    ["m"
    /* MOUNTED */
    ]: 'mounted hook',
    ["bu"
    /* BEFORE_UPDATE */
    ]: 'beforeUpdate hook',
    ["u"
    /* UPDATED */
    ]: 'updated',
    ["bum"
    /* BEFORE_UNMOUNT */
    ]: 'beforeUnmount hook',
    ["um"
    /* UNMOUNTED */
    ]: 'unmounted hook',
    ["a"
    /* ACTIVATED */
    ]: 'activated hook',
    ["da"
    /* DEACTIVATED */
    ]: 'deactivated hook',
    ["ec"
    /* ERROR_CAPTURED */
    ]: 'errorCaptured hook',
    ["rtc"
    /* RENDER_TRACKED */
    ]: 'renderTracked hook',
    ["rtg"
    /* RENDER_TRIGGERED */
    ]: 'renderTriggered hook',
    [0
    /* SETUP_FUNCTION */
    ]: 'setup function',
    [1
    /* RENDER_FUNCTION */
    ]: 'render function',
    [2
    /* WATCH_GETTER */
    ]: 'watcher getter',
    [3
    /* WATCH_CALLBACK */
    ]: 'watcher callback',
    [4
    /* WATCH_CLEANUP */
    ]: 'watcher cleanup function',
    [5
    /* NATIVE_EVENT_HANDLER */
    ]: 'native event handler',
    [6
    /* COMPONENT_EVENT_HANDLER */
    ]: 'component event handler',
    [7
    /* VNODE_HOOK */
    ]: 'vnode hook',
    [8
    /* DIRECTIVE_HOOK */
    ]: 'directive hook',
    [9
    /* TRANSITION_HOOK */
    ]: 'transition hook',
    [10
    /* APP_ERROR_HANDLER */
    ]: 'app errorHandler',
    [11
    /* APP_WARN_HANDLER */
    ]: 'app warnHandler',
    [12
    /* FUNCTION_REF */
    ]: 'ref function',
    [13
    /* ASYNC_COMPONENT_LOADER */
    ]: 'async component loader',
    [14
    /* SCHEDULER */
    ]: 'scheduler flush. This is likely a Vue internals bug. ' + 'Please open an issue at https://new-issue.vuejs.org/?repo=vuejs/core'
  };

  function callWithErrorHandling(fn, instance, type, args) {
    let res;

    try {
      res = args ? fn(...args) : fn();
    } catch (err) {
      handleError(err, instance, type);
    }

    return res;
  }

  function callWithAsyncErrorHandling(fn, instance, type, args) {
    if (isFunction(fn)) {
      const res = callWithErrorHandling(fn, instance, type, args);

      if (res && isPromise(res)) {
        res.catch(err => {
          handleError(err, instance, type);
        });
      }

      return res;
    }

    const values = [];

    for (let i = 0; i < fn.length; i++) {
      values.push(callWithAsyncErrorHandling(fn[i], instance, type, args));
    }

    return values;
  }

  function handleError(err, instance, type, throwInDev = true) {
    const contextVNode = instance ? instance.vnode : null;

    if (instance) {
      let cur = instance.parent; // the exposed instance is the render proxy to keep it consistent with 2.x

      const exposedInstance = instance.proxy; // in production the hook receives only the error code

      const errorInfo = process.env.NODE_ENV !== 'production' ? ErrorTypeStrings[type] : type;

      while (cur) {
        const errorCapturedHooks = cur.ec;

        if (errorCapturedHooks) {
          for (let i = 0; i < errorCapturedHooks.length; i++) {
            if (errorCapturedHooks[i](err, exposedInstance, errorInfo) === false) {
              return;
            }
          }
        }

        cur = cur.parent;
      } // app-level handling


      const appErrorHandler = instance.appContext.config.errorHandler;

      if (appErrorHandler) {
        callWithErrorHandling(appErrorHandler, null, 10
        /* APP_ERROR_HANDLER */
        , [err, exposedInstance, errorInfo]);
        return;
      }
    }

    logError(err, type, contextVNode, throwInDev);
  }

  function logError(err, type, contextVNode, throwInDev = true) {
    if (process.env.NODE_ENV !== 'production') {
      const info = ErrorTypeStrings[type];

      if (contextVNode) {
        pushWarningContext(contextVNode);
      }

      warn(`Unhandled error${info ? ` during execution of ${info}` : ``}`);

      if (contextVNode) {
        popWarningContext();
      } // crash in dev by default so it's more noticeable


      if (throwInDev) {
        throw err;
      } else {
        console.error(err);
      }
    } else {
      // recover in prod to reduce the impact on end-user
      console.error(err);
    }
  }

  let isFlushing = false;
  let isFlushPending = false;
  const queue = [];
  let flushIndex = 0;
  const pendingPreFlushCbs = [];
  let activePreFlushCbs = null;
  let preFlushIndex = 0;
  const pendingPostFlushCbs = [];
  let activePostFlushCbs = null;
  let postFlushIndex = 0;
  const resolvedPromise = Promise.resolve();
  let currentFlushPromise = null;
  let currentPreFlushParentJob = null;
  const RECURSION_LIMIT = 100;

  function nextTick(fn) {
    const p = currentFlushPromise || resolvedPromise;
    return fn ? p.then(this ? fn.bind(this) : fn) : p;
  } // #2768
  // Use binary-search to find a suitable position in the queue,
  // so that the queue maintains the increasing order of job's id,
  // which can prevent the job from being skipped and also can avoid repeated patching.


  function findInsertionIndex(id) {
    // the start index should be `flushIndex + 1`
    let start = flushIndex + 1;
    let end = queue.length;

    while (start < end) {
      const middle = start + end >>> 1;
      const middleJobId = getId(queue[middle]);
      middleJobId < id ? start = middle + 1 : end = middle;
    }

    return start;
  }

  function queueJob(job) {
    // the dedupe search uses the startIndex argument of Array.includes()
    // by default the search index includes the current job that is being run
    // so it cannot recursively trigger itself again.
    // if the job is a watch() callback, the search will start with a +1 index to
    // allow it recursively trigger itself - it is the user's responsibility to
    // ensure it doesn't end up in an infinite loop.
    if ((!queue.length || !queue.includes(job, isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex)) && job !== currentPreFlushParentJob) {
      if (job.id == null) {
        queue.push(job);
      } else {
        queue.splice(findInsertionIndex(job.id), 0, job);
      }

      queueFlush();
    }
  }

  function queueFlush() {
    if (!isFlushing && !isFlushPending) {
      isFlushPending = true;
      currentFlushPromise = resolvedPromise.then(flushJobs);
    }
  }

  function queueCb(cb, activeQueue, pendingQueue, index) {
    if (!isArray(cb)) {
      if (!activeQueue || !activeQueue.includes(cb, cb.allowRecurse ? index + 1 : index)) {
        pendingQueue.push(cb);
      }
    } else {
      // if cb is an array, it is a component lifecycle hook which can only be
      // triggered by a job, which is already deduped in the main queue, so
      // we can skip duplicate check here to improve perf
      pendingQueue.push(...cb);
    }

    queueFlush();
  }

  function queuePreFlushCb(cb) {
    queueCb(cb, activePreFlushCbs, pendingPreFlushCbs, preFlushIndex);
  }

  function queuePostFlushCb(cb) {
    queueCb(cb, activePostFlushCbs, pendingPostFlushCbs, postFlushIndex);
  }

  function flushPreFlushCbs(seen, parentJob = null) {
    if (pendingPreFlushCbs.length) {
      currentPreFlushParentJob = parentJob;
      activePreFlushCbs = [...new Set(pendingPreFlushCbs)];
      pendingPreFlushCbs.length = 0;

      if (process.env.NODE_ENV !== 'production') {
        seen = seen || new Map();
      }

      for (preFlushIndex = 0; preFlushIndex < activePreFlushCbs.length; preFlushIndex++) {
        if (process.env.NODE_ENV !== 'production' && checkRecursiveUpdates(seen, activePreFlushCbs[preFlushIndex])) {
          continue;
        }

        activePreFlushCbs[preFlushIndex]();
      }

      activePreFlushCbs = null;
      preFlushIndex = 0;
      currentPreFlushParentJob = null; // recursively flush until it drains

      flushPreFlushCbs(seen, parentJob);
    }
  }

  function flushPostFlushCbs(seen) {
    if (pendingPostFlushCbs.length) {
      const deduped = [...new Set(pendingPostFlushCbs)];
      pendingPostFlushCbs.length = 0; // #1947 already has active queue, nested flushPostFlushCbs call

      if (activePostFlushCbs) {
        activePostFlushCbs.push(...deduped);
        return;
      }

      activePostFlushCbs = deduped;

      if (process.env.NODE_ENV !== 'production') {
        seen = seen || new Map();
      }

      activePostFlushCbs.sort((a, b) => getId(a) - getId(b));

      for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
        if (process.env.NODE_ENV !== 'production' && checkRecursiveUpdates(seen, activePostFlushCbs[postFlushIndex])) {
          continue;
        }

        activePostFlushCbs[postFlushIndex]();
      }

      activePostFlushCbs = null;
      postFlushIndex = 0;
    }
  }

  const getId = job => job.id == null ? Infinity : job.id;

  function flushJobs(seen) {
    isFlushPending = false;
    isFlushing = true;

    if (process.env.NODE_ENV !== 'production') {
      seen = seen || new Map();
    }

    flushPreFlushCbs(seen); // Sort queue before flush.
    // This ensures that:
    // 1. Components are updated from parent to child. (because parent is always
    //    created before the child so its render effect will have smaller
    //    priority number)
    // 2. If a component is unmounted during a parent component's update,
    //    its update can be skipped.

    queue.sort((a, b) => getId(a) - getId(b)); // conditional usage of checkRecursiveUpdate must be determined out of
    // try ... catch block since Rollup by default de-optimizes treeshaking
    // inside try-catch. This can leave all warning code unshaked. Although
    // they would get eventually shaken by a minifier like terser, some minifiers
    // would fail to do that (e.g. https://github.com/evanw/esbuild/issues/1610)

    const check = process.env.NODE_ENV !== 'production' ? job => checkRecursiveUpdates(seen, job) : NOOP;

    try {
      for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
        const job = queue[flushIndex];

        if (job && job.active !== false) {
          if (process.env.NODE_ENV !== 'production' && check(job)) {
            continue;
          } // console.log(`running:`, job.id)


          callWithErrorHandling(job, null, 14
          /* SCHEDULER */
          );
        }
      }
    } finally {
      flushIndex = 0;
      queue.length = 0;
      flushPostFlushCbs(seen);
      isFlushing = false;
      currentFlushPromise = null; // some postFlushCb queued jobs!
      // keep flushing until it drains.

      if (queue.length || pendingPreFlushCbs.length || pendingPostFlushCbs.length) {
        flushJobs(seen);
      }
    }
  }

  function checkRecursiveUpdates(seen, fn) {
    if (!seen.has(fn)) {
      seen.set(fn, 1);
    } else {
      const count = seen.get(fn);

      if (count > RECURSION_LIMIT) {
        const instance = fn.ownerInstance;
        const componentName = instance && getComponentName(instance.type);
        warn(`Maximum recursive updates exceeded${componentName ? ` in component <${componentName}>` : ``}. ` + `This means you have a reactive effect that is mutating its own ` + `dependencies and thus recursively triggering itself. Possible sources ` + `include component template, render function, updated hook or ` + `watcher source function.`);
        return true;
      } else {
        seen.set(fn, count + 1);
      }
    }
  }
  const hmrDirtyComponents = new Set(); // Expose the HMR runtime on the global object
  // This makes it entirely tree-shakable without polluting the exports and makes
  // it easier to be used in toolings like vue-loader
  // Note: for a component to be eligible for HMR it also needs the __hmrId option
  // to be set so that its instances can be registered / removed.

  if (process.env.NODE_ENV !== 'production') {
    getGlobalThis().__VUE_HMR_RUNTIME__ = {
      createRecord: tryWrap(createRecord),
      rerender: tryWrap(rerender),
      reload: tryWrap(reload)
    };
  }

  const map = new Map();

  function createRecord(id, initialDef) {
    if (map.has(id)) {
      return false;
    }

    map.set(id, {
      initialDef: normalizeClassComponent(initialDef),
      instances: new Set()
    });
    return true;
  }

  function normalizeClassComponent(component) {
    return isClassComponent(component) ? component.__vccOpts : component;
  }

  function rerender(id, newRender) {
    const record = map.get(id);

    if (!record) {
      return;
    } // update initial record (for not-yet-rendered component)


    record.initialDef.render = newRender;
    [...record.instances].forEach(instance => {
      if (newRender) {
        instance.render = newRender;
        normalizeClassComponent(instance.type).render = newRender;
      }

      instance.renderCache = []; // this flag forces child components with slot content to update
      instance.update();
    });
  }

  function reload(id, newComp) {
    const record = map.get(id);
    if (!record) return;
    newComp = normalizeClassComponent(newComp); // update initial def (for not-yet-rendered components)

    updateComponentDef(record.initialDef, newComp); // create a snapshot which avoids the set being mutated during updates

    const instances = [...record.instances];

    for (const instance of instances) {
      const oldComp = normalizeClassComponent(instance.type);

      if (!hmrDirtyComponents.has(oldComp)) {
        // 1. Update existing comp definition to match new one
        if (oldComp !== record.initialDef) {
          updateComponentDef(oldComp, newComp);
        } // 2. mark definition dirty. This forces the renderer to replace the
        // component on patch.


        hmrDirtyComponents.add(oldComp);
      } // 3. invalidate options resolution cache


      instance.appContext.optionsCache.delete(instance.type); // 4. actually update

      if (instance.ceReload) {
        // custom element
        hmrDirtyComponents.add(oldComp);
        instance.ceReload(newComp.styles);
        hmrDirtyComponents.delete(oldComp);
      } else if (instance.parent) {
        // 4. Force the parent instance to re-render. This will cause all updated
        // components to be unmounted and re-mounted. Queue the update so that we
        // don't end up forcing the same parent to re-render multiple times.
        queueJob(instance.parent.update); // instance is the inner component of an async custom element
        // invoke to reset styles

        if (instance.parent.type.__asyncLoader && instance.parent.ceReload) {
          instance.parent.ceReload(newComp.styles);
        }
      } else if (instance.appContext.reload) {
        // root instance mounted via createApp() has a reload method
        instance.appContext.reload();
      } else if (typeof window !== 'undefined') {
        // root instance inside tree created via raw render(). Force reload.
        window.location.reload();
      } else {
        console.warn('[HMR] Root or manually mounted instance modified. Full reload required.');
      }
    } // 5. make sure to cleanup dirty hmr components after update


    queuePostFlushCb(() => {
      for (const instance of instances) {
        hmrDirtyComponents.delete(normalizeClassComponent(instance.type));
      }
    });
  }

  function updateComponentDef(oldComp, newComp) {
    extend(oldComp, newComp);

    for (const key in oldComp) {
      if (key !== '__file' && !(key in newComp)) {
        delete oldComp[key];
      }
    }
  }

  function tryWrap(fn) {
    return (id, arg) => {
      try {
        return fn(id, arg);
      } catch (e) {
        console.error(e);
        console.warn(`[HMR] Something went wrong during Vue component hot-reload. ` + `Full reload required.`);
      }
    };
  }
  /**
   * mark the current rendering instance for asset resolution (e.g.
   * resolveComponent, resolveDirective) during render
   */


  let currentRenderingInstance = null;
  let currentScopeId = null;

  const isSuspense = type => type.__isSuspense; // Suspense exposes a component-like API, and is treated like a component

  function queueEffectWithSuspense(fn, suspense) {
    if (suspense && suspense.pendingBranch) {
      if (isArray(fn)) {
        suspense.effects.push(...fn);
      } else {
        suspense.effects.push(fn);
      }
    } else {
      queuePostFlushCb(fn);
    }
  }


  const INITIAL_WATCHER_VALUE = {}; // implementation

  function doWatch(source, cb, {
    immediate,
    deep,
    flush,
    onTrack,
    onTrigger
  } = EMPTY_OBJ) {
    if (process.env.NODE_ENV !== 'production' && !cb) {
      if (immediate !== undefined) {
        warn(`watch() "immediate" option is only respected when using the ` + `watch(source, callback, options?) signature.`);
      }

      if (deep !== undefined) {
        warn(`watch() "deep" option is only respected when using the ` + `watch(source, callback, options?) signature.`);
      }
    }

    const warnInvalidSource = s => {
      warn(`Invalid watch source: `, s, `A watch source can only be a getter/effect function, a ref, ` + `a reactive object, or an array of these types.`);
    };

    const instance = currentInstance;
    let getter;
    let forceTrigger = false;
    let isMultiSource = false;

    if (isRef(source)) {
      getter = () => source.value;

      forceTrigger = isShallow(source);
    } else if (isReactive(source)) {
      getter = () => source;

      deep = true;
    } else if (isArray(source)) {
      isMultiSource = true;
      forceTrigger = source.some(isReactive);

      getter = () => source.map(s => {
        if (isRef(s)) {
          return s.value;
        } else if (isReactive(s)) {
          return traverse(s);
        } else if (isFunction(s)) {
          return callWithErrorHandling(s, instance, 2
          /* WATCH_GETTER */
          );
        } else {
          process.env.NODE_ENV !== 'production' && warnInvalidSource(s);
        }
      });
    } else if (isFunction(source)) {
      if (cb) {
        // getter with cb
        getter = () => callWithErrorHandling(source, instance, 2
        /* WATCH_GETTER */
        );
      } else {
        // no cb -> simple effect
        getter = () => {
          if (instance && instance.isUnmounted) {
            return;
          }

          if (cleanup) {
            cleanup();
          }

          return callWithAsyncErrorHandling(source, instance, 3
          /* WATCH_CALLBACK */
          , [onCleanup]);
        };
      }
    } else {
      getter = NOOP;
      process.env.NODE_ENV !== 'production' && warnInvalidSource(source);
    }

    if (cb && deep) {
      const baseGetter = getter;

      getter = () => traverse(baseGetter());
    }

    let cleanup;

    let onCleanup = fn => {
      cleanup = effect.onStop = () => {
        callWithErrorHandling(fn, instance, 4
        /* WATCH_CLEANUP */
        );
      };
    }; // in SSR there is no need to setup an actual effect, and it should be noop

    let oldValue = isMultiSource ? [] : INITIAL_WATCHER_VALUE;

    const job = () => {
      if (!effect.active) {
        return;
      }

      if (cb) {
        // watch(source, cb)
        const newValue = effect.run();

        if (deep || forceTrigger || (isMultiSource ? newValue.some((v, i) => hasChanged(v, oldValue[i])) : hasChanged(newValue, oldValue)) || false) {
          // cleanup before running cb again
          if (cleanup) {
            cleanup();
          }

          callWithAsyncErrorHandling(cb, instance, 3
          /* WATCH_CALLBACK */
          , [newValue, // pass undefined as the old value when it's changed for the first time
          oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue, onCleanup]);
          oldValue = newValue;
        }
      } else {
        // watchEffect
        effect.run();
      }
    }; // important: mark the job as a watcher callback so that scheduler knows
    // it is allowed to self-trigger (#1727)


    job.allowRecurse = !!cb;
    let scheduler;

    if (flush === 'sync') {
      scheduler = job; // the scheduler function gets called directly
    } else if (flush === 'post') {
      scheduler = () => queuePostRenderEffect(job, instance && instance.suspense);
    } else {
      // default: 'pre'
      scheduler = () => {
        if (!instance || instance.isMounted) {
          queuePreFlushCb(job);
        } else {
          // with 'pre' option, the first call must happen before
          // the component is mounted so it is called synchronously.
          job();
        }
      };
    }

    const effect = new ReactiveEffect(getter, scheduler);

    if (process.env.NODE_ENV !== 'production') {
      effect.onTrack = onTrack;
      effect.onTrigger = onTrigger;
    } // initial run


    if (cb) {
      if (immediate) {
        job();
      } else {
        oldValue = effect.run();
      }
    } else if (flush === 'post') {
      queuePostRenderEffect(effect.run.bind(effect), instance && instance.suspense);
    } else {
      effect.run();
    }

    return () => {
      effect.stop();

      if (instance && instance.scope) {
        remove(instance.scope.effects, effect);
      }
    };
  } // this.$watch


  function instanceWatch(source, value, options) {
    const publicThis = this.proxy;
    const getter = isString(source) ? source.includes('.') ? createPathGetter(publicThis, source) : () => publicThis[source] : source.bind(publicThis, publicThis);
    let cb;

    if (isFunction(value)) {
      cb = value;
    } else {
      cb = value.handler;
      options = value;
    }

    const cur = currentInstance;
    setCurrentInstance(this);
    const res = doWatch(getter, cb.bind(publicThis), options);

    if (cur) {
      setCurrentInstance(cur);
    } else {
      unsetCurrentInstance();
    }

    return res;
  }

  function createPathGetter(ctx, path) {
    const segments = path.split('.');
    return () => {
      let cur = ctx;

      for (let i = 0; i < segments.length && cur; i++) {
        cur = cur[segments[i]];
      }

      return cur;
    };
  }

  function traverse(value, seen) {
    if (!isObject(value) || value["__v_skip"
    /* SKIP */
    ]) {
      return value;
    }

    seen = seen || new Set();

    if (seen.has(value)) {
      return value;
    }

    seen.add(value);

    if (isRef(value)) {
      traverse(value.value, seen);
    } else if (isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        traverse(value[i], seen);
      }
    } else if (isSet(value) || isMap(value)) {
      value.forEach(v => {
        traverse(v, seen);
      });
    } else if (isPlainObject(value)) {
      for (const key in value) {
        traverse(value[key], seen);
      }
    }

    return value;
  }


  function defineComponent(options) {
    return isFunction(options) ? {
      setup: options,
      name: options.name
    } : options;
  }
  /**
   * Resolve merged options and cache it on the component.
   * This is done only once per-component since the merging does not involve
   * instances.
   */


  function resolveMergedOptions(instance) {
    const base = instance.type;
    const {
      mixins,
      extends: extendsOptions
    } = base;
    const {
      mixins: globalMixins,
      optionsCache: cache,
      config: {
        optionMergeStrategies
      }
    } = instance.appContext;
    const cached = cache.get(base);
    let resolved;

    if (cached) {
      resolved = cached;
    } else if (!globalMixins.length && !mixins && !extendsOptions) {
      {
        resolved = base;
      }
    } else {
      resolved = {};

      if (globalMixins.length) {
        globalMixins.forEach(m => mergeOptions(resolved, m, optionMergeStrategies, true));
      }

      mergeOptions(resolved, base, optionMergeStrategies);
    }

    cache.set(base, resolved);
    return resolved;
  }

  function mergeOptions(to, from, strats, asMixin = false) {
    const {
      mixins,
      extends: extendsOptions
    } = from;

    if (extendsOptions) {
      mergeOptions(to, extendsOptions, strats, true);
    }

    if (mixins) {
      mixins.forEach(m => mergeOptions(to, m, strats, true));
    }

    for (const key in from) {
      if (asMixin && key === 'expose') {
        process.env.NODE_ENV !== 'production' && warn(`"expose" option is ignored when declared in mixins or extends. ` + `It should only be declared in the base component itself.`);
      } else {
        const strat = internalOptionMergeStrats[key] || strats && strats[key];
        to[key] = strat ? strat(to[key], from[key]) : from[key];
      }
    }

    return to;
  }

  const internalOptionMergeStrats = {
    data: mergeDataFn,
    props: mergeObjectOptions,
    emits: mergeObjectOptions,
    // objects
    methods: mergeObjectOptions,
    computed: mergeObjectOptions,
    // lifecycle
    beforeCreate: mergeAsArray,
    created: mergeAsArray,
    beforeMount: mergeAsArray,
    mounted: mergeAsArray,
    beforeUpdate: mergeAsArray,
    updated: mergeAsArray,
    beforeDestroy: mergeAsArray,
    beforeUnmount: mergeAsArray,
    destroyed: mergeAsArray,
    unmounted: mergeAsArray,
    activated: mergeAsArray,
    deactivated: mergeAsArray,
    errorCaptured: mergeAsArray,
    serverPrefetch: mergeAsArray,
    // assets
    components: mergeObjectOptions,
    directives: mergeObjectOptions,
    // watch
    watch: mergeWatchOptions,
    // provide / inject
    provide: mergeDataFn,
    inject: mergeInject
  };

  function mergeDataFn(to, from) {
    if (!from) {
      return to;
    }

    if (!to) {
      return from;
    }

    return function mergedDataFn() {
      return extend(isFunction(to) ? to.call(this, this) : to, isFunction(from) ? from.call(this, this) : from);
    };
  }

  function mergeInject(to, from) {
    return mergeObjectOptions(normalizeInject(to), normalizeInject(from));
  }

  function normalizeInject(raw) {
    if (isArray(raw)) {
      const res = {};

      for (let i = 0; i < raw.length; i++) {
        res[raw[i]] = raw[i];
      }

      return res;
    }

    return raw;
  }

  function mergeAsArray(to, from) {
    return to ? [...new Set([].concat(to, from))] : from;
  }

  function mergeObjectOptions(to, from) {
    return to ? extend(extend(Object.create(null), to), from) : from;
  }

  function mergeWatchOptions(to, from) {
    if (!to) return from;
    if (!from) return to;
    const merged = extend(Object.create(null), to);

    for (const key in from) {
      merged[key] = mergeAsArray(to[key], from[key]);
    }

    return merged;
  }

  const queuePostRenderEffect = queueEffectWithSuspense;

  const isTeleport = type => type.__isTeleport;

  const NULL_DYNAMIC_COMPONENT = Symbol();

  const Fragment = Symbol(process.env.NODE_ENV !== 'production' ? 'Fragment' : undefined);
  const Text = Symbol(process.env.NODE_ENV !== 'production' ? 'Text' : undefined);
  const Comment = Symbol(process.env.NODE_ENV !== 'production' ? 'Comment' : undefined);
  const Static = Symbol(process.env.NODE_ENV !== 'production' ? 'Static' : undefined); // Since v-if and v-for are the two possible ways node structure can dynamically
  let currentBlock = null;

  function isVNode(value) {
    return value ? value.__v_isVNode === true : false;
  }

  const createVNodeWithArgsTransform = (...args) => {
    return _createVNode(...( args));
  };

  const InternalObjectKey = `__vInternal`;

  const normalizeKey = ({
    key
  }) => key != null ? key : null;

  const normalizeRef = ({
    ref,
    ref_key,
    ref_for
  }) => {
    return ref != null ? isString(ref) || isRef(ref) || isFunction(ref) ? {
      i: currentRenderingInstance,
      r: ref,
      k: ref_key,
      f: !!ref_for
    } : ref : null;
  };

  function createBaseVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, shapeFlag = type === Fragment ? 0 : 1
  /* ELEMENT */
  , isBlockNode = false, needFullChildrenNormalization = false) {
    const vnode = {
      __v_isVNode: true,
      __v_skip: true,
      type,
      props,
      key: props && normalizeKey(props),
      ref: props && normalizeRef(props),
      scopeId: currentScopeId,
      slotScopeIds: null,
      children,
      component: null,
      suspense: null,
      ssContent: null,
      ssFallback: null,
      dirs: null,
      transition: null,
      el: null,
      anchor: null,
      target: null,
      targetAnchor: null,
      staticCount: 0,
      shapeFlag,
      patchFlag,
      dynamicProps,
      dynamicChildren: null,
      appContext: null
    };

    if (needFullChildrenNormalization) {
      normalizeChildren(vnode, children); // normalize suspense children

      if (shapeFlag & 128
      /* SUSPENSE */
      ) {
          type.normalize(vnode);
        }
    } else if (children) {
      // compiled element vnode - if children is passed, only possible types are
      // string or Array.
      vnode.shapeFlag |= isString(children) ? 8
      /* TEXT_CHILDREN */
      : 16
      /* ARRAY_CHILDREN */
      ;
    } // validate key


    if (process.env.NODE_ENV !== 'production' && vnode.key !== vnode.key) {
      warn(`VNode created with invalid key (NaN). VNode type:`, vnode.type);
    } // track vnode for block tree


    if ( // avoid a block node from tracking itself
    !isBlockNode && // has current parent block
    currentBlock && ( // presence of a patch flag indicates this node needs patching on updates.
    // component nodes also should always be patched, because even if the
    // component doesn't need to update, it needs to persist the instance on to
    // the next vnode so that it can be properly unmounted later.
    vnode.patchFlag > 0 || shapeFlag & 6
    /* COMPONENT */
    ) && // the EVENTS flag is only for hydration and if it is the only flag, the
    // vnode should not be considered dynamic due to handler caching.
    vnode.patchFlag !== 32
    /* HYDRATE_EVENTS */
    ) {
        currentBlock.push(vnode);
      }

    return vnode;
  }

  const createVNode = process.env.NODE_ENV !== 'production' ? createVNodeWithArgsTransform : _createVNode;

  function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
    if (!type || type === NULL_DYNAMIC_COMPONENT) {
      if (process.env.NODE_ENV !== 'production' && !type) {
        warn(`Invalid vnode type when creating vnode: ${type}.`);
      }

      type = Comment;
    }

    if (isVNode(type)) {
      // createVNode receiving an existing vnode. This happens in cases like
      // <component :is="vnode"/>
      // #2078 make sure to merge refs during the clone instead of overwriting it
      const cloned = cloneVNode(type, props, true
      /* mergeRef: true */
      );

      if (children) {
        normalizeChildren(cloned, children);
      }

      return cloned;
    } // class component normalization.


    if (isClassComponent(type)) {
      type = type.__vccOpts;
    } // class & style normalization.


    if (props) {
      // for reactive or proxy objects, we need to clone it to enable mutation.
      props = guardReactiveProps(props);
      let {
        class: klass,
        style
      } = props;

      if (klass && !isString(klass)) {
        props.class = normalizeClass(klass);
      }

      if (isObject(style)) {
        // reactive state objects need to be cloned since they are likely to be
        // mutated
        if (isProxy(style) && !isArray(style)) {
          style = extend({}, style);
        }

        props.style = normalizeStyle(style);
      }
    } // encode the vnode type information into a bitmap


    const shapeFlag = isString(type) ? 1
    /* ELEMENT */
    : isSuspense(type) ? 128
    /* SUSPENSE */
    : isTeleport(type) ? 64
    /* TELEPORT */
    : isObject(type) ? 4
    /* STATEFUL_COMPONENT */
    : isFunction(type) ? 2
    /* FUNCTIONAL_COMPONENT */
    : 0;

    if (process.env.NODE_ENV !== 'production' && shapeFlag & 4
    /* STATEFUL_COMPONENT */
    && isProxy(type)) {
      type = toRaw(type);
      warn(`Vue received a Component which was made a reactive object. This can ` + `lead to unnecessary performance overhead, and should be avoided by ` + `marking the component with \`markRaw\` or using \`shallowRef\` ` + `instead of \`ref\`.`, `\nComponent that was made reactive: `, type);
    }

    return createBaseVNode(type, props, children, patchFlag, dynamicProps, shapeFlag, isBlockNode, true);
  }

  function guardReactiveProps(props) {
    if (!props) return null;
    return isProxy(props) || InternalObjectKey in props ? extend({}, props) : props;
  }

  function cloneVNode(vnode, extraProps, mergeRef = false) {
    // This is intentionally NOT using spread or extend to avoid the runtime
    // key enumeration cost.
    const {
      props,
      ref,
      patchFlag,
      children
    } = vnode;
    const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
    const cloned = {
      __v_isVNode: true,
      __v_skip: true,
      type: vnode.type,
      props: mergedProps,
      key: mergedProps && normalizeKey(mergedProps),
      ref: extraProps && extraProps.ref ? // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      mergeRef && ref ? isArray(ref) ? ref.concat(normalizeRef(extraProps)) : [ref, normalizeRef(extraProps)] : normalizeRef(extraProps) : ref,
      scopeId: vnode.scopeId,
      slotScopeIds: vnode.slotScopeIds,
      children: process.env.NODE_ENV !== 'production' && patchFlag === -1
      /* HOISTED */
      && isArray(children) ? children.map(deepCloneVNode) : children,
      target: vnode.target,
      targetAnchor: vnode.targetAnchor,
      staticCount: vnode.staticCount,
      shapeFlag: vnode.shapeFlag,
      // if the vnode is cloned with extra props, we can no longer assume its
      // existing patch flag to be reliable and need to add the FULL_PROPS flag.
      // note: preserve flag for fragments since they use the flag for children
      // fast paths only.
      patchFlag: extraProps && vnode.type !== Fragment ? patchFlag === -1 // hoisted node
      ? 16
      /* FULL_PROPS */
      : patchFlag | 16
      /* FULL_PROPS */
      : patchFlag,
      dynamicProps: vnode.dynamicProps,
      dynamicChildren: vnode.dynamicChildren,
      appContext: vnode.appContext,
      dirs: vnode.dirs,
      transition: vnode.transition,
      // These should technically only be non-null on mounted VNodes. However,
      // they *should* be copied for kept-alive vnodes. So we just always copy
      // them since them being non-null during a mount doesn't affect the logic as
      // they will simply be overwritten.
      component: vnode.component,
      suspense: vnode.suspense,
      ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
      ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
      el: vnode.el,
      anchor: vnode.anchor
    };
    return cloned;
  }
  /**
   * Dev only, for HMR of hoisted vnodes reused in v-for
   * https://github.com/vitejs/vite/issues/2022
   */


  function deepCloneVNode(vnode) {
    const cloned = cloneVNode(vnode);

    if (isArray(vnode.children)) {
      cloned.children = vnode.children.map(deepCloneVNode);
    }

    return cloned;
  }
  /**
   * @private
   */


  function createTextVNode(text = ' ', flag = 0) {
    return createVNode(Text, null, text, flag);
  }

  function normalizeChildren(vnode, children) {
    let type = 0;
    const {
      shapeFlag
    } = vnode;

    if (children == null) {
      children = null;
    } else if (isArray(children)) {
      type = 16
      /* ARRAY_CHILDREN */
      ;
    } else if (typeof children === 'object') {
      if (shapeFlag & (1
      /* ELEMENT */
      | 64
      /* TELEPORT */
      )) {
        // Normalize slot to plain children for plain element and Teleport
        const slot = children.default;

        if (slot) {
          // _c marker is added by withCtx() indicating this is a compiled slot
          slot._c && (slot._d = false);
          normalizeChildren(vnode, slot());
          slot._c && (slot._d = true);
        }

        return;
      } else {
        type = 32
        /* SLOTS_CHILDREN */
        ;
        const slotFlag = children._;

        if (!slotFlag && !(InternalObjectKey in children)) {
          children._ctx = currentRenderingInstance;
        } else if (slotFlag === 3
        /* FORWARDED */
        && currentRenderingInstance) {
          // a child component receives forwarded slots from the parent.
          // its slot type is determined by its parent's slot type.
          if (currentRenderingInstance.slots._ === 1
          /* STABLE */
          ) {
              children._ = 1
              /* STABLE */
              ;
            } else {
            children._ = 2
            /* DYNAMIC */
            ;
            vnode.patchFlag |= 1024
            /* DYNAMIC_SLOTS */
            ;
          }
        }
      }
    } else if (isFunction(children)) {
      children = {
        default: children,
        _ctx: currentRenderingInstance
      };
      type = 32
      /* SLOTS_CHILDREN */
      ;
    } else {
      children = String(children); // force teleport children to array so it can be moved around

      if (shapeFlag & 64
      /* TELEPORT */
      ) {
          type = 16
          /* ARRAY_CHILDREN */
          ;
          children = [createTextVNode(children)];
        } else {
        type = 8
        /* TEXT_CHILDREN */
        ;
      }
    }

    vnode.children = children;
    vnode.shapeFlag |= type;
  }

  function mergeProps(...args) {
    const ret = {};

    for (let i = 0; i < args.length; i++) {
      const toMerge = args[i];

      for (const key in toMerge) {
        if (key === 'class') {
          if (ret.class !== toMerge.class) {
            ret.class = normalizeClass([ret.class, toMerge.class]);
          }
        } else if (key === 'style') {
          ret.style = normalizeStyle([ret.style, toMerge.style]);
        } else if (isOn(key)) {
          const existing = ret[key];
          const incoming = toMerge[key];

          if (incoming && existing !== incoming && !(isArray(existing) && existing.includes(incoming))) {
            ret[key] = existing ? [].concat(existing, incoming) : incoming;
          }
        } else if (key !== '') {
          ret[key] = toMerge[key];
        }
      }
    }

    return ret;
  }
  /**
   * #2437 In Vue 3, functional components do not have a public instance proxy but
   * they exist in the internal parent chain. For code that relies on traversing
   * public $parent chains, skip functional ones and go to the parent instead.
   */


  const getPublicInstance = i => {
    if (!i) return null;
    if (isStatefulComponent(i)) return getExposeProxy(i) || i.proxy;
    return getPublicInstance(i.parent);
  };

  const publicPropertiesMap = extend(Object.create(null), {
    $: i => i,
    $el: i => i.vnode.el,
    $data: i => i.data,
    $props: i => process.env.NODE_ENV !== 'production' ? shallowReadonly(i.props) : i.props,
    $attrs: i => process.env.NODE_ENV !== 'production' ? shallowReadonly(i.attrs) : i.attrs,
    $slots: i => process.env.NODE_ENV !== 'production' ? shallowReadonly(i.slots) : i.slots,
    $refs: i => process.env.NODE_ENV !== 'production' ? shallowReadonly(i.refs) : i.refs,
    $parent: i => getPublicInstance(i.parent),
    $root: i => getPublicInstance(i.root),
    $emit: i => i.emit,
    $options: i => __VUE_OPTIONS_API__ ? resolveMergedOptions(i) : i.type,
    $forceUpdate: i => () => queueJob(i.update),
    $nextTick: i => nextTick.bind(i.proxy),
    $watch: i => __VUE_OPTIONS_API__ ? instanceWatch.bind(i) : NOOP
  });

  if (process.env.NODE_ENV !== 'production' && !false) ;

  let currentInstance = null;

  const setCurrentInstance = instance => {
    currentInstance = instance;
    instance.scope.on();
  };

  const unsetCurrentInstance = () => {
    currentInstance && currentInstance.scope.off();
    currentInstance = null;
  };

  function isStatefulComponent(instance) {
    return instance.vnode.shapeFlag & 4
    /* STATEFUL_COMPONENT */
    ;
  }

  function getExposeProxy(instance) {
    if (instance.exposed) {
      return instance.exposeProxy || (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
        get(target, key) {
          if (key in target) {
            return target[key];
          } else if (key in publicPropertiesMap) {
            return publicPropertiesMap[key](instance);
          }
        }

      }));
    }
  }

  const classifyRE = /(?:^|[-_])(\w)/g;

  const classify = str => str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '');

  function getComponentName(Component) {
    return isFunction(Component) ? Component.displayName || Component.name : Component.name;
  }
  /* istanbul ignore next */


  function formatComponentName(instance, Component, isRoot = false) {
    let name = getComponentName(Component);

    if (!name && Component.__file) {
      const match = Component.__file.match(/([^/\\]+)\.\w+$/);

      if (match) {
        name = match[1];
      }
    }

    if (!name && instance && instance.parent) {
      // try to infer the name based on reverse resolution
      const inferFromRegistry = registry => {
        for (const key in registry) {
          if (registry[key] === Component) {
            return key;
          }
        }
      };

      name = inferFromRegistry(instance.components || instance.parent.type.components) || inferFromRegistry(instance.appContext.components);
    }

    return name ? classify(name) : isRoot ? `App` : `Anonymous`;
  }

  function isClassComponent(value) {
    return isFunction(value) && '__vccOpts' in value;
  }


  function h(type, propsOrChildren, children) {
    const l = arguments.length;

    if (l === 2) {
      if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
        // single vnode without props
        if (isVNode(propsOrChildren)) {
          return createVNode(type, null, [propsOrChildren]);
        } // props without children


        return createVNode(type, propsOrChildren);
      } else {
        // omit props
        return createVNode(type, null, propsOrChildren);
      }
    } else {
      if (l > 3) {
        children = Array.prototype.slice.call(arguments, 2);
      } else if (l === 3 && isVNode(children)) {
        children = [children];
      }

      return createVNode(type, propsOrChildren, children);
    }
  }

  const ssrContextKey = Symbol(process.env.NODE_ENV !== 'production' ? `ssrContext` : ``);

  function isShallow$1(value) {
    return !!(value && value["__v_isShallow"
    /* IS_SHALLOW */
    ]);
  }

  function initCustomFormatter() {
    /* eslint-disable no-restricted-globals */
    if (!(process.env.NODE_ENV !== 'production') || typeof window === 'undefined') {
      return;
    }

    const vueStyle = {
      style: 'color:#3ba776'
    };
    const numberStyle = {
      style: 'color:#0b1bc9'
    };
    const stringStyle = {
      style: 'color:#b62e24'
    };
    const keywordStyle = {
      style: 'color:#9d288c'
    }; // custom formatter for Chrome
    // https://www.mattzeunert.com/2016/02/19/custom-chrome-devtools-object-formatters.html

    const formatter = {
      header(obj) {
        // TODO also format ComponentPublicInstance & ctx.slots/attrs in setup
        if (!isObject(obj)) {
          return null;
        }

        if (obj.__isVue) {
          return ['div', vueStyle, `VueInstance`];
        } else if (isRef(obj)) {
          return ['div', {}, ['span', vueStyle, genRefFlag(obj)], '<', formatValue(obj.value), `>`];
        } else if (isReactive(obj)) {
          return ['div', {}, ['span', vueStyle, isShallow$1(obj) ? 'ShallowReactive' : 'Reactive'], '<', formatValue(obj), `>${isReadonly(obj) ? ` (readonly)` : ``}`];
        } else if (isReadonly(obj)) {
          return ['div', {}, ['span', vueStyle, isShallow$1(obj) ? 'ShallowReadonly' : 'Readonly'], '<', formatValue(obj), '>'];
        }

        return null;
      },

      hasBody(obj) {
        return obj && obj.__isVue;
      },

      body(obj) {
        if (obj && obj.__isVue) {
          return ['div', {}, ...formatInstance(obj.$)];
        }
      }

    };

    function formatInstance(instance) {
      const blocks = [];

      if (instance.type.props && instance.props) {
        blocks.push(createInstanceBlock('props', toRaw(instance.props)));
      }

      if (instance.setupState !== EMPTY_OBJ) {
        blocks.push(createInstanceBlock('setup', instance.setupState));
      }

      if (instance.data !== EMPTY_OBJ) {
        blocks.push(createInstanceBlock('data', toRaw(instance.data)));
      }

      const computed = extractKeys(instance, 'computed');

      if (computed) {
        blocks.push(createInstanceBlock('computed', computed));
      }

      const injected = extractKeys(instance, 'inject');

      if (injected) {
        blocks.push(createInstanceBlock('injected', injected));
      }

      blocks.push(['div', {}, ['span', {
        style: keywordStyle.style + ';opacity:0.66'
      }, '$ (internal): '], ['object', {
        object: instance
      }]]);
      return blocks;
    }

    function createInstanceBlock(type, target) {
      target = extend({}, target);

      if (!Object.keys(target).length) {
        return ['span', {}];
      }

      return ['div', {
        style: 'line-height:1.25em;margin-bottom:0.6em'
      }, ['div', {
        style: 'color:#476582'
      }, type], ['div', {
        style: 'padding-left:1.25em'
      }, ...Object.keys(target).map(key => {
        return ['div', {}, ['span', keywordStyle, key + ': '], formatValue(target[key], false)];
      })]];
    }

    function formatValue(v, asRaw = true) {
      if (typeof v === 'number') {
        return ['span', numberStyle, v];
      } else if (typeof v === 'string') {
        return ['span', stringStyle, JSON.stringify(v)];
      } else if (typeof v === 'boolean') {
        return ['span', keywordStyle, v];
      } else if (isObject(v)) {
        return ['object', {
          object: asRaw ? toRaw(v) : v
        }];
      } else {
        return ['span', stringStyle, String(v)];
      }
    }

    function extractKeys(instance, type) {
      const Comp = instance.type;

      if (isFunction(Comp)) {
        return;
      }

      const extracted = {};

      for (const key in instance.ctx) {
        if (isKeyOfType(Comp, key, type)) {
          extracted[key] = instance.ctx[key];
        }
      }

      return extracted;
    }

    function isKeyOfType(Comp, key, type) {
      const opts = Comp[type];

      if (isArray(opts) && opts.includes(key) || isObject(opts) && key in opts) {
        return true;
      }

      if (Comp.extends && isKeyOfType(Comp.extends, key, type)) {
        return true;
      }

      if (Comp.mixins && Comp.mixins.some(m => isKeyOfType(m, key, type))) {
        return true;
      }
    }

    function genRefFlag(v) {
      if (isShallow$1(v)) {
        return `ShallowRef`;
      }

      if (v.effect) {
        return `ComputedRef`;
      }

      return `Ref`;
    }

    if (window.devtoolsFormatters) {
      window.devtoolsFormatters.push(formatter);
    } else {
      window.devtoolsFormatters = [formatter];
    }
  }

  function initDev() {
    {
      initCustomFormatter();
    }
  } // This entry exports the runtime only, and is built as


  if (process.env.NODE_ENV !== 'production') {
    initDev();
  }

  const t = "http://www.w3.org/2000/svg";

  class e {
    constructor(t) {
      this.seed = t;
    }

    next() {
      return this.seed ? (2 ** 31 - 1 & (this.seed = Math.imul(48271, this.seed))) / 2 ** 31 : Math.random();
    }

  }

  function s(t, e, s, i, n) {
    return {
      type: "path",
      ops: c(t, e, s, i, n)
    };
  }

  function i(t, e, i) {
    const n = (t || []).length;

    if (n > 2) {
      const s = [];

      for (let e = 0; e < n - 1; e++) s.push(...c(t[e][0], t[e][1], t[e + 1][0], t[e + 1][1], i));

      return e && s.push(...c(t[n - 1][0], t[n - 1][1], t[0][0], t[0][1], i)), {
        type: "path",
        ops: s
      };
    }

    return 2 === n ? s(t[0][0], t[0][1], t[1][0], t[1][1], i) : {
      type: "path",
      ops: []
    };
  }

  function n(t, e, s, n, o) {
    return function (t, e) {
      return i(t, !0, e);
    }([[t, e], [t + s, e], [t + s, e + n], [t, e + n]], o);
  }

  function o(t, e, s, i, n) {
    return function (t, e, s, i) {
      const [n, o] = l(i.increment, t, e, i.rx, i.ry, 1, i.increment * h$1(.1, h$1(.4, 1, s), s), s);
      let r = f(n, null, s);

      if (!s.disableMultiStroke) {
        const [n] = l(i.increment, t, e, i.rx, i.ry, 1.5, 0, s),
              o = f(n, null, s);
        r = r.concat(o);
      }

      return {
        estimatedPoints: o,
        opset: {
          type: "path",
          ops: r
        }
      };
    }(t, e, n, function (t, e, s) {
      const i = Math.sqrt(2 * Math.PI * Math.sqrt((Math.pow(t / 2, 2) + Math.pow(e / 2, 2)) / 2)),
            n = Math.max(s.curveStepCount, s.curveStepCount / Math.sqrt(200) * i),
            o = 2 * Math.PI / n;
      let r = Math.abs(t / 2),
          h = Math.abs(e / 2);
      const c = 1 - s.curveFitting;
      return r += a(r * c, s), h += a(h * c, s), {
        increment: o,
        rx: r,
        ry: h
      };
    }(s, i, n)).opset;
  }

  function r(t) {
    return t.randomizer || (t.randomizer = new e(t.seed || 0)), t.randomizer.next();
  }

  function h$1(t, e, s, i = 1) {
    return s.roughness * i * (r(s) * (e - t) + t);
  }

  function a(t, e, s = 1) {
    return h$1(-t, t, e, s);
  }

  function c(t, e, s, i, n, o = !1) {
    const r = o ? n.disableMultiStrokeFill : n.disableMultiStroke,
          h = u(t, e, s, i, n, !0, !1);
    if (r) return h;
    const a = u(t, e, s, i, n, !0, !0);
    return h.concat(a);
  }

  function u(t, e, s, i, n, o, h) {
    const c = Math.pow(t - s, 2) + Math.pow(e - i, 2),
          u = Math.sqrt(c);
    let f = 1;
    f = u < 200 ? 1 : u > 500 ? .4 : -.0016668 * u + 1.233334;
    let l = n.maxRandomnessOffset || 0;
    l * l * 100 > c && (l = u / 10);
    const g = l / 2,
          d = .2 + .2 * r(n);

    let p = n.bowing * n.maxRandomnessOffset * (i - e) / 200,
        _ = n.bowing * n.maxRandomnessOffset * (t - s) / 200;

    p = a(p, n, f), _ = a(_, n, f);

    const m = [],
          w = () => a(g, n, f),
          v = () => a(l, n, f);

    return o && (h ? m.push({
      op: "move",
      data: [t + w(), e + w()]
    }) : m.push({
      op: "move",
      data: [t + a(l, n, f), e + a(l, n, f)]
    })), h ? m.push({
      op: "bcurveTo",
      data: [p + t + (s - t) * d + w(), _ + e + (i - e) * d + w(), p + t + 2 * (s - t) * d + w(), _ + e + 2 * (i - e) * d + w(), s + w(), i + w()]
    }) : m.push({
      op: "bcurveTo",
      data: [p + t + (s - t) * d + v(), _ + e + (i - e) * d + v(), p + t + 2 * (s - t) * d + v(), _ + e + 2 * (i - e) * d + v(), s + v(), i + v()]
    }), m;
  }

  function f(t, e, s) {
    const i = t.length,
          n = [];

    if (i > 3) {
      const o = [],
            r = 1 - s.curveTightness;
      n.push({
        op: "move",
        data: [t[1][0], t[1][1]]
      });

      for (let e = 1; e + 2 < i; e++) {
        const s = t[e];
        o[0] = [s[0], s[1]], o[1] = [s[0] + (r * t[e + 1][0] - r * t[e - 1][0]) / 6, s[1] + (r * t[e + 1][1] - r * t[e - 1][1]) / 6], o[2] = [t[e + 1][0] + (r * t[e][0] - r * t[e + 2][0]) / 6, t[e + 1][1] + (r * t[e][1] - r * t[e + 2][1]) / 6], o[3] = [t[e + 1][0], t[e + 1][1]], n.push({
          op: "bcurveTo",
          data: [o[1][0], o[1][1], o[2][0], o[2][1], o[3][0], o[3][1]]
        });
      }

      if (e && 2 === e.length) {
        const t = s.maxRandomnessOffset;
        n.push({
          op: "lineTo",
          data: [e[0] + a(t, s), e[1] + a(t, s)]
        });
      }
    } else 3 === i ? (n.push({
      op: "move",
      data: [t[1][0], t[1][1]]
    }), n.push({
      op: "bcurveTo",
      data: [t[1][0], t[1][1], t[2][0], t[2][1], t[2][0], t[2][1]]
    })) : 2 === i && n.push(...c(t[0][0], t[0][1], t[1][0], t[1][1], s));

    return n;
  }

  function l(t, e, s, i, n, o, r, h) {
    const c = [],
          u = [],
          f = a(.5, h) - Math.PI / 2;
    u.push([a(o, h) + e + .9 * i * Math.cos(f - t), a(o, h) + s + .9 * n * Math.sin(f - t)]);

    for (let r = f; r < 2 * Math.PI + f - .01; r += t) {
      const t = [a(o, h) + e + i * Math.cos(r), a(o, h) + s + n * Math.sin(r)];
      c.push(t), u.push(t);
    }

    return u.push([a(o, h) + e + i * Math.cos(f + 2 * Math.PI + .5 * r), a(o, h) + s + n * Math.sin(f + 2 * Math.PI + .5 * r)]), u.push([a(o, h) + e + .98 * i * Math.cos(f + r), a(o, h) + s + .98 * n * Math.sin(f + r)]), u.push([a(o, h) + e + .9 * i * Math.cos(f + .5 * r), a(o, h) + s + .9 * n * Math.sin(f + .5 * r)]), [u, c];
  }

  function g(t, e) {
    return {
      maxRandomnessOffset: 2,
      roughness: "highlight" === t ? 3 : 1.5,
      bowing: 1,
      stroke: "#000",
      strokeWidth: 1.5,
      curveTightness: 0,
      curveFitting: .95,
      curveStepCount: 9,
      fillStyle: "hachure",
      fillWeight: -1,
      hachureAngle: -41,
      hachureGap: -1,
      dashOffset: -1,
      dashGap: -1,
      zigzagOffset: -1,
      combineNestedSvgPaths: !1,
      disableMultiStroke: "double" !== t,
      disableMultiStrokeFill: !1,
      seed: e
    };
  }

  function d(e, r, h, a, c, u) {
    const f = [];
    let l = h.strokeWidth || 2;

    const d = function (t) {
      const e = t.padding;

      if (e || 0 === e) {
        if ("number" == typeof e) return [e, e, e, e];

        if (Array.isArray(e)) {
          const t = e;
          if (t.length) switch (t.length) {
            case 4:
              return [...t];

            case 1:
              return [t[0], t[0], t[0], t[0]];

            case 2:
              return [...t, ...t];

            case 3:
              return [...t, t[1]];

            default:
              return [t[0], t[1], t[2], t[3]];
          }
        }
      }

      return [5, 5, 5, 5];
    }(h),
          p = void 0 === h.animate || !!h.animate,
          _ = h.iterations || 2,
          m = h.rtl ? 1 : 0,
          w = g("single", u);

    switch (h.type) {
      case "underline":
        {
          const t = r.y + r.h + d[2];

          for (let e = m; e < _ + m; e++) e % 2 ? f.push(s(r.x + r.w, t, r.x, t, w)) : f.push(s(r.x, t, r.x + r.w, t, w));

          break;
        }

      case "strike-through":
        {
          const t = r.y + r.h / 2;

          for (let e = m; e < _ + m; e++) e % 2 ? f.push(s(r.x + r.w, t, r.x, t, w)) : f.push(s(r.x, t, r.x + r.w, t, w));

          break;
        }

      case "box":
        {
          const t = r.x - d[3],
                e = r.y - d[0],
                s = r.w + (d[1] + d[3]),
                i = r.h + (d[0] + d[2]);

          for (let o = 0; o < _; o++) f.push(n(t, e, s, i, w));

          break;
        }

      case "bracket":
        {
          const t = Array.isArray(h.brackets) ? h.brackets : h.brackets ? [h.brackets] : ["right"],
                e = r.x - 2 * d[3],
                s = r.x + r.w + 2 * d[1],
                n = r.y - 2 * d[0],
                o = r.y + r.h + 2 * d[2];

          for (const h of t) {
            let t;

            switch (h) {
              case "bottom":
                t = [[e, r.y + r.h], [e, o], [s, o], [s, r.y + r.h]];
                break;

              case "top":
                t = [[e, r.y], [e, n], [s, n], [s, r.y]];
                break;

              case "left":
                t = [[r.x, n], [e, n], [e, o], [r.x, o]];
                break;

              case "right":
                t = [[r.x + r.w, n], [s, n], [s, o], [r.x + r.w, o]];
            }

            t && f.push(i(t, !1, w));
          }

          break;
        }

      case "crossed-off":
        {
          const t = r.x,
                e = r.y,
                i = t + r.w,
                n = e + r.h;

          for (let o = m; o < _ + m; o++) o % 2 ? f.push(s(i, n, t, e, w)) : f.push(s(t, e, i, n, w));

          for (let o = m; o < _ + m; o++) o % 2 ? f.push(s(t, n, i, e, w)) : f.push(s(i, e, t, n, w));

          break;
        }

      case "circle":
        {
          const t = g("double", u),
                e = r.w + (d[1] + d[3]),
                s = r.h + (d[0] + d[2]),
                i = r.x - d[3] + e / 2,
                n = r.y - d[0] + s / 2,
                h = Math.floor(_ / 2),
                a = _ - 2 * h;

          for (let r = 0; r < h; r++) f.push(o(i, n, e, s, t));

          for (let t = 0; t < a; t++) f.push(o(i, n, e, s, w));

          break;
        }

      case "highlight":
        {
          const t = g("highlight", u);
          l = .95 * r.h;
          const e = r.y + r.h / 2;

          for (let i = m; i < _ + m; i++) i % 2 ? f.push(s(r.x + r.w, e, r.x, e, t)) : f.push(s(r.x, e, r.x + r.w, e, t));

          break;
        }
    }

    if (f.length) {
      const s = function (t) {
        const e = [];

        for (const s of t) {
          let t = "";

          for (const i of s.ops) {
            const s = i.data;

            switch (i.op) {
              case "move":
                t.trim() && e.push(t.trim()), t = `M${s[0]} ${s[1]} `;
                break;

              case "bcurveTo":
                t += `C${s[0]} ${s[1]}, ${s[2]} ${s[3]}, ${s[4]} ${s[5]} `;
                break;

              case "lineTo":
                t += `L${s[0]} ${s[1]} `;
            }
          }

          t.trim() && e.push(t.trim());
        }

        return e;
      }(f),
            i = [],
            n = [];

      let o = 0;

      const r = (t, e, s) => t.setAttribute(e, s);

      for (const a of s) {
        const s = document.createElementNS(t, "path");

        if (r(s, "d", a), r(s, "fill", "none"), r(s, "stroke", h.color || "currentColor"), r(s, "stroke-width", "" + l), p) {
          const t = s.getTotalLength();
          i.push(t), o += t;
        }

        e.appendChild(s), n.push(s);
      }

      if (p) {
        let t = 0;

        for (let e = 0; e < n.length; e++) {
          const s = n[e],
                r = i[e],
                h = o ? c * (r / o) : 0,
                u = a + t,
                f = s.style;
          f.strokeDashoffset = "" + r, f.strokeDasharray = "" + r, f.animation = `rough-notation-dash ${h}ms ease-out ${u}ms forwards`, t += h;
        }
      }
    }
  }

  class p {
    constructor(t, e) {
      this._state = "unattached", this._resizing = !1, this._seed = Math.floor(Math.random() * 2 ** 31), this._lastSizes = [], this._animationDelay = 0, this._resizeListener = () => {
        this._resizing || (this._resizing = !0, setTimeout(() => {
          this._resizing = !1, "showing" === this._state && this.haveRectsChanged() && this.show();
        }, 400));
      }, this._e = t, this._config = JSON.parse(JSON.stringify(e)), this.attach();
    }

    get animate() {
      return this._config.animate;
    }

    set animate(t) {
      this._config.animate = t;
    }

    get animationDuration() {
      return this._config.animationDuration;
    }

    set animationDuration(t) {
      this._config.animationDuration = t;
    }

    get iterations() {
      return this._config.iterations;
    }

    set iterations(t) {
      this._config.iterations = t;
    }

    get color() {
      return this._config.color;
    }

    set color(t) {
      this._config.color !== t && (this._config.color = t, this.refresh());
    }

    get strokeWidth() {
      return this._config.strokeWidth;
    }

    set strokeWidth(t) {
      this._config.strokeWidth !== t && (this._config.strokeWidth = t, this.refresh());
    }

    get padding() {
      return this._config.padding;
    }

    set padding(t) {
      this._config.padding !== t && (this._config.padding = t, this.refresh());
    }

    attach() {
      if ("unattached" === this._state && this._e.parentElement) {
        !function () {
          if (!window.__rno_kf_s) {
            const t = window.__rno_kf_s = document.createElement("style");
            t.textContent = "@keyframes rough-notation-dash { to { stroke-dashoffset: 0; } }", document.head.appendChild(t);
          }
        }();
        const e = this._svg = document.createElementNS(t, "svg");
        e.setAttribute("class", "rough-annotation");
        const s = e.style;
        s.position = "absolute", s.top = "0", s.left = "0", s.overflow = "visible", s.pointerEvents = "none", s.width = "100px", s.height = "100px";
        const i = "highlight" === this._config.type;

        if (this._e.insertAdjacentElement(i ? "beforebegin" : "afterend", e), this._state = "not-showing", i) {
          const t = window.getComputedStyle(this._e).position;
          (!t || "static" === t) && (this._e.style.position = "relative");
        }

        this.attachListeners();
      }
    }

    detachListeners() {
      window.removeEventListener("resize", this._resizeListener), this._ro && this._ro.unobserve(this._e);
    }

    attachListeners() {
      this.detachListeners(), window.addEventListener("resize", this._resizeListener, {
        passive: !0
      }), !this._ro && "ResizeObserver" in window && (this._ro = new window.ResizeObserver(t => {
        for (const e of t) e.contentRect && this._resizeListener();
      })), this._ro && this._ro.observe(this._e);
    }

    haveRectsChanged() {
      if (this._lastSizes.length) {
        const t = this.rects();
        if (t.length !== this._lastSizes.length) return !0;

        for (let e = 0; e < t.length; e++) if (!this.isSameRect(t[e], this._lastSizes[e])) return !0;
      }

      return !1;
    }

    isSameRect(t, e) {
      const s = (t, e) => Math.round(t) === Math.round(e);

      return s(t.x, e.x) && s(t.y, e.y) && s(t.w, e.w) && s(t.h, e.h);
    }

    isShowing() {
      return "not-showing" !== this._state;
    }

    refresh() {
      this.isShowing() && !this.pendingRefresh && (this.pendingRefresh = Promise.resolve().then(() => {
        this.isShowing() && this.show(), delete this.pendingRefresh;
      }));
    }

    show() {
      switch (this._state) {
        case "unattached":
          break;

        case "showing":
          this.hide(), this._svg && this.render(this._svg, !0);
          break;

        case "not-showing":
          this.attach(), this._svg && this.render(this._svg, !1);
      }
    }

    hide() {
      if (this._svg) for (; this._svg.lastChild;) this._svg.removeChild(this._svg.lastChild);
      this._state = "not-showing";
    }

    remove() {
      this._svg && this._svg.parentElement && this._svg.parentElement.removeChild(this._svg), this._svg = void 0, this._state = "unattached", this.detachListeners();
    }

    render(t, e) {
      let s = this._config;
      e && (s = JSON.parse(JSON.stringify(this._config)), s.animate = !1);
      const i = this.rects();
      let n = 0;
      i.forEach(t => n += t.w);
      const o = s.animationDuration || 800;
      let r = 0;

      for (let e = 0; e < i.length; e++) {
        const h = o * (i[e].w / n);
        d(t, i[e], s, r + this._animationDelay, h, this._seed), r += h;
      }

      this._lastSizes = i, this._state = "showing";
    }

    rects() {
      const t = [];
      if (this._svg) if (this._config.multiline) {
        const e = this._e.getClientRects();

        for (let s = 0; s < e.length; s++) t.push(this.svgRect(this._svg, e[s]));
      } else t.push(this.svgRect(this._svg, this._e.getBoundingClientRect()));
      return t;
    }

    svgRect(t, e) {
      const s = t.getBoundingClientRect(),
            i = e;
      return {
        x: (i.x || i.left) - (s.x || s.left),
        y: (i.y || i.top) - (s.y || s.top),
        w: i.width,
        h: i.height
      };
    }

  }

  function _(t, e) {
    return new p(t, e);
  }

  function m(t) {
    let e = 0;

    for (const s of t) {
      const t = s;
      t._animationDelay = e;
      e += 0 === t.animationDuration ? 0 : t.animationDuration || 800;
    }

    const s = [...t];
    return {
      show() {
        for (const t of s) t.show();
      },

      hide() {
        for (const t of s) t.hide();
      }

    };
  }

  const ADD_ANNOTATION = 'annotation:add';
  const REMOVE_ANNOTATION = 'annotation:remove';

  const AVAILABLE_TYPES = ['underline', 'box', 'circle', 'highlight', 'strike-through', 'crossed-off', 'bracket'];
  var RoughNotation = (options => defineComponent({
    name: 'RoughNotation',
    emits: ['init'],
    props: {
      type: {
        type: String,
        required: true,

        validator(type) {
          return AVAILABLE_TYPES.indexOf(type) > -1;
        }

      },
      tag: {
        type: String,
        default: 'span'
      },
      isShow: {
        type: Boolean,
        default: false
      },
      animate: {
        type: Boolean,
        default: () => options.animate
      },
      animationDuration: {
        type: Number,
        default: () => options.animationDuration
      },
      color: {
        type: String,
        default: () => options.color
      },
      strokeWidth: {
        type: Number,
        default: () => options.strokeWidth
      },
      padding: {
        type: [Number, Array],
        default: () => options.padding
      },
      multiline: {
        type: Boolean,
        default: () => options.multiline
      },
      iterations: {
        type: Number,
        default: () => options.iterations
      },
      brackets: {
        type: [String, Array],
        default: () => options.brackets
      },
      order: {
        type: [Number, String],
        default: 0
      }
    },

    mounted() {
      this.annotation = _(this.$el, {
        type: this.type,
        animate: this.animate,
        animationDuration: this.animationDuration,
        color: this.color,
        strokeWidth: this.strokeWidth,
        padding: this.padding,
        multiline: this.multiline,
        iterations: this.iterations,
        brackets: this.brackets
      });
      this.$emit('init', this.annotation);
      this.$_dispatchGroup(ADD_ANNOTATION);
      this.$watch('isShow', value => {
        if (value) {
          this.show();
        } else {
          this.hide();
        }
      }, {
        immediate: true
      });
      this.$watch('color', value => {
        this.annotation.color = value;
      });
      this.$watch('strokeWidth', value => {
        this.annotation.strokeWidth = value;
      });
      this.$watch('padding', value => {
        this.annotation.padding = value;
      });
    },

    beforeUnmount() {
      this.$_dispatchGroup(REMOVE_ANNOTATION);
      this.annotation && this.annotation.remove();
    },

    methods: {
      show() {
        this.annotation && this.annotation.show();
      },

      hide() {
        this.annotation && this.annotation.hide();
      },

      isShowing() {
        return !!(this.annotation && this.annotation.isShowing());
      },

      $_dispatchGroup(event) {
        let parent = this.$parent || this.$root;
        let name = parent.$options.name;

        while (parent && (!name || name !== 'RoughNotationGroup')) {
          parent = parent.$parent;

          if (parent) {
            name = parent.$options.name;
          }
        }

        if (parent) {
          parent.emitter.emit(event, this);
        }
      }

    },

    render(h2) {
      // vue2
      if (h2 && typeof h2 === 'function') {
        const slot = this.$slots.default;

        if (this.tag) {
          return h2(this.tag, null, slot);
        }

        return slot && slot[0];
      } // vue3


      const slot = this.$slots.default();

      if (this.tag) {
        return h(this.tag, null, slot);
      }

      return slot && slot[0];
    }

  }));

  function mitt (n) {
    return {
      all: n = n || new Map(),
      on: function (t, e) {
        var i = n.get(t);
        i ? i.push(e) : n.set(t, [e]);
      },
      off: function (t, e) {
        var i = n.get(t);
        i && (e ? i.splice(i.indexOf(e) >>> 0, 1) : n.set(t, []));
      },
      emit: function (t, e) {
        var i = n.get(t);
        i && i.slice().map(function (n) {
          n(e);
        }), (i = n.get("*")) && i.slice().map(function (n) {
          n(t, e);
        });
      }
    };
  }

  function defaultOrderFn(a, b) {
    return a - b; // asc order
  }

  var RoughNotationGroup = defineComponent({
    name: 'RoughNotationGroup',
    props: {
      isShow: {
        type: Boolean,
        default: false
      },
      tag: {
        type: String,
        default: 'div'
      },
      orderAnnotations: {
        type: Function,
        default: defaultOrderFn
      }
    },

    data() {
      return {
        rnVueInstances: []
      };
    },

    watch: {
      isShow(value) {
        if (value) {
          this.show();
        } else {
          this.hide();
        }
      },

      rnVueInstances(instances) {
        const annotations = this.$_order(instances);
        this.group = m(annotations);
      }

    },

    created() {
      this.emitter = mitt();
      this.emitter.on(ADD_ANNOTATION, rnVm => {
        this.$_add(rnVm);
      });
      this.emitter.on(REMOVE_ANNOTATION, rnVm => {
        this.$_remove(rnVm);
      });
    },

    mounted() {
      if (this.isShow) {
        this.show();
      }
    },

    beforeUnmount() {
      this.emitter.all.clear();
    },

    methods: {
      show() {
        this.group && this.group.show();
      },

      hide() {
        this.group && this.group.hide();
      },

      $_order(instances) {
        const orderFn = typeof this.orderAnnotations === 'function' ? this.orderAnnotations : defaultOrderFn;
        return instances.slice().sort((vmA, vmB) => orderFn(vmA.order, vmB.order)) // order
        .map(vm => vm.annotation); // pluck annotation
      },

      $_add(rnVm) {
        this.rnVueInstances = this.rnVueInstances.concat(rnVm);
      },

      $_remove(rnVm) {
        const index = this.rnVueInstances.indexOf(rnVm);

        if (index > -1) {
          this.rnVueInstances.splice(index, 1);
        }
      }

    },

    render(h2) {
      // vue2
      if (h2 && typeof h2 === 'function') {
        const slot = this.$slots.default;

        if (this.tag) {
          return h2(this.tag, null, slot);
        }

        return slot && slot[0];
      } // vue3


      const slot = this.$slots.default();

      if (this.tag) {
        return h(this.tag, {}, slot);
      }

      return slot && slot[0];
    }

  });

  /**
   * install function
   * @param {App} app
   * @param {Object} options RoughNotation options
   */

  const install = (app, options = {}) => {
    const finalOptions = { ...defaultOptions,
      ...options
    };
    const RoughNotationComponent = RoughNotation(finalOptions);
    app.component('rough-notation', RoughNotationComponent);
    app.component('RoughNotation', RoughNotationComponent);
    app.component('rough-notation-group', RoughNotationGroup);
    app.component('RoughNotationGroup', RoughNotationGroup);
  };

  const VueRoughNotationPlugin = {
    install
  };

  return VueRoughNotationPlugin;

})));

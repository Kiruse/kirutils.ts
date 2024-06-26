type Ctor = new (...args: any[]) => any;

export function validate<T>(subject: any) {
  return new Validator<T>(subject);
}

class Inspector {
  optional = false;

  constructor(public subject: any, public path?: string) {}

  assert(condition: boolean | ((subject: any) => boolean), message = 'Assertion failed') {
    if (this.path) message = `${message} at ${this.path}`;
    if (typeof condition === 'function') condition = condition(this.subject);
    if (!condition) throw new ValidationError(message);
    return this;
  }

  isOptional = () => { this.optional = true; return this; }
  isString = () => this.assert(this.optional || typeof this.subject === 'string', `Not a string`);
  isBoolean = () => this.assert(this.optional || typeof this.subject === 'boolean', `Not a boolean`);
  isNumber = () => this.assert(this.optional || typeof this.subject === 'number', `Not a number`);
  isBigInt = () => this.assert(this.optional || typeof this.subject === 'bigint', `Not a bigint`);
  isSymbol = () => this.assert(this.optional || typeof this.subject === 'symbol', `Not a symbol`);
  isArray = () => this.assert(this.optional || Array.isArray(this.subject), `Not an array`);
  isObject = () => this.assert(this.optional || typeof this.subject === 'object', `Not an object`);
  isFunction = () => this.assert(this.optional || typeof this.subject === 'function', `Not a function`);
  isInstanceOf = (ctor: Ctor) => this.assert(this.optional || this.subject instanceof ctor, `Not a ${ctor.name}`);
  isOneOf = (values: any[]) => this.assert(this.optional || values.includes(this.subject), `Expected one of ${values.join(', ')}`);
  isNoneOf = (values: any[]) => this.assert(this.optional || !values.includes(this.subject), `Expected none of ${values.join(', ')}`);
  isTruthy = () => this.assert(this.subject, 'Not truthy');
  isFalsy = () => this.assert(!this.subject, 'Not falsy');
  isNull = () => this.assert(this.subject === null, 'Not null');
  isUndef = () => this.assert(this.subject === undefined, 'Not undefined');
  isDef = () => this.assert(this.subject !== undefined, 'Not defined');
  eq = (value: any) => this.assert(this.optional || this.subject === value, `Not equal to: ${value}`);
  neq = (value: any) => this.assert(this.optional || this.subject !== value, `Equal to: ${value}`);
  is = (value: any) => this.assert(this.optional || Object.is(this.subject, value), `Isn't: ${value}`);
  isnt = (value: any) => this.assert(this.optional || !Object.is(this.subject, value), `Is: ${value}`);
}

export class Validator<T> extends Inspector {
  constructor(subject: any) {
    super(subject);
  }

  has(...keypath: PropertyKey[]) {
    const value = getDeep(this.subject, keypath);
    return this.assert(value !== undefined, `Missing property ${stringifyKeyPath(keypath)}`);
  }

  at(keypath: PropertyKey[], callback: (val: Inspector) => void) {
    for (const [path, value] of iterateDeep(this.subject, keypath)) {
      callback(new Inspector(value, stringifyKeyPath(path)));
    }
    return this;
  }

  /** Get the value retyped as `T`. Only call this once you're sufficiently certain with your
   * validations that this is true.
   */
  get value(): T { return this.subject }
}

const getDeep = (obj: any, keypath: PropertyKey[]) => keypath.reduce((acc, key) => acc?.[key], obj);

function* iterateDeep(obj: any, keypath: PropertyKey[], depth = 0): Generator<[PropertyKey[], any]> {
  for (let i = depth; i < keypath.length; i++) {
    const key = keypath[i];
    if (key === '*') {
      if (Array.isArray(obj)) {
        for (let j = 0; j < obj.length; j++) {
          const localKeypath = keypath.slice();
          localKeypath[depth] = j;
          yield* iterateDeep(obj[j], localKeypath, i + 1);
        }
      } else {
        for (const key in obj) {
          const localKeypath = keypath.slice();
          localKeypath[depth] = key;
          yield* iterateDeep(obj[key], localKeypath, i + 1);
        }
      }
      return;
    } else {
      obj = obj?.[key];
    }
  }
  yield [keypath, obj];
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

function stringifyKeyPath(path: PropertyKey[]): string {
  let result = '';
  for (const key of path) {
    if (typeof key === 'string') {
      result += `.${key}`;
    } else {
      result += `[${key.toString()}]`;
    }
  }
  return result;
}

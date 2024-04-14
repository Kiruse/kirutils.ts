type Ctor = new (...args: any[]) => any;

export function validate<T>(subject: any) {
  return new Validator<T>(subject);
}

class Inspector {
  constructor(public subject: any, public path?: string) {}

  assert(condition: boolean | ((subject: any) => boolean), message: string) {
    if (this.path) message = `${message} at ${this.path}`;
    if (typeof condition === 'function') condition = condition(this.subject);
    if (!condition) throw new ValidationError(message);
    return this;
  }

  isString = () => this.assert(typeof this.subject === 'string', `Not a string`);
  isBoolean = () => this.assert(typeof this.subject === 'boolean', `Not a boolean`);
  isNumber = () => this.assert(typeof this.subject === 'number', `Not a number`);
  isBigInt = () => this.assert(typeof this.subject === 'bigint', `Not a bigint`);
  isSymbol = () => this.assert(typeof this.subject === 'symbol', `Not a symbol`);
  isArray = () => this.assert(Array.isArray(this.subject), `Not an array`);
  isObject = () => this.assert(typeof this.subject === 'object', `Not an object`);
  isFunction = () => this.assert(typeof this.subject === 'function', `Not a function`);
  isInstanceOf = (ctor: Ctor) => this.assert(this.subject instanceof ctor, `Not a ${ctor.name}`);
  isOneOf = (values: any[]) => this.assert(values.includes(this.subject), `Expected one of ${values.join(', ')}`);
  isNoneOf = (values: any[]) => this.assert(!values.includes(this.subject), `Expected none of ${values.join(', ')}`);
  isTruthy = () => this.assert(this.subject, 'Not truthy');
  isFalsy = () => this.assert(!this.subject, 'Not falsy');
  isNull = () => this.assert(this.subject === null, 'Not null');
  isUndef = () => this.assert(this.subject === undefined, 'Not undefined');
  isDef = () => this.assert(this.subject !== undefined, 'Not defined');
  eq = (value: any) => this.assert(this.subject === value, `Not equal to: ${value}`);
  neq = (value: any) => this.assert(this.subject !== value, `Equal to: ${value}`);
  is = (value: any) => this.assert(Object.is(this.subject, value), `Isn't: ${value}`);
  isnt = (value: any) => this.assert(!Object.is(this.subject, value), `Is: ${value}`);
}

export class Validator<T> extends Inspector {
  constructor(subject: any) {
    super(subject);
  }

  has(...keypath: PropertyKey[]) {
    const value = getDeep(this.subject, keypath);
    return this.assert(value !== undefined, `Missing property ${stringifyKeyPath(keypath)}`);
  }

  at(keypath: PropertyKey[], callback: (inspector: Inspector) => void) {
    callback(new Inspector(getDeep(this.subject, keypath), stringifyKeyPath(keypath)));
    return this;
  }

  /** Get the value retyped as `T`. Only call this once you're sufficiently certain with your
   * validations that this is true.
   */
  get value(): T { return this.subject }
}

const getDeep = (obj: any, keypath: PropertyKey[]) => keypath.reduce((acc, key) => acc?.[key], obj);

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

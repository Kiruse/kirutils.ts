import { describe, expect, test } from 'bun:test';
import { validate } from './validation.js';

describe('validation', () => {
  test('basic', () => {
    expect(() => validate('hello').isString()).not.toThrow();
    expect(() => validate(123).isString()).toThrow();
    expect(() => validate({ foo: 'bar '}).isObject()).not.toThrow();
    expect(() => validate({ foo: 'bar '}).isArray()).toThrow();
    expect(() => validate({ foo: { bar: 'baz' } }).at(['foo'], val => val.isObject())).not.toThrow();
  });

  test('bulk', () => {
    expect(() => validate({
      nested1: {
        foo: 'bar',
      },
      nested2: {
        foo: 'baz',
      },
    }).at(['*', 'foo'], val => val.isString())).not.toThrow();
    expect(() => validate({
      nested1: {
        foo: 'bar',
      },
      nested2: {
        foo: 'baz',
      },
    }).at(['*', 'bar'], val => val.isString())).toThrow();
  });
});
